import CMarketItem2 from 'steamcommunity/classes/CMarketItem';
import CEconItem from 'steamcommunity/classes/CEconItem';

export declare class CMarketItem extends CMarketItem2 {
  highestBuyOrder: number;
  assets: CEconItem[];
  firstAsset: CEconItem;
}
