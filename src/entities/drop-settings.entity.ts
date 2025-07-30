import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('item_drop_settings')
export class DropSettingsEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({
    name: 'base_drop_chance',
    type: 'float',
  })
  baseDropChance: number;

  @Column({
    name: 'subsequent_drop_chance',
    type: 'float',
  })
  subsequentDropChance: number;

  @Column({
    name: 'desired_stock',
    type: 'int',
    default: 0,
  })
  desiredStock: number;
}
