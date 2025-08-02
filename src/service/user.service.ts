import { HttpException, Injectable, Logger } from '@nestjs/common';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Steam } from '../steam';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { MarketItemEntity } from '../entities/market-item.entity';
import { TradeOfferService } from './trade-offer.service';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserMarketBalanceEntity)
    private readonly userMarketBalanceEntityRepository: Repository<UserMarketBalanceEntity>,
    @InjectRepository(DroppedItemEntity)
    private readonly droppedItemEntityRepository: Repository<DroppedItemEntity>,
    private readonly ds: DataSource,
    private readonly steam: Steam,
    private readonly tradeOfferService: TradeOfferService,
  ) {}

  public async update(steamId: string, tradeLink: string) {
    await this.userMarketBalanceEntityRepository.upsert(
      {
        steamId,
        tradeLink,
      },
      ['steamId'],
    );
  }

  public async claimDrops(steamId: string) {
    this.logger.log(`User ${steamId} claiming drops!`);
    const user = await this.userMarketBalanceEntityRepository.findOne({
      where: {
        steamId,
      },
    });
    if (!user || !user.tradeLink) {
      throw new HttpException('No user or trade link!', 400);
    }

    // First, get list of all items
    const droppedItems = await this.droppedItemEntityRepository
      .createQueryBuilder('di')
      .innerJoinAndMapOne(
        'marketItem',
        MarketItemEntity,
        'mi',
        'mi.market_hash_name = di.market_hash_name and di.quality = mi.quality',
      )
      .where('di.steam_id = :steamId', {
        steamId: steamId,
      })
      .andWhere('di.active_trade_offer_id is null')
      .andWhere('di.created >= now() - :expiration::interval', {
        expiration: '7 days',
      })
      .getMany();

    this.logger.log(`User ${steamId}: ${droppedItems.length} to trade`);

    if (droppedItems.length === 0) {
      throw 'No items available for trade!';
    }

    // then, create trade request
    try {
      const offer = await this.tradeOfferService.createTradeRequest(
        user.tradeLink,
        droppedItems,
      );

      await this.droppedItemEntityRepository.update(
        {
          assetId: In(droppedItems.map((t) => t.assetId)),
        },
        {
          activeTradeOfferId: offer.id,
        },
      );
      this.logger.log(`Trade offer created ${offer.id}.`);
      return offer.id;
    } catch (e) {
      this.logger.error('There was an issue creating trade request!', e);
      throw e;
    }
  }

  public async purchase(steamId: string, amount: number) {
    await this.ds
      .transaction(async (tx) => {
        // Update balance
        let user: UserMarketBalanceEntity | undefined = await tx
          .getRepository<UserMarketBalanceEntity>(UserMarketBalanceEntity)
          .createQueryBuilder('user')
          .useTransaction(true)
          .setLock('pessimistic_write')
          .where('user.steam_id = :steamId', {
            steamId: steamId,
          })
          .getOne();

        if (user.balance < amount) {
          throw 'Not enough money!';
        }

        user.balance -= amount;
        await tx.save(UserMarketBalanceEntity, user);
        this.logger.log(
          `Successfully purchased something for ${amount} rubles`,
        );
      })
      .catch((err) => {
        this.logger.error('There was an issue purchasing something!', err);
      });
  }
}
