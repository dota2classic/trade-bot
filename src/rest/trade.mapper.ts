import { Injectable } from '@nestjs/common';
import {
  DroppedItemDto,
  DropTierDto,
  MarketItemDto,
  TradeOfferDto,
  UserDto,
} from './trade.dto';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { MarketItemEntity } from '../entities/market-item.entity';
import { ItemRarity } from '../constant';
import { TradeOfferEntity } from '../entities/trade-offer.entity';
import { ItemDropTierEntity } from '../entities/item-drop-tier.entity';

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

  private mapRarity = (type: string): ItemRarity => {
    try {
      return type.split(' ')[0] as ItemRarity;
    } catch (e) {
      return ItemRarity.Common;
    }
  };

  public mapDrop = (drop: DroppedItemEntity): DroppedItemDto => ({
    assetId: drop.assetId,
    matchId: drop.matchId,
    droppedAt: drop.created.toISOString(),
    expires: new Date(
      drop.created.getTime() + 1000 * 60 * 60 * 24 * 7,
    ).toISOString(),
    item: this.mapMarketItem(drop.marketItem),
    activeTradeId: drop.activeTradeOfferId,
  });

  public mapMarketItem = (item: MarketItemEntity): MarketItemDto => ({
    marketHashName: item.marketHashName,
    quality: item.quality,
    price: item.price,
    type: item.type,
    icon: item.largeIcon || item.smallIcon,
    rarity: this.mapRarity(item.type),
  });

  public mapOffer = (offer: TradeOfferEntity): TradeOfferDto => ({
    id: offer.offerId,
    incoming: offer.incoming,
    itemCount: offer.items.length,
    amount: offer.items.reduce((a, b) => a + b.price, 0),
    createdAt: offer.created.toISOString(),
  });

  public mapTier = (tier: ItemDropTierEntity): DropTierDto => ({
    id: tier.id,
    minPrice: tier.minPrice,
    maxPrice: tier.maxPrice,
    weight: tier.weight,
    count: tier.count ?? 0,
  });
}
