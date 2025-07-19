import { ItemQuality } from '../constant';

export function toMarketHashName(item: {
  quality: ItemQuality;
  marketHashName: string;
}) {
  const prefix = item.quality === ItemQuality.Standard ? [] : [item.quality];

  return [...prefix, item.marketHashName].join(' ');
}


export function toMarketHashNameParts(marketHashName: string, quality: ItemQuality) {
  const prefix = quality === ItemQuality.Standard ? [] : [quality];

  return [...prefix, marketHashName].join(' ');
}
