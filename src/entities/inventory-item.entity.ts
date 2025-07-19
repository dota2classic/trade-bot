import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ItemQuality } from '../constant';

@Entity('inventory_item')
export class InventoryItemEntity {
  @PrimaryColumn({
    name: 'assetid',
  })
  assetId: string;

  @Column({
    name: 'market_hash_name',
  })
  marketHashName: string;

  @Column({
    enumName: 'item_quality',
    enum: ItemQuality,
    type: 'enum',
    name: 'quality',
  })
  quality: ItemQuality;

  @Column()
  tradable: boolean;

  @Column()
  marketable: boolean;

  @Column({
    name: 'trade_cooldown_until',
    nullable: true,
  })
  tradeCooldownUntil?: Date;

  constructor(
    assetId: string,
    marketHashName: string,
    quality: ItemQuality,
    tradable: boolean,
    marketable: boolean,
    tradeCooldownUntil: Date,
  ) {
    this.assetId = assetId;
    this.marketHashName = marketHashName;
    this.quality = quality;
    this.tradable = tradable;
    this.marketable = marketable;
    this.tradeCooldownUntil = tradeCooldownUntil;
  }
}
