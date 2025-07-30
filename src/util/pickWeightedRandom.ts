type WeightedItem<T> = T & { weight: number };

export function weightedRandom<T>(items: WeightedItem<T>[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const rand = Math.random() * totalWeight;

  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (rand < cumulative) {
      return item;
    }
  }

  // Should never reach here if weights are valid
  throw new Error("Invalid weight distribution");
}
