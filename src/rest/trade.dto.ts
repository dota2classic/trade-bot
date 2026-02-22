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

export class DropItemDto {
  tierId: number;
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


export class DropTierDto {
  minPrice: number;
  maxPrice: number;
  id: number;
  weight: number;
}

export class UpdateDropTierDto {
  minPrice?: number;
  maxPrice?: number;
  weight?: number;
}


export class CreateDropTierDto {
  minPrice: number;
  maxPrice: number;
  weight: number;
}


export class DropSettingsDto {
  baseDropChance: number;
  subsequentDropChance: number;
  desiredStock: number;
}


export class UpdateDropSettingsDto {
  baseDropChance?: number;
  subsequentDropChance?: number;
  desiredStock?: number;
}
