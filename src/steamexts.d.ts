import CMarketItem2 from 'steamcommunity/classes/CMarketItem';
import CEconItem2 from 'steamcommunity/classes/CEconItem';

export declare class CMarketItem extends CMarketItem2 {
  highestBuyOrder: number;
  assets: CEconItem[];
  firstAsset: CEconItem;
  _hashName: string;
}

export declare class CEconItem extends CEconItem2 {
  owner_descriptions: { value: string }[];
  icon_url_large: string;
  icon_url: string;
}

export interface TradeOfferRawJson {
  tradeofferid: string;
  accountid_other: number;
  message: string;
  expiration_time: number;
  trade_offer_state: number;
  items_to_give: ItemsToGive[];
  is_our_offer: boolean;
  time_created: number;
  time_updated: number;
  tradeid: string;
  from_real_time_trade: boolean;
  escrow_end_date: number;
  confirmation_method: number;
  eresult: number;
  delay_settlement: boolean;
  settlement_date: number;
}

export interface ItemsToGive {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  missing: boolean;
  est_usd: string;
}
