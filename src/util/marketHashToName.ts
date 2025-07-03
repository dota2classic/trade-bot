import { ItemQualities, ItemQuality } from '../constant';

export function marketHashToSelectorName(marketHashName: string): {
  marketHashName: string;
  quality: ItemQuality;
} {
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
