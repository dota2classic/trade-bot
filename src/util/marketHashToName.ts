import { ItemQualities, ItemQuality } from '../constant';

export interface MarketItemSelector {
  quality: ItemQuality;
  marketHashName: string;
}
export function marketHashToSelectorName(marketHashName: string): MarketItemSelector {
  let itemName = marketHashName;
  const first = marketHashName.split(' ')[0];
  let quality = ItemQualities.find((quality) => quality === first);
  if (quality) {
    itemName = itemName.replace(`${quality} `, '');
  } else {
    quality = ItemQuality.Standard;
  }

  return {
    marketHashName: itemName,
    quality,
  };
}
