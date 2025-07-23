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

  @Column({
    name: 'match_id',
  })
  matchId: number;

  @CreateDateColumn({
    name: 'created',
  })
  created: Date;


  constructor(assetId: string, matchId: number, steamId: string) {
    this.assetId = assetId;
    this.steamId = steamId;
    this.matchId = matchId;
  }
}
