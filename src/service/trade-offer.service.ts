import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  Currency,
  DOTA_APPID,
  ETradeOfferState,
  TradeOfferStatus,
} from '../constant';
import { EOfferFilter } from 'steam-tradeoffer-manager';
import CEconItem from 'steamcommunity/classes/CEconItem';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import { Steam } from '../steam';
import { CMarketItem } from '../steamexts';
import { MarketItemEntity } from '../entities/market-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ItemPriceService } from './item-price.service';
import { marketHashToSelectorName } from '../util/marketHashToName';
import { TradeOfferEntity } from '../entities/trade-offer.entity';
import { TradeOfferItemEntity } from '../entities/trade-offer-item.entity';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TradeOfferService implements OnApplicationBootstrap {
  private logger = new Logger(TradeOfferService.name);

  constructor(
    private readonly steam: Steam,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
    private readonly itemPriceService: ItemPriceService,
    @InjectRepository(TradeOfferEntity)
    private readonly tradeOfferEntityRepository: Repository<TradeOfferEntity>,
    @InjectRepository(TradeOfferItemEntity)
    private readonly tradeOfferItemEntityRepository: Repository<TradeOfferItemEntity>,
    private readonly ds: DataSource,
  ) {}
  async onApplicationBootstrap() {
    await this.processOffers();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  public async processOffers() {
    const { sent, received } = await new Promise<{
      sent: TradeOffer[];
      received: TradeOffer[];
    }>((resolve, reject) => {
      this.steam.trade.getOffers(
        EOfferFilter.All,
        new Date(Date.now() - 1000 * 60 * 60 * 24 * 21), // 21 days
        async (err, sent, received) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              sent,
              received,
            });
          }
        },
      );
    });

    await Promise.all(received.map((offer) => this.handleOffer(offer)));
  }

  private async handleOffer(offer: TradeOffer) {
    // We only handle accepted offers
    if (offer.state !== ETradeOfferState.Accepted) {
      this.logger.warn('Trade is not accepted: we skip it');
      return;
    }

    // Already processed?
    const alreadyHandled = await this.tradeOfferEntityRepository.exists({
      where: {
        offerId: offer.id,
      },
    });
    if (alreadyHandled) {
      this.logger.warn('Trade is already saved: we skip it');
      return;
    }

    // Find matching patch items
    const matched = await Promise.all(
      offer.itemsToReceive.map(async (item) => {
        return {
          item,
          marketItem: await this.marketItemEntityRepository.findOne({
            where: marketHashToSelectorName(item.market_hash_name),
          }),
        };
      }),
    );

    // Price check them
    const marketItems = await Promise.all(
      matched.map(async ({ item, marketItem }) => {
        return {
          item,
          marketItem,
          marketPriceItem: await this.getMarketItem(item),
        };
      }),
    );

    // Update prices of our patch items
    await Promise.all(
      marketItems
        .filter((t) => !!t.marketItem)
        .map(async (item) =>
          this.itemPriceService.updateItemMarketData(
            item.marketPriceItem.firstAsset.market_hash_name,
            item.marketPriceItem.lowestPrice,
            item.marketPriceItem.firstAsset.type,
          ),
        ),
    );

    await this.acceptTradeOffer(offer, marketItems);
  }

  private getMarketItem = async (item: CEconItem): Promise<CMarketItem> => {
    return new Promise((resolve, reject) =>
      this.steam.community.getMarketItem(
        DOTA_APPID,
        item.market_hash_name,
        Currency.USD,
        (err, res) => {
          if (err) reject(err);
          else resolve(res as CMarketItem);
        },
      ),
    );
  };

  // Called on new accepted trade offer
  private async acceptTradeOffer(
    tradeOffer: TradeOffer,
    items: {
      item: CEconItem;
      marketPriceItem: CMarketItem;
      marketItem: MarketItemEntity;
    }[],
  ) {
    const steamId = tradeOffer.partner.accountid.toString();
    await this.ds.transaction(async (tx) => {
      // Create TradeOfferEntity
      const offer = await tx.save(
        TradeOfferEntity,
        new TradeOfferEntity(tradeOffer.id, steamId, TradeOfferStatus.Accepted),
      );

      // Add traded patch items to it
      const tradedItems = items
        .filter((t) => !!t.marketItem)
        .map(
          (it) =>
            new TradeOfferItemEntity(
              offer.id,
              it.marketItem.id,
              it.marketPriceItem.lowestPrice,
            ),
        );
      await tx.save(TradeOfferItemEntity, tradedItems);

      // Count total traded amount
      const totalTradedBalance = items.reduce(
        (a, b) => a + b.marketPriceItem.lowestPrice,
        0,
      );

      // Update balance
      let user: UserMarketBalanceEntity | undefined = await tx
        .getRepository<UserMarketBalanceEntity>(UserMarketBalanceEntity)
        .createQueryBuilder('user')
        .useTransaction(true)
        .setLock('pessimistic_write')
        .where('user.steam_id = :steamId', {
          steamId: tradeOffer.partner.accountid.toString(),
        })
        .getOne();

      if (!user) {
        user = new UserMarketBalanceEntity(
          tradeOffer.partner.accountid.toString(),
          0,
        );
      }

      user.balance += totalTradedBalance;
      await tx.save(UserMarketBalanceEntity, user);
      this.logger.log(
        `Successfully handled trade offer ${offer.id} for ${totalTradedBalance} amount from ${user.steamId}`,
      );
    });
  }
}
