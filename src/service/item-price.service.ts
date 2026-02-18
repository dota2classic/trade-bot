import { Injectable, Logger } from '@nestjs/common';
import { Currency, DOTA_APPID, ItemQualities, ItemQuality } from '../constant';
import { MarketItemEntity } from '../entities/market-item.entity';
import { Equal, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import CEconItem from 'steamcommunity/classes/CEconItem';
import { CMarketItem } from '../steamexts';
import { Steam } from '../steam';
import { MarketItemSelector } from '../util/marketHashToName';
import { SearchResult } from '@dota2classic/steam-market';
import { RateLimiter } from './rate-limiter.service';
import { ConfigService } from '@nestjs/config';
import { formatPrice } from '../util/formatPrice';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ItemPriceService {
  private logger = new Logger(ItemPriceService.name);

  constructor(
    private readonly steam: Steam,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
    private readonly rl: RateLimiter,
    private readonly config: ConfigService,
  ) {}

  /**
   * This price checks item and its qualities. It updates price, quantity and other meta
   * @param item
   */
  public async priceCheckWithQualities(item: MarketItemEntity) {
    const qualities = ItemQualities.map((t) => {
      if (t === ItemQuality.Standard) {
        return '';
      }
      return `${t} `;
    }).join('|');
    const matchRegex = new RegExp(`^(${qualities})(${item.marketHashName})$`);

    const pageSize = 10;
    const allListings: SearchResult[] = [];
    for (let i = 0; i < 5; i++) {
      const result = await this.rl.enqueue(() =>
        this.steam.market.search(DOTA_APPID, {
          query: item.marketHashName,
          start: i * pageSize,
          count: pageSize,
        }),
      );
      if (!result.success) {
        this.logger.warn('Issue resolving qualities', result);
      }
      if (result.results.length === 0) {
        break;
      }
      allListings.push(...result.results);

      if (result.results.length < pageSize) {
        break;
      }
    }

    const actualQualities: (MarketItemSelector & {
      sellPrice: number;
      quantity: number;
      iconUrl: string;
      type: string;
    })[] = allListings
      .map((t) => {
        const hn = t.assetDescription.marketHashName;
        const match = hn.match(matchRegex);

        if (!match) {
          return null;
        }

        if (match[2] !== item.marketHashName) {
          this.logger.warn(
            `After parsing qualities market hash name don't match! "${match[2]}" != "${item.marketHashName}"`,
          );
          return null;
        }

        return {
          quality:
            match[1] === ''
              ? ItemQuality.Standard
              : (match[1].trim() as ItemQuality),
          marketHashName: match[2],
          sellPrice: t.sellPrice,
          quantity: t.sellListings,
          iconUrl: t.assetDescription.iconUrl,
          type: t.assetDescription.type,
        };
      })
      .filter(Boolean);

    // Upsert existing qualities
    await Promise.all(
      actualQualities.map((t) =>
        this.updateItemMarketData(
          `${t.quality} ${t.marketHashName}`,
          t.sellPrice,
          t.type,
          undefined,
          t.iconUrl,
          t.quantity,
          true,
        ),
      ),
    );

    // Update not found qualities
    const missingQualities = ItemQualities.filter(
      (quality) =>
        actualQualities.findIndex((q) => q.quality === quality) === -1,
    );
    await Promise.all(
      missingQualities.map((quality) =>
        this.updateItemMarketData(
          `${quality} ${item.marketHashName}`,
          0,
          item.type,
          item.largeIcon,
          item.smallIcon,
          0,
          false,
        ),
      ),
    );

    this.logger.log(
      `Successfully update some data about items ${actualQualities.length}. Total request: ${Math.ceil(allListings.length / pageSize)}. ${missingQualities.length} missing qualities updated`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  public async priceCheck() {
    if (!this.config.get('trade.scrape')) return;
    await this.logPriceCheckInfo();

    const toCheck = await this.getPriceCheckPrioritizedItems();
    await Promise.all(
      toCheck.map((item) => this.priceCheckWithQualities(item)),
    );
  }

  public getMarketItem = async (
    item: CEconItem,
    appId = DOTA_APPID,
  ): Promise<CMarketItem> => {
    return this.getMarketItemByName(item.market_hash_name, appId);
  };

  public getMarketItemByName = async (
    name: string,
    appId = DOTA_APPID,
  ): Promise<CMarketItem> => {
    const pr = this.rl.enqueue<CMarketItem>(
      () =>
        new Promise((resolve, reject) => {
          this.logger.log(`Get market item by name '${name}'`);
          return this.steam.community.getMarketItem(
            appId,
            name,
            Currency.RUB,
            (err, res) => {
              if (err) reject(err);
              else resolve(res as CMarketItem);
            },
          );
        }),
    );

    pr.catch((e) => {
      this.logger.error('Error from throttled call:', e);
    });

    return pr;
  };

  /**
   * At what price should be sell this item?
   * @param name
   * @param appid
   */
  public getSellPrice = async (
    name: string,
    appid: number,
  ): Promise<number> => {
    const mitem = await this.getMarketItemByName(name, appid);
    const basePrice = mitem.lowestPrice;

    if (mitem.medianSalePrices.length === 0) {
      return basePrice;
    }

    const historicalData = mitem.medianSalePrices
      .reverse()
      .filter((t) => t.quantity > 1)
      .slice(0, 100);

    const fairPrice = historicalData.map((a) => a.price * 100).sort()[
      Math.floor(historicalData.length / 2)
    ];

    this.logger.log(
      `Lowest price: ${mitem.lowestPrice}, calculated: ${fairPrice}`,
    );

    const priceToSell = Math.max(basePrice, fairPrice);
    return Math.ceil(priceToSell * 0.87);
  };

  public async handleMarketItem(fullName: string, item: CMarketItem) {
    await this.updateItemMarketData(
      fullName,
      item.lowestPrice,
      item.firstAsset?.type,
      item.firstAsset?.icon_url_large,
      item.firstAsset?.icon_url,
      item.quantity,
      true,
    );
  }

  private async updateItemMarketData(
    marketHashName: string,
    price: number,
    type: string | undefined,
    largeIcon: string | undefined,
    smallIcon: string | undefined,
    quantity: number,
    upsert: boolean,
  ) {
    if (Number.isNaN(price)) {
      this.logger.warn(`Tried to save NaN price! ${marketHashName}`);
      return;
    }
    let itemName = marketHashName;
    const first = marketHashName.split(' ')[0];
    let quality = ItemQualities.find((quality) => quality === first);
    if (quality) {
      itemName = itemName.replace(`${quality} `, '');
    } else {
      quality = ItemQuality.Standard;
    }

    this.logger.log(
      `Update market data for ${quality} ${itemName}: ${formatPrice(price)}`,
    );

    if (upsert) {
      await this.marketItemEntityRepository.upsert(
        {
          price,
          type,
          quantity,
          largeIcon,
          smallIcon,
          updated: new Date(),
          marketHashName: itemName,
          quality: quality,
        },
        ['marketHashName', 'quality'],
      );
    } else {
      await this.marketItemEntityRepository.update(
        {
          marketHashName: itemName,
          quality: quality,
        },
        {
          price,
          type,
          quantity,
          largeIcon,
          smallIcon,
          updated: new Date(),
        },
      );
    }
  }

  private async logPriceCheckInfo() {
    const indexed = await this.marketItemEntityRepository.count({
      where: {
        quantity: Not(Equal(-1)),
        price: Not(Equal(-1)),
      },
    });
    this.logger.log(
      `Total indexed items: ${indexed} / ${await this.marketItemEntityRepository.count()}`,
    );
  }

  private async getPriceCheckPrioritizedItems(): Promise<MarketItemEntity[]> {
    return this.marketItemEntityRepository.find({
      order: {
        updated: 'ASC',
      },
      take: 1,
    });
  }
}
