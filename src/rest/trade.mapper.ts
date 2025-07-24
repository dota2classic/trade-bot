import { Injectable } from '@nestjs/common';
import { DroppedItemDto, MarketItemDto, UserDto } from './trade.dto';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { MarketItemEntity } from '../entities/market-item.entity';

@Injectable()
export class TradeMapper {
  constructor() {}

  public mapUser = (user: UserMarketBalanceEntity): UserDto => {
    return {
      steamId: user.steamId,
      balance: user.balance,
      tradeLink: user.tradeLink,
    };
  };

  public mapDrop = (drop: DroppedItemEntity): DroppedItemDto => ({
    matchId: drop.matchId,
    droppedAt: drop.created.toISOString(),
    expires: drop.created.toISOString(),
    item: this.mapMarketItem(drop.marketItem),
  });

  public mapMarketItem = (item: MarketItemEntity): MarketItemDto => ({
    marketHashName: item.marketHashName,
    quality: item.quality,
    price: item.price,
    icon: item.largeIcon || item.smallIcon
  });
}
