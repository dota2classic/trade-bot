import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import { MarketItemEntity } from './market-item.entity';
import { ItemQuality } from '../constant';

// Item dropped to a player and now belongs to them until expired.
@Entity('dropped_item')
export class DroppedItemEntity {
  @PrimaryColumn({
    name: 'assetid',
  })
  assetId: string;

  @Column({
    name: 'steam_id',
  })
  steamId: string;

  @Column({
    name: 'match_id',
  })
  matchId: number;

  @CreateDateColumn({
    name: 'created',
  })
  created: Date;

  @ManyToOne(() => MarketItemEntity, (t) => t.drops)
  @JoinColumn([
    {
      name: 'market_hash_name',
      referencedColumnName: 'marketHashName',
    },
    {
      name: 'quality',
      referencedColumnName: 'quality',
    },
  ])
  marketItem: Relation<MarketItemEntity>;

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

  constructor(
    assetId: string,
    matchId: number,
    steamId: string,
    marketHashName: string,
    quality: ItemQuality,
  ) {
    this.assetId = assetId;
    this.steamId = steamId;
    this.matchId = matchId;
    this.marketHashName = marketHashName;
    this.quality = quality;
  }
}
