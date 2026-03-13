export function formatPrice(p: number) {
  const rubles = Math.floor(p / 100);
  const cops = Math.round(p % 100);
  return `${rubles}.${cops}`;
}
