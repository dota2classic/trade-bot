import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TradeOfferEntity } from './trade-offer.entity';

@Entity('trade_offer_item')
export class TradeOfferItemEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => TradeOfferEntity, (t) => t.items)
  @JoinColumn({
    name: 'offer_id',
    referencedColumnName: 'id',
  })
  offer: TradeOfferEntity;

  @Column({
    name: 'offer_id',
  })
  offerId: number;

  @Column({
    name: 'market_hash_name',
    default: '',
    type: "text"
  })
  marketHashName: string;

  @Column({
    name: 'price',
    type: 'int',
    default: -1,
  })
  price: number;

  constructor(offerId: number, marketHashName: string, price: number) {
    this.offerId = offerId;
    this.marketHashName = marketHashName;
    this.price = price;
  }
}
