import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Steam } from '../steam';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketItemEntity } from '../entities/market-item.entity';
import { In, Repository } from 'typeorm';
import { DOTA_APPID } from '../constant';
import { marketHashToSelectorName } from '../util/marketHashToName';
import { ConfigService } from '@nestjs/config';
import { ItemPriceService } from './item-price.service';
import { wait } from '../util/wait';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isTradable } from '../util/isTradable';
import { CEconItem } from '../steamexts';
import { getCookie } from "../util/getCookie";

@Injectable()
export class ItemSellService implements OnApplicationBootstrap {
  private logger = new Logger(ItemSellService.name);

  // private static TRADE_LISTING_OUTDATED_THRESHOLD = 1000 * 60 * 60 * 24 * 1; // 3 days
  private static TRADE_LISTING_OUTDATED_THRESHOLD = 1000 * 60 * 60; // 1 hour
  constructor(
    private readonly steam: Steam,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
    private readonly config: ConfigService,
    private readonly itemPriceService: ItemPriceService,
  ) {}

  async onApplicationBootstrap() {
  }

  @Cron(CronExpression.EVERY_HOUR)
  public async cancelBadSales() {
    const perPage = 100;
    for (let i = 0; i < 10; i++) {
      const start = i * perPage;
      try {
        const listings = await this.steam.market.myListings(start, perPage);
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
            await this.steam.market.cancelSellOrder(listing.listingId);
          } catch (e) {
            this.logger.warn("Couldn't cancel listing!", e);
          } finally {
            await wait(5000);
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

  @Cron(CronExpression.EVERY_MINUTE)
  public async trySellOutdatedItems() {
    // TODO: make this request our db not inventory
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
    }).then((t) => t.filter((t) => t.marketable));

    const selectors = res.map((t) => ({
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
      await this.sellItem(item.item);
      await wait(2000);
    }
  }

  private async sellItem(item: CEconItem) {
    const sellPrice = await this.itemPriceService.getSellPrice(
      item.market_hash_name,
    );

    this.logger.log(
      `Trying to sell ${item.market_hash_name} for ${sellPrice}, ${item.assetid}`,
    );

    try {
      const result = await this.steam.market.createSellOrder(DOTA_APPID, {
        price: sellPrice / 100,
        amount: 1,
        assetId: item.assetid as number,
        contextId: 2,
      });
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
