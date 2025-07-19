import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ETradeOfferState, TradeOfferStatus } from '../constant';
import { EOfferFilter } from 'steam-tradeoffer-manager';
import CEconItem from 'steamcommunity/classes/CEconItem';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import { Steam } from '../steam';
import { CMarketItem } from '../steamexts';
import { MarketItemEntity } from '../entities/market-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ItemPriceService } from './item-price.service';
import { TradeOfferEntity } from '../entities/trade-offer.entity';
import { TradeOfferItemEntity } from '../entities/trade-offer-item.entity';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { wait } from '../util/wait';

@Injectable()
export class TradeOfferService implements OnApplicationBootstrap {
  private logger = new Logger(TradeOfferService.name);

  private tradeOfferProcessMap = new Map<string, boolean>();

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
    try {
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

      await Promise.all(
        received.map((offer) => {
          if (this.tradeOfferProcessMap.get(offer.id)) return;
          try {
            this.tradeOfferProcessMap.set(offer.id, true);
            this.handleOffer(offer);
          } catch (e) {
            this.logger.warn(
              `There was an issue processing trade offer ${offer.id}`,
            );
          } finally {
            this.tradeOfferProcessMap.set(offer.id, false);
          }
        }),
      );
    } catch (e) {
      this.logger.error('There was an issue processing offers', e);
    }
  }

  private async handleOffer(offer: TradeOffer) {
    if (offer.state === ETradeOfferState.Active) {
      // Donation?
      if (offer.itemsToGive.length === 0) {
        const status = await new Promise((resolve, reject) =>
          offer.accept((err, response) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(response);
          }),
        );
        this.logger.log(`Handled active donation offer: status is ${status}`);
        return;
      }
    }

    // We only handle accepted offers
    if (offer.state !== ETradeOfferState.Accepted) {
      return;
    }

    // Already processed?
    const alreadyHandled = await this.tradeOfferEntityRepository.exists({
      where: {
        offerId: offer.id,
      },
    });
    if (alreadyHandled) {
      // this.logger.warn('Trade is already saved: we skip it');
      return;
    }

    this.logger.log(
      `Handling new accepted offer of ${offer.itemsToReceive.length} items from ${offer.partner.accountid}!`,
    );
    const marketItems: { item: CEconItem; marketPriceItem: CMarketItem }[] = [];

    // Price check them
    for (let cEconItem of offer.itemsToReceive) {
      try {
        marketItems.push({
          item: cEconItem,
          marketPriceItem: await this.itemPriceService.getMarketItem(cEconItem),
        });
        this.logger.log(`Price checked item ${cEconItem.market_hash_name}`);
      } catch (e) {
        this.logger.warn('There was an issue price checking item!', e);
      } finally {
        await wait(3000);
      }
    }

    // Update prices of our patch items
    await Promise.all(
      marketItems.map(async (item) =>
        this.itemPriceService.updateItemMarketData(
          item.marketPriceItem._hashName,
          item.marketPriceItem.lowestPrice,
          item.marketPriceItem.firstAsset?.type,
          item.marketPriceItem.firstAsset?.icon_url_large,
          item.marketPriceItem.firstAsset?.icon_url,
          item.marketPriceItem.quantity,
        ),
      ),
    );

    await this.acceptTradeOffer(offer, marketItems);
  }

  // Called on new accepted trade offer
  private async acceptTradeOffer(
    tradeOffer: TradeOffer,
    items: {
      item: CEconItem;
      marketPriceItem: CMarketItem;
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
      const tradedItems = items.map(
        (it) =>
          new TradeOfferItemEntity(
            offer.id,
            it.marketPriceItem._hashName,
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
