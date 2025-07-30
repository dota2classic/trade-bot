import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('item_drop_tier')
export class ItemDropTierEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({
    name: 'price_min',
    type: 'int',
  })
  minPrice: number;

  @Column({
    name: 'price_max',
    type: 'int',
  })
  maxPrice: number;

  @Column({
    name: 'weight',
    type: 'float',
  })
  weight: number;
}

