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
    private readonly itemPriceService: ItemPriceService,
    @InjectRepository(DroppedItemEntity)
    private readonly droppedItemEntityRepository: Repository<DroppedItemEntity>,
    @InjectRepository(DropSettingsEntity)
    private readonly dropSettingsEntityRepository: Repository<DropSettingsEntity>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Cron('0 3 * * MON')
  public async clearBuyOrders() {
    const listings = await this.steam.market.myListings(0, 100);
    for (let buyOrder of listings.buyOrders) {
      await this.steam.market.cancelBuyOrder(buyOrder.buyOrderId);
      await wait(5000);
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

  // @Cron(CronExpression.EVERY_MINUTE)
  public async replenishStock() {
    const listed = await this.steam.market.myListings(0, 100);
    const alreadyListed = listed.buyOrders.map((t) => t.hashName);
    const items = await this.getWeightedItems().then((t) =>
      t
        .filter((t) => t.missing > 0)
        .filter(
          (wi) =>
            !alreadyListed.includes(
              toMarketHashNameParts(wi.market_hash_name, wi.quality),
            ),
        ),
    );
    const toPurchase = items[0];

    const hashName = toMarketHashNameParts(
      toPurchase.market_hash_name,
      toPurchase.quality,
    );

    const marketItem =
      await this.itemPriceService.getMarketItemByName(hashName);

    const fairPrice = Math.floor(marketItem.lowestPrice * 0.97);

    this.logger.log(
      `Restock ${hashName}: ${toPurchase.stock} / ${toPurchase.expected_stock}. Buying one for ${fairPrice}`,
    );

    await this.itemPriceService.updateItemMarketData(
      marketItem._hashName,
      marketItem.lowestPrice,
      marketItem.firstAsset?.type,
      marketItem.firstAsset?.icon_url_large,
      marketItem.firstAsset?.icon_url,
      marketItem.quantity,
    );

    const r = await this.steam.market.createBuyOrder(DOTA_APPID, {
      marketHashName: hashName,
      price: fairPrice * 100, // it will divide to 100
      amount: 1,
    });
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

  public async getWeightedItems() {
    return this.ds.query<
      {
        market_hash_name: string;
        quality: ItemQuality;
        price: number;
        weight: number;
        stock: number;
        expected_stock: number;
        missing: number;
      }[]
    >(`WITH purchasables AS
  (SELECT DISTINCT mi.market_hash_name,
                   mi.quality,
                   mi.price
   FROM market_item mi
   WHERE mi.quantity > 3
     AND mi.price < 50000),
     inverse_sum AS
  (SELECT sum(1.0 / p.price) AS total_inverse
   FROM purchasables p),
     inventory_counts AS
  (SELECT ii.market_hash_name,
          ii.quality,
          count(*) AS stock
   FROM inventory_item ii
   WHERE ii.tradable or ii.trade_cooldown_until is not null
   GROUP BY ii.market_hash_name,
            ii.quality),
     combined AS
  (SELECT p.market_hash_name,
          p.quality,
          p.price,
          (1.0 / p.price) / i.total_inverse AS weight,
          coalesce(ic.stock, 0) AS stock
   FROM purchasables p
   CROSS JOIN inverse_sum i
   LEFT JOIN inventory_counts ic ON ic.market_hash_name = p.market_hash_name
   AND ic.quality = p.quality),
     total_inventory AS
  (SELECT 200 AS total_stock)
SELECT c.market_hash_name,
       c.quality,
       c.price,
       c.weight,
       c.stock,
       ceil(t.total_stock * c.weight) AS expected_stock,
       greatest(ceil(t.total_stock * c.weight) - c.stock, 0) AS missing
FROM combined c
CROSS JOIN total_inventory t
ORDER BY missing DESC,
         weight DESC;`);
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
          const assetId = await this.pickItemDrop();
          await this.saveDroppedItem(assetId, matchId, players[i]);
        }
      } catch (e) {
        this.logger.error('Error dropping item!', e);
      } finally {
        dropChance *= qSettings.subsequentDropChance;
      }
    }
  }

  private async pickItemDrop(): Promise<string | undefined> {
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

    return randomItem.asset_id;
  }

  private async saveDroppedItem(
    assetId: string,
    matchId: number,
    steamId: string,
  ) {
    const droppedItem = await this.droppedItemEntityRepository.save(
      new DroppedItemEntity(assetId, matchId, steamId),
    );
    await this.amqpConnection.publish(
      'app.events',
      ItemDroppedEvent.name,
      new ItemDroppedEvent(matchId, steamId, assetId),
    );
    this.logger.log('Published drop item event');
  }
}
