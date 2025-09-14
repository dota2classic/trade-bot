import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DOTA_APPID, ETradeOfferState, TradeOfferStatus } from '../constant';
import { EOfferFilter } from 'steam-tradeoffer-manager';
import CEconItem from 'steamcommunity/classes/CEconItem';
import TradeOffer from 'steam-tradeoffer-manager/lib/classes/TradeOffer';
import { Steam } from '../steam';
import { CMarketItem, TradeOfferRawJson } from '../steamexts';
import { MarketItemEntity } from '../entities/market-item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ItemPriceService } from './item-price.service';
import { TradeOfferEntity } from '../entities/trade-offer.entity';
import { TradeOfferItemEntity } from '../entities/trade-offer-item.entity';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { wait } from '../util/wait';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { InventoryItemEntity } from '../entities/inventory-item.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { TradeOfferExpiredEvent } from '../gateway/events/trade-offer-expired.event';
import { ConfigService } from '@nestjs/config';

interface PricedItem {
  item: CEconItem;
  marketPriceItem: CMarketItem;
}

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
    @InjectRepository(DroppedItemEntity)
    private readonly droppedItemEntityRepository: Repository<DroppedItemEntity>,
    private readonly ds: DataSource,
    private readonly amqpConnection: AmqpConnection,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.processOffers();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  public async processOffers() {
    if (!this.config.get('trade.scrape')) return;

    try {
      const { sent, received } = await new Promise<{
        sent: TradeOffer[];
        received: TradeOffer[];
      }>((resolve, reject) => {
        this.steam.trade.getOffers(
          EOfferFilter.All,
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 14 days
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

      const offers = [...received, ...sent];

      await Promise.all(
        offers.map(async (offer) => {
          if (this.tradeOfferProcessMap.get(offer.id)) return;
          try {
            this.tradeOfferProcessMap.set(offer.id, true);
            await this.handleAnyOffer(offer);
          } catch (e) {
            this.logger.warn(
              `There was an issue processing trade offer ${offer.id}`,
              e,
            );
            console.error(e);
          } finally {
            this.tradeOfferProcessMap.set(offer.id, false);
          }
        }),
      );

      await this.updateDroppedItemStatus(offers);
    } catch (e) {
      this.logger.error('There was an issue processing offers', e);
    }
  }

  private async handleAnyOffer(offer: TradeOffer) {
    if (offer.isOurOffer) {
      await this.handleOutcomingOffer(offer);
    } else {
      await this.handleIncomingOffer(offer);
    }
  }

  private async handleOutcomingOffer(offer: TradeOffer) {
    if (offer.state === ETradeOfferState.Countered) {
      // this.logger.warn(`Declined counter offer from ${offer.partner.accountid}`)
      return;
    }

    if (offer.state === ETradeOfferState.Active) {
      // Check if it expired

      const offerExpirationTime = 1000 * 60 * 60; // 1 hour
      if (offer.created.getTime() + offerExpirationTime < Date.now()) {
        this.logger.warn(
          'Outcoming trade offer is taking too long: expired. Cancelling',
        );
        await this.declineTradeOffer(offer);
        await this.amqpConnection.publish(
          'app.events',
          TradeOfferExpiredEvent.name,
          new TradeOfferExpiredEvent(offer.partner.accountid.toString()),
        );
        return;
      }
    }

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
    this.logger.log('Newly accepted tradeoffer huh!');

    const itemsWithPrices = await this.priceCheckItems(offer.itemsToGive);

    const tradeOffer = await this.ds.transaction(async (tx) => {
      // Delete dropped items because they are transferred
      await tx.delete(DroppedItemEntity, {
        assetId: In(offer.itemsToGive.map((t) => t.assetid)),
      } satisfies FindOptionsWhere<DroppedItemEntity>);

      // Delete items from inventory
      await tx.delete(InventoryItemEntity, {
        assetId: In(offer.itemsToGive.map((t) => t.assetid)),
      } satisfies FindOptionsWhere<InventoryItemEntity>);

      let tradeOffer = new TradeOfferEntity(
        offer.id,
        offer.partner.accountid.toString(),
        TradeOfferStatus.Accepted,
        false,
      );
      tradeOffer.tradeId = offer.tradeID;
      tradeOffer = await tx.save(TradeOfferEntity, tradeOffer);

      // Save trade offer items
      await tx.save(
        TradeOfferItemEntity,
        itemsWithPrices.map(
          (t) =>
            new TradeOfferItemEntity(
              tradeOffer.id,
              t.item.assetid.toString(),
              t.marketPriceItem._hashName,
              t.marketPriceItem.lowestPrice,
            ),
        ),
      );

      return tradeOffer;
    });

    this.logger.log(
      `Successfully saved sent offer! ${tradeOffer.id} to ${tradeOffer.steamId} of ${offer.itemsToGive.length} items`,
    );
  }

  private async handleIncomingOffer(offer: TradeOffer) {
    if (offer.state === ETradeOfferState.Active) {
      // Donation?
      if (offer.itemsToGive.length === 0) {
        await this.acceptTradeOffer(offer);
        this.logger.log(`Handled active donation offer: status is ${status}`);
        return;
      } else {
        // We do not give items in received orders
        await this.declineTradeOffer(offer);
        this.logger.log('Declined incoming offer to give our shit!');
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

    const extraData: TradeOfferRawJson = JSON.parse(offer.rawJson);
    if (
      extraData.delay_settlement &&
      new Date(extraData.settlement_date * 1000).getTime() > Date.now()
    ) {
      this.logger.warn('Skipping processing of trade-protected offer');
      return;
    }

    this.logger.log(
      `Handling new accepted offer of ${offer.itemsToReceive.length} items from ${offer.partner.accountid}!`,
    );
    const marketItems = await this.priceCheckItems(offer.itemsToReceive);

    // Update prices of our patch items
    await Promise.all(
      marketItems.map(async (item) => {
        await this.itemPriceService.updateItemMarketData(
          item.marketPriceItem._hashName,
          item.marketPriceItem.lowestPrice,
          item.marketPriceItem.firstAsset?.type,
          item.marketPriceItem.firstAsset?.icon_url_large,
          item.marketPriceItem.firstAsset?.icon_url,
          item.marketPriceItem.quantity,
          false,
        );
      }),
    );

    await this.saveAcceptedTradeOffer(offer, marketItems);
  }

  // Called on new accepted trade offer
  private async saveAcceptedTradeOffer(
    tradeOffer: TradeOffer,
    items: {
      item: CEconItem;
      marketPriceItem: CMarketItem;
    }[],
  ) {
    const steamId = tradeOffer.partner.accountid.toString();
    await this.ds
      .transaction(async (tx) => {
        // Create TradeOfferEntity
        const offer = await tx.save(
          TradeOfferEntity,
          new TradeOfferEntity(
            tradeOffer.id,
            steamId,
            TradeOfferStatus.Accepted,
            true,
          ),
        );

        // Add traded patch items to it
        const tradedItems = items.map(
          (it) =>
            new TradeOfferItemEntity(
              offer.id,
              it.item.assetid.toString(),
              it.marketPriceItem._hashName,
              it.marketPriceItem.lowestPrice,
            ),
        );
        await tx.save(TradeOfferItemEntity, tradedItems);

        // Count total traded amount
        const totalTradedBalance = items.reduce(
          (a, b) => a + b.marketPriceItem.highestBuyOrder, // For incoming requests we use highestBuyOrder
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
      })
      .catch((err) => {
        this.logger.error('There was an issue saving trade offer!', err);
      });
  }

  public async createTradeRequest(link: string, items: DroppedItemEntity[]) {
    const offer = this.steam.trade.createOffer(link);

    // Add items
    offer.addMyItems(
      items.map(
        (item) =>
          ({
            assetid: item.assetId,
            contextid: 2,
            appid: DOTA_APPID,
            amount: 1,
          }) as CEconItem,
      ),
    );

    const status = await new Promise<'pending' | 'sent'>((resolve, reject) =>
      offer.send((err, status) => {
        if (err) {
          this.logger.error({
            message: 'Error sending trade request!',
            cause: err.cause,
            errorMessage: err.message,
            errorCode: err.eresult,
          });
          // reject(`Error sending trade request: ${err.eresult}`);
          reject(
            new HttpException(
              {
                message:
                  'Не можем отправить запрос на обмен: VAC или аккаунт не может обмениваться.',
              },
              HttpStatus.BAD_REQUEST,
            ),
          );
          return;
        }
        resolve(status);
      }),
    );

    return offer;
  }

  // TODO: works bad for items like this https://steamcommunity.com/market/listings/570/Inscribed%20Spaulder%20of%20the%20Dwarf%20Engineer
  // use max buy price for pricechecking
  private async priceCheckItems(items: CEconItem[]): Promise<PricedItem[]> {
    const marketItems: PricedItem[] = [];

    // Price check them
    for (let cEconItem of items) {
      try {
        marketItems.push({
          item: cEconItem,
          marketPriceItem: await this.itemPriceService.getMarketItem(
            cEconItem,
            cEconItem.appid,
          ),
        });
        this.logger.log(`Price checked item ${cEconItem.market_hash_name}`);
      } catch (e) {
        this.logger.warn('There was an issue price checking item!');
      } finally {
        await wait(3000);
      }
    }
    return marketItems;
  }

  private async acceptTradeOffer(offer: TradeOffer) {
    return new Promise((resolve, reject) =>
      offer.accept((err, response) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      }),
    );
  }

  private async declineTradeOffer(offer: TradeOffer) {
    await new Promise((resolve, reject) =>
      offer.decline((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(undefined);
      }),
    );
  }

  private async updateDroppedItemStatus(offers: TradeOffer[]) {
    const droppedItemStatus = new Map<string, string | null>();

    for (const offer of offers) {
      for (const item of offer.itemsToGive) {
        const isAlreadySet = droppedItemStatus.get(item.assetid.toString());

        if (isAlreadySet) continue;

        const isActiveTrade = [
          ETradeOfferState.Active,
          ETradeOfferState.InEscrow,
        ].includes(offer.state);

        const isResolvedTrade = [
          ETradeOfferState.Invalid,
          ETradeOfferState.InvalidItems,
          ETradeOfferState.Canceled,
          ETradeOfferState.CanceledBySecondFactor,
          ETradeOfferState.Declined,
          ETradeOfferState.Expired,
        ].includes(offer.state);

        if (isActiveTrade) {
          droppedItemStatus.set(item.assetid.toString(), offer.id);
        } else if (isResolvedTrade) {
          droppedItemStatus.set(item.assetid.toString(), null);
        }
      }
    }

    const droppedItemStatusArray = Array.from(droppedItemStatus.entries());

    const values = droppedItemStatusArray
      .map(
        ([assetId, tradeOfferId]) =>
          `('${assetId}', ${tradeOfferId ? `'${tradeOfferId}'` : 'NULL'})`,
      )
      .join(',');
    const queryInsert = await this.ds.query(`
UPDATE dropped_item AS di
SET active_trade_offer_id = upd_di.active_trade_offer_id
FROM (VALUES ${values}) AS upd_di(assetid, active_trade_offer_id)
WHERE di.assetid = upd_di.assetid;
    `);
  }
}
