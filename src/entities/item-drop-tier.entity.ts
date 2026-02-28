import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { VirtualColumn2 } from '../util/virtual-column';

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

  @VirtualColumn2('count', (v) => parseInt(v) || 0)
  count?: number;
}
