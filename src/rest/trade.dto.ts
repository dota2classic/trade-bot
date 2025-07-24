import { ItemQuality } from '../constant';
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
}

export class DroppedItemDto {
  matchId: number;
  droppedAt: string;
  expires: string;
  item: MarketItemDto;
}
