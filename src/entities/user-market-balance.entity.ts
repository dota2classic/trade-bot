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
    default: 0,
  })
  balance: number;

  @Column({
    type: 'text',
    name: 'trade_link',
    nullable: true,
  })
  tradeLink: string;

  constructor(steamId: string, balance: number) {
    this.steamId = steamId;
    this.balance = balance;
  }
}
