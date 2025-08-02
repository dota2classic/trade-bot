import { ItemQuality, ItemRarity } from "../constant";
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  steamId: string;
  balance: number;
  tradeLink: string;
}

export class UpdateUserDto {
  tradeLink: string;
}

export class MarketItemDto {
  marketHashName: string;

  @ApiProperty({ enum: ItemQuality, enumName: 'ItemQuality' })
  quality: ItemQuality;

  price: number;

  icon: string;
  type: string;

  @ApiProperty({ enum: ItemRarity, enumName: 'ItemRarity' })
  rarity: ItemRarity
}

export class DroppedItemDto {
  assetId: string;
  matchId: number;
  droppedAt: string;
  expires: string;
  item: MarketItemDto;
  activeTradeId?: string;
}


export class TradeOfferDto {
  id: string;
  amount: number;
  itemCount: number;
  incoming: boolean;
  createdAt: string;
}


export class PurchaseDto {
  amount: number;
}
