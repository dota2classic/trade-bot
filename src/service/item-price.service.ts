import { Injectable, Logger } from '@nestjs/common';
import { Currency, DOTA_APPID, ItemQualities, ItemQuality } from '../constant';
import { MarketItemEntity } from '../entities/market-item.entity';
import { Equal, In, MoreThan, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import CEconItem from 'steamcommunity/classes/CEconItem';
import { CMarketItem } from '../steamexts';
import { Steam } from '../steam';
import { MarketItemSelector } from '../util/marketHashToName';
import { SearchResult } from '@dota2classic/steam-market';
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class ItemPriceService {
  private logger = new Logger(ItemPriceService.name);

  constructor(
    private readonly steam: Steam,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
  ) {}

  public async priceCheck2(item: MarketItemEntity) {
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
      const result = await this.steam.market.search(DOTA_APPID, {
        query: item.marketHashName,
        start: i * pageSize,
        count: pageSize,
      });
      if (!result.success) {
        this.logger.warn('Issue resolving qualities', result);
      }
      if (result.results.length === 0) {
        break;
      }
      allListings.push(...result.results);
    }

    const actualQualities: (MarketItemSelector & {
      sellPrice: number;
      quantity: number;
      iconUrl: string;
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
          iconUrl: t['iconUrl'],
        };
      })
      .filter(Boolean);

    // First, delete all that are not present
    const deletion = await this.marketItemEntityRepository.delete({
      marketHashName: item.marketHashName,
      quality: Not(In(actualQualities.map((t) => t.quality))),
    });
    this.logger.log(
      `Delete ${deletion.affected} non existing market items for ${item.marketHashName}`,
    );

    await Promise.all(
      actualQualities.map((t) =>
        this.updateItemMarketData(
          `${t.quality} ${t.marketHashName}`,
          t.sellPrice,
          undefined,
          undefined,
          t.iconUrl,
          t.quantity,
        ),
      ),
    );

    this.logger.log(
      `Successfully update some data about items ${actualQualities.length}. Total request: ${Math.ceil(allListings.length / pageSize)}`,
    );
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  public async priceCheck() {
    const indexed = await this.marketItemEntityRepository.count({
      where: {
        quantity: MoreThan(0),
        price: Not(Equal(-1)),
      },
    });
    this.logger.log(
      `Total indexed items: ${indexed} / ${await this.marketItemEntityRepository.count()}`,
    );
    const toCheck = await this.marketItemEntityRepository.find({
      where: {
        quality: ItemQuality.Standard,
      },
      order: {
        updated: 'ASC',
      },
      take: 1,
    });

    await Promise.all(toCheck.map((item) => this.priceCheck2(item)));
  }

  public getMarketItem = async (item: CEconItem): Promise<CMarketItem> => {
    return this.getMarketItemByName(item.market_hash_name);
  };

  public getMarketItemByName = async (name: string): Promise<CMarketItem> => {
    return new Promise((resolve, reject) =>
      this.steam.community.getMarketItem(
        DOTA_APPID,
        name,
        Currency.RUB,
        (err, res) => {
          if (err) reject(err);
          else resolve(res as CMarketItem);
        },
      ),
    );
  };

  public getLowestBuyPrice = async (name: string): Promise<number> => {
    return this.getMarketItemByName(name).then((t) => t.lowestPrice);
  };

  public getSellPrice = async (name: string): Promise<number> => {
    const mitem = await this.getMarketItemByName(name);
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

  public async updateItemMarketData(
    marketHashName: string,
    price: number,
    type: string | undefined,
    largeIcon: string | undefined,
    smallIcon: string | undefined,
    quantity: number,
  ) {
    let itemName = marketHashName;
    const first = marketHashName.split(' ')[0];
    let quality = ItemQualities.find((quality) => quality === first);
    if (quality) {
      itemName = itemName.replace(`${quality} `, '');
    } else {
      quality = ItemQuality.Standard;
    }

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
