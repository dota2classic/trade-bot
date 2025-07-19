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
