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
import { TradeOfferItemEntity } from './trade-offer-item.entity';

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
    name: 'type',
    type: 'text',
    default: '',
  })
  type: string;

  @OneToMany(() => TradeOfferItemEntity, (t) => t.item)
  traded: Relation<TradeOfferItemEntity>[];
}
