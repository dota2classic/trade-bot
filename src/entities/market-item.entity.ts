import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ItemQuality } from '../constant';
import { DroppedItemEntity } from './dropped-item.entity';
import { ItemDropLogEntity } from "./item-drop-log.entity";

@Entity('market_item')
@Index('market_hash_name_quality_unique', ['marketHashName', 'quality'], {
  unique: true,
})
@Index('market_item_id_unique', ['id'], { unique: true })
export class MarketItemEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({
    name: 'market_hash_name',
  })
  marketHashName: string;

  @PrimaryColumn({
    enumName: 'item_quality',
    enum: ItemQuality,
    type: 'enum',
    name: 'quality',
  })
  quality: ItemQuality;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated',
  })
  updated: Date;

  @Column({
    name: 'price',
    type: 'int',
    default: -1,
  })
  price: number;

  @Column({
    name: 'quantity',
    type: 'int',
    default: 0,
  })
  quantity: number;

  @Column({
    name: 'type',
    type: 'text',
    default: '',
  })
  type: string;

  @Column({
    name: 'large_icon',
    type: 'text',
    default: '',
  })
  largeIcon: string;

  @Column({
    name: 'small_icon',
    type: 'text',
    default: '',
  })
  smallIcon: string;

  @OneToMany(() => DroppedItemEntity, (t) => t.marketItem)
  drops: Relation<DroppedItemEntity>[];

  @OneToMany(() => ItemDropLogEntity, (t) => t.marketItem)
  dropLogs: Relation<ItemDropLogEntity>[];
}
