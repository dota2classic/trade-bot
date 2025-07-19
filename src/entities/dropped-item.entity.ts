import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

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

  @CreateDateColumn({
    name: 'created',
  })
  created: Date;


  constructor(assetId: string, steamId: string) {
    this.assetId = assetId;
    this.steamId = steamId;
  }
}
