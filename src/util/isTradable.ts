import { CEconItem } from '../steamexts';

export function isTradable(item: CEconItem) {
  const tradeCooldown = item.owner_descriptions?.find((t) =>
    t.value.includes('Нельзя обменять до'),
  );

  return item.tradable || !!tradeCooldown;
}
