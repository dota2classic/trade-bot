import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TradeOfferItemEntity } from './trade-offer-item.entity';
import { TradeOfferStatus } from '../constant';

@Entity('trade_offer')
@Unique('unique_trade_offer_id', ['id'])
export class TradeOfferEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @PrimaryColumn({
    unique: true,
    name: 'offer_id',
  })
  offerId: string;

  @Column({
    name: 'trade_id',
    nullable: true,
  })
  tradeId: string;

  @Column({
    name: 'status',
    enum: TradeOfferStatus,
    enumName: 'trade_offer_status',
    type: 'enum',
    default: 'pending',
  })
  status: TradeOfferStatus;

  @Column({
    name: 'steam_id',
  })
  steamId: string;

  @CreateDateColumn({
    name: 'created',
    type: 'timestamptz',
  })
  created: Date;

  @UpdateDateColumn({
    name: 'updated',
    type: 'timestamptz',
  })
  updated: Date;

  @OneToMany(() => TradeOfferItemEntity, (t) => t.offer)
  items: Relation<TradeOfferItemEntity>[];

  constructor(offerId: string, steamId: string, status: TradeOfferStatus) {
    this.offerId = offerId;
    this.steamId = steamId;
    this.status = status;
  }
}
