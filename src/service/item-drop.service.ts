import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { Steam } from '../steam';
import { DOTA_APPID, ItemQuality } from '../constant';
import { CEconItem } from '../steamexts';
import { InventoryItemEntity } from '../entities/inventory-item.entity';
import { marketHashToSelectorName } from '../util/marketHashToName';
import { Cron, CronExpression } from '@nestjs/schedule';
import { toMarketHashNameParts } from '../util/marketHashName';
import { ItemPriceService } from './item-price.service';
import { wait } from '../util/wait';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MatchmakingMode } from '../gateway/shared-types/matchmaking-mode';
import { DropSettingsEntity } from '../entities/drop-settings.entity';
import { shuffleArray } from '../util/shuffle';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ItemDroppedEvent } from '../gateway/events/item-dropped.event';
import { BuyOrder } from '@dota2classic/steam-market';
import { RateLimiter } from './rate-limiter.service';

interface ItemToBuy {
  market_hash_name: string;
  quality: ItemQuality;
  missing: number;
  tier: number;

  expected_stock: number;
  tier_stock: number;
  tier_missing: number;
}

@Injectable()
export class ItemDropService {
  private logger = new Logger(ItemDropService.name);

  private static DROP_ENABLE_MODES: MatchmakingMode[] = [
    MatchmakingMode.UNRANKED,
    MatchmakingMode.RANKED,
    MatchmakingMode.HIGHROOM,
  ];

  constructor(
    private readonly ds: DataSource,
    private readonly steam: Steam,
    private readonly rl: RateLimiter,
    private readonly itemPriceService: ItemPriceService,
    @InjectRepository(DroppedItemEntity)
    private readonly droppedItemEntityRepository: Repository<DroppedItemEntity>,
    @InjectRepository(DropSettingsEntity)
    private readonly dropSettingsEntityRepository: Repository<DropSettingsEntity>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  public async clearBuyOrders() {
    const listings = await this.rl.enqueue(() =>
      this.steam.market.myListings(0, 100),
    );
    for (let buyOrder of listings.buyOrders) {
      await this.rl.enqueue(() =>
        this.steam.market.cancelBuyOrder(buyOrder.buyOrderId),
      );
      this.logger.log(`Cancelled buy order ${buyOrder.hashName}`);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  public async synchronizeInventory() {
    const res = await new Promise<CEconItem[]>((resolve, reject) => {
      this.steam.trade.getInventoryContents(
        DOTA_APPID,
        2,
        false,
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(res as CEconItem[]);
        },
      );
    });

    await this.ds.transaction(async (tx) => {
      // Delete all old
      await tx.deleteAll(InventoryItemEntity);

      // Insert all new
      const items = res.map((t) => {
        const { marketHashName, quality } = marketHashToSelectorName(
          t.market_hash_name,
        );
        const tradeCooldown = t?.owner_descriptions?.find((t) =>
          t.value.includes('On Trade Cooldown Until: '),
        );
        return new InventoryItemEntity(
          t.assetid.toString(),
          marketHashName,
          quality,
          t.tradable,
          t.marketable,
          tradeCooldown &&
            new Date(
              tradeCooldown.value.replace('\nOn Trade Cooldown Until: ', ''),
            ),
        );
      });
      await tx.save(InventoryItemEntity, items);
      this.logger.log(`Inventory updated: ${items.length} items saved`);
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  public async replenishStock() {
    const listed = await this.rl.enqueue(() =>
      this.steam.market.myListings(0, 100),
    );
    const alreadyListed = listed.buyOrders.map((t) => t.hashName);
    const items = await this.getWeightedItemV2(listed.buyOrders).then((t) =>
      t.filter(
        (wi) =>
          !alreadyListed.includes(
            toMarketHashNameParts(wi.market_hash_name, wi.quality),
          ),
      ),
    );

    if (items.length === 0) {
      this.logger.log(
        'Stock is fully replenished or waiting to buy. All good!',
      );
      return;
    }

    const toPurchase = items[0];

    const hashName = toMarketHashNameParts(
      toPurchase.market_hash_name,
      toPurchase.quality,
    );

    const marketItem =
      await this.itemPriceService.getMarketItemByName(hashName);

    const fairPrice = Math.floor(marketItem.lowestPrice * 0.97);

    this.logger.log(
      `Restock tier ${toPurchase.tier} with ${hashName}: ${toPurchase.tier_stock} / ${toPurchase.expected_stock}. Buying one for ${fairPrice}`,
    );

    await this.itemPriceService.updateItemMarketData(
      marketItem._hashName,
      marketItem.lowestPrice,
      marketItem.firstAsset?.type,
      marketItem.firstAsset?.icon_url_large,
      marketItem.firstAsset?.icon_url,
      marketItem.quantity,
    );

    const r = await this.rl.enqueue(() => this.steam.market.createBuyOrder(DOTA_APPID, {
      marketHashName: hashName,
      price: fairPrice * 100, // it will divide to 100
      amount: 1,
    }));
    if (r.success) {
      if (Number.isNaN(r.buyOrderId)) {
        console.log('Bad buy?', r);
      }
      this.logger.log(
        `Buy order created for ${hashName}. Order id = ${r.buyOrderId}`,
      );
    } else {
      this.logger.warn('There was an issue creating buy order', r);
    }
  }

  private async getWeightedItemV2(buyOrders: BuyOrder[]): Promise<ItemToBuy[]> {
    interface Tier {
      from: number;
      to: number;
      weight: number;
      tier: number;
      listedCount: number;
    }
    const desiredStock = 200;

    const tiers: Omit<Tier, 'tier' | 'listedCount'>[] = [
      { from: 0, to: 100, weight: 0.6 },
      { from: 100, to: 500, weight: 0.2 },
      { from: 500, to: 1000, weight: 0.1 },
      { from: 1000, to: 5000, weight: 0.07 },
      { from: 5000, to: 15000, weight: 0.025 },
      { from: 15000, to: 999999, weight: 0.005 },
    ];

    const tiersWithCounts: Tier[] = tiers.map((tier, index) => ({
      ...tier,
      tier: index + 1,
      listedCount: buyOrders.filter(
        (t) => t.price >= tier.from && t.price < tier.to,
      ).length,
    }));

    const tiersBuyingNow = tiersWithCounts
      .map((t) => `(${t.tier}, ${t.listedCount})`)
      .join(', ');

    const tierValues = tiersWithCounts
      .map((t) => `(${t.tier}, ${t.from}, ${t.to}, ${t.weight})`)
      .join(', ');

    this.logger.log(`Item tiers with listing count: ${tiersBuyingNow}`);

    const q = `
      -- WITH WEIGHTS
with tier_buying_now as (
  select * from (values
    ${tiersBuyingNow}
  ) as t(tier, buying_now)
), price_ladder as (
  select * from (values
    ${tierValues}
  ) as t(tier, min_price, max_price, target_weight)
),
purchasables as (
  select distinct market_hash_name, quality, price
  from market_item
  where quantity >= 20 and price < 50000 and quality != 'Corrupted' -- corrupted usually overprice shit
),
inventory_counts as (
  select market_hash_name, quality, count(*) as stock
  from inventory_item
  where tradable or trade_cooldown_until is not null
  group by market_hash_name, quality
),
items_with_tiers as (
  select p.*, l.tier, l.target_weight
  from purchasables p
  join price_ladder l on p.price >= l.min_price and p.price < l.max_price
),
tier_stock as (
  select tier, sum(coalesce(ic.stock, 0)) as stock
  from items_with_tiers i
  left join inventory_counts ic
    on ic.market_hash_name = i.market_hash_name
    and ic.quality = i.quality
  group by tier
),
total_stock as (
  select ${desiredStock} as value
),
final as (
  select
    i.market_hash_name,
    i.quality,
    i.price,
    i.tier,
    i.target_weight,
    coalesce(tier_s.stock, 0) as tier_stock,
    coalesce(ic.stock, 0) as stock,
    ts.value as total_stock,
    ts.value * i.target_weight as expected_tier_stock,
    greatest(ts.value * i.target_weight - coalesce(tier_s.stock, 0) - coalesce(tbn.buying_now, 0), 0) as tier_missing,
    greatest(ts.value * i.target_weight - coalesce(tier_s.stock, 0) - coalesce(tbn.buying_now, 0), 0) - coalesce(ic.stock, 0) as item_priority
  from items_with_tiers i
  left join inventory_counts ic on ic.market_hash_name = i.market_hash_name and ic.quality = i.quality
  cross join total_stock ts
  left join tier_stock tier_s on tier_s.tier = i.tier
  left join tier_buying_now tbn on tbn.tier = i.tier
)
select
  market_hash_name,
  quality,
  price,
  tier,
  target_weight::float,
  stock,
  tier_stock::int,
  ceil(expected_tier_stock)::int as expected_stock,
  tier_missing::int,
  round(greatest(item_priority, 0))::int as missing
from final
where greatest(item_priority, 0) > 0
order by tier_missing::float / greatest(1, expected_tier_stock) desc, missing desc, tier asc, random();
    `;

    return await this.ds.query<ItemToBuy[]>(q);
  }

  public async onMatchFinished(
    type: MatchmakingMode,
    matchId: number,
    players: string[],
  ) {
    if (!ItemDropService.DROP_ENABLE_MODES.includes(type)) {
      this.logger.warn(`Skipping match ${matchId}: not suited for drops`);
      return;
    }
    players = shuffleArray(players);

    const qSettings = await this.dropSettingsEntityRepository.findOne({
      where: {
        id: Not(IsNull()),
      },
    });

    let dropChance = qSettings.baseDropChance;
    for (let i = 0; i < players.length; i++) {
      try {
        if (Math.random() < dropChance) {
          // We are lucky! drop an item
          const drop = await this.pickItemDrop();
          await this.saveDroppedItem(
            drop.asset_id,
            matchId,
            players[i],
            drop.market_hash_name,
            drop.quality,
          );
        }
      } catch (e) {
        this.logger.error('Error dropping item!', e);
      } finally {
        dropChance *= qSettings.subsequentDropChance;
      }
    }
  }

  private async pickItemDrop(): Promise<
    | {
        asset_id: string;
        quality: ItemQuality;
        market_hash_name: string;
        price: number;
      }
    | undefined
  > {
    const randomItem = await this.ds
      .query<
        {
          asset_id: string;
          quality: ItemQuality;
          market_hash_name: string;
          price: number;
        }[]
      >(
        `
    WITH inventory_contents AS
  (SELECT ii.assetid AS asset_id,
          ii.quality,
          ii.market_hash_name,
          mi.price
   FROM inventory_item ii
   LEFT JOIN market_item mi ON mi.market_hash_name = ii.market_hash_name
   AND mi.quality = ii.quality
   LEFT JOIN dropped_item di ON di.assetid = ii.assetid
   WHERE di IS NULL
   ORDER BY 1),
     inventory_with_weights AS
  (SELECT *,
          1.0 / price AS weight
   FROM inventory_contents),
     weight_totals AS
  (SELECT *,
          SUM(weight) OVER () AS total_weight
   FROM inventory_with_weights),
     cumulative AS
  (SELECT *,
          SUM(weight) OVER (
                            ORDER BY asset_id) AS cumulative_weight
   FROM weight_totals),
     threshold AS
  (SELECT total_weight * random() AS threshold
   FROM weight_totals
   LIMIT 1)
SELECT asset_id,
       quality,
       market_hash_name,
       price
FROM cumulative,
     threshold
WHERE cumulative_weight >= threshold
ORDER BY cumulative_weight
LIMIT 1;
    `,
      )
      .then((t) => t[0]);

    if (!randomItem) {
      this.logger.error("Couldn't select item for drop! Are we out of items?");
      return;
    }

    return randomItem;
  }

  private async saveDroppedItem(
    assetId: string,
    matchId: number,
    steamId: string,
    marketHashName: string,
    quality: ItemQuality,
  ) {
    const droppedItem = await this.droppedItemEntityRepository.save(
      new DroppedItemEntity(assetId, matchId, steamId, marketHashName, quality),
    );
    await this.amqpConnection.publish(
      'app.events',
      ItemDroppedEvent.name,
      new ItemDroppedEvent(matchId, steamId, assetId),
    );
    this.logger.log('Published drop item event');
  }
}
