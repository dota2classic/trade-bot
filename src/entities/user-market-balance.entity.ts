import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_market_balance')
export class UserMarketBalanceEntity {
  @PrimaryColumn({
    name: 'steam_id',
    unique: true,
    type: 'text',
  })
  steamId: string;

  @Column({
    type: 'int',
    name: 'balance',
  })
  balance: number;


  constructor(steamId: string, balance: number) {
    this.steamId = steamId;
    this.balance = balance;
  }
}
