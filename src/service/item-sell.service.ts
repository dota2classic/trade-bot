import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Steam } from '../steam';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketItemEntity } from '../entities/market-item.entity';
import { In, Repository } from 'typeorm';
import { SUPPORTED_APP_IDS } from '../constant';
import { marketHashToSelectorName } from '../util/marketHashToName';
import { ConfigService } from '@nestjs/config';
import { ItemPriceService } from './item-price.service';
import { wait } from '../util/wait';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isTradable } from '../util/isTradable';
import { CEconItem } from '../steamexts';
import { RateLimiter } from './rate-limiter.service';

@Injectable()
export class ItemSellService implements OnApplicationBootstrap {
  private logger = new Logger(ItemSellService.name);
  private inventory_index = 0;

  // private static TRADE_LISTING_OUTDATED_THRESHOLD = 1000 * 60 * 60 * 24 * 1; // 3 days
  private static TRADE_LISTING_OUTDATED_THRESHOLD = 1000 * 60 * 60; // 1 hour
  constructor(
    private readonly steam: Steam,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
    private readonly config: ConfigService,
    private readonly itemPriceService: ItemPriceService,
    private readonly rl: RateLimiter,
  ) {
    this.trySellOutdatedItems();
  }

  async onApplicationBootstrap() {}

  // @Cron(CronExpression.EVERY_HOUR)
  public async cancelBadSales() {
    if (!this.config.get('trade.scrape')) return;

    const perPage = 100;
    for (let i = 0; i < 10; i++) {
      const start = i * perPage;
      try {
        const listings = await this.rl.enqueue(() =>
          this.steam.market.myListings(start, perPage),
        );
        if (!listings.success) {
          this.logger.warn('Error getting listings!');
          break;
        }
        if (listings.listings.length === 0) {
          break;
        }

        const formatted = listings.listings.map((t) => ({
          listingDate: t.timeCreated && new Date(t.timeCreated * 1000),
          listingId: t.listingId,
        }));

        const outdated = formatted.filter(
          (t) =>
            t.listingDate &&
            Date.now() - t.listingDate.getTime() >
              ItemSellService.TRADE_LISTING_OUTDATED_THRESHOLD,
        ); // Week old
        for (const listing of outdated) {
          this.logger.log(
            `Removing outdated listing at ${listing.listingDate.toISOString()}`,
          );
          try {
            await this.rl.enqueue(() =>
              this.steam.market.cancelSellOrder(listing.listingId),
            );
          } catch (e) {
            this.logger.warn("Couldn't cancel listing!", e);
          }
        }

        // We already covered all of them, no need to request more
        if (listings.totalCount < perPage) {
          break;
        }
      } catch (e) {
        this.logger.warn("Couldn't remove listing!", e);
      }
    }
    this.logger.log('Checked for outdated trades.');
  }

  // @Cron(CronExpression.EVERY_5_MINUTES)
  public async trySellOutdatedItems() {
    if (!this.config.get('trade.scrape')) return;

    this.inventory_index =
      (this.inventory_index + 1) % SUPPORTED_APP_IDS.length;

    const APP_ID = SUPPORTED_APP_IDS[this.inventory_index];

    // TODO: make this request our db not inventory
    const ownedItems = await new Promise<CEconItem[]>((resolve, reject) => {
      this.steam.trade.getInventoryContents(APP_ID, 2, false, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res as CEconItem[]);
      });
    }).then((t) => t.filter((t) => t.marketable));

    const selectors = ownedItems.map((t) => ({
      ...marketHashToSelectorName(t.market_hash_name),
      item: t,
    }));

    const existing = await this.marketItemEntityRepository.find({
      where: {
        marketHashName: In(selectors.map((t) => t.marketHashName)),
      },
    });

    const outdatedItems = selectors.filter(
      (t) =>
        !isTradable(t.item) ||
        existing.findIndex((ex) => ex.marketHashName === t.marketHashName) ===
          -1,
    );

    for (const item of outdatedItems.reverse().slice(0, 1)) {
      this.logger.log(
        `Selling item ${item.marketHashName} because: ${isTradable(item.item) ? 'outdated' : ' non-tradable'}!`,
      );
      await this.sellItem(item.item);
      await wait(2000);
    }
  }

  private async sellItem(item: CEconItem) {
    const sellPrice = await this.itemPriceService.getSellPrice(
      item.market_hash_name,
      item.appid,
    );

    try {
      const result = await this.rl.enqueue(() =>
        this.steam.market.createSellOrder(item.appid, {
          price: sellPrice / 100,
          amount: 1,
          assetId: item.assetid as number,
          contextId: 2,
        }),
      );
      if (result.success) {
        this.logger.log('Successfully listed item for sale');
      } else {
        this.logger.error('There was an issue listing item!', result);
      }
    } catch (e) {
      this.logger.error('There was an issue selling item!', e);
    }
  }
}
