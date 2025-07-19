import { CEconItem } from '../steamexts';

export function isTradable(item: CEconItem) {
  const tradeCooldown = item.owner_descriptions?.find((t) =>
    t.value.includes('On Trade Cooldown Until: '),
  );

  return item.tradable || !!tradeCooldown;
}
