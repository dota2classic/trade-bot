export function formatPrice(p: number) {
  const rubles = Math.floor(p / 100);
  const cops = p % 100;
  return `${rubles}.${cops}`;
}
