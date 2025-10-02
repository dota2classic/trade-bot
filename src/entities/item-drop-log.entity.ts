import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { MarketItemEntity } from './market-item.entity';
import { ItemQuality } from '../constant';

@Entity('item_drop_log')
export class ItemDropLogEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({
    name: 'steam_id',
  })
  steamId: string;

  @Column({
    name: 'match_id',
    nullable: true,
  })
  matchId: number;

  @Column({
    name: 'asset_id',
  })
  assetId: string;

  @ManyToOne(() => MarketItemEntity, (t) => t.dropLogs)
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
  @Column({
    type: 'int',
    name: 'price',
  })
  price: number;

  @CreateDateColumn({
    name: 'created',
  })
  created: Date;

  constructor(
    steamId: string,
    matchId: number,
    assetId: string,
    marketHashName: string,
    quality: ItemQuality,
    price: number,
  ) {
    this.steamId = steamId;
    this.matchId = matchId;
    this.assetId = assetId;
    this.marketHashName = marketHashName;
    this.quality = quality;
    this.price = price;
  }
}
