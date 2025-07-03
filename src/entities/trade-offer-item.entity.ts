import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MarketItemEntity } from './market-item.entity';
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

  @ManyToOne(() => MarketItemEntity, (t) => t.traded, { eager: true })
  @JoinColumn({
    name: 'item_id',
    referencedColumnName: 'id',
  })
  item: MarketItemEntity;

  @Column({
    name: 'item_id',
  })
  itemId: number;

  @Column({
    name: 'price',
    type: 'int',
    default: -1,
  })
  price: number;

  constructor(offerId: number, itemId: number, price: number) {
    this.offerId = offerId;
    this.itemId = itemId;
    this.price = price;
  }
}
