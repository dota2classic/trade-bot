import { calculateFairBuyPrice } from './item-drop.service';
import { CMarketItem } from '../steamexts';

function createMockMarketItem(
  overrides: Partial<CMarketItem> & { buyQuantity?: number } = {},
): CMarketItem {
  return {
    highestBuyOrder: 1000,
    lowestPrice: 1200,
    quantity: 50,
    buyQuantity: 50,
    ...overrides,
  } as CMarketItem & { buyQuantity: number };
}

describe('calculateFairBuyPrice', () => {
  describe('edge cases', () => {
    it('should return 0 when highestBuyOrder is NaN', () => {
      const item = createMockMarketItem({ highestBuyOrder: NaN });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });

    it('should return 0 when highestBuyOrder is 0', () => {
      const item = createMockMarketItem({ highestBuyOrder: 0 });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });

    it('should return 0 when highestBuyOrder is negative', () => {
      const item = createMockMarketItem({ highestBuyOrder: -100 });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });
  });

  describe('high liquidity scenarios', () => {
    it('should use 99% multiplier for high liquidity + tight spread (<15%)', () => {
      // spread = (1100 - 1000) / 1000 = 10%
      // 1000 * 0.99 = 990, but sell ceiling = 1100 * 0.85 = 935
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1100,
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(935); // capped by sell ceiling
      expect(result.reason).toBe('high_liquidity_tight_spread_capped_by_sell');
    });

    it('should apply 99% when sell ceiling is not hit', () => {
      // spread = (1500 - 1000) / 1000 = 50% > 15%, but let's use wider gap
      // Actually need: 1000 * 0.99 = 990 < lowestPrice * 0.85
      // So lowestPrice > 990 / 0.85 = 1165
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      // spread = 20% >= 15%, so it's wide spread (0.95)
      expect(result.price).toBe(950); // 1000 * 0.95
      expect(result.reason).toBe('high_liquidity_wide_spread');
    });

    it('should use 95% multiplier for high liquidity + wide spread (>=15%)', () => {
      // spread = (1200 - 1000) / 1000 = 20%
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(950); // 1000 * 0.95
      expect(result.reason).toBe('high_liquidity_wide_spread');
    });
  });

  describe('medium liquidity scenarios', () => {
    it('should use 92% multiplier for medium liquidity + reasonable spread (<20%)', () => {
      // spread = (1150 - 1000) / 1000 = 15%
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1150,
        quantity: 20,
        buyQuantity: 20,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(920); // 1000 * 0.92
      expect(result.reason).toBe('medium_liquidity');
    });

    it('should use 85% multiplier for medium liquidity + wide spread (>=20%)', () => {
      // spread = (1300 - 1000) / 1000 = 30%
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1300,
        quantity: 20,
        buyQuantity: 20,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(850); // 1000 * 0.85
      expect(result.reason).toBe('medium_liquidity_wide_spread');
    });
  });

  describe('low liquidity scenarios', () => {
    it('should use 80% multiplier for low liquidity + known spread (<30%)', () => {
      // spread = (1200 - 1000) / 1000 = 20%
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        quantity: 10,
        buyQuantity: 5,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(800); // 1000 * 0.80
      expect(result.reason).toBe('low_liquidity_known_spread');
    });

    it('should use 70% multiplier for low liquidity + wide spread (>=30%)', () => {
      // spread = (1400 - 1000) / 1000 = 40%
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1400,
        quantity: 10,
        buyQuantity: 5,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(700); // 1000 * 0.70
      expect(result.reason).toBe('low_liquidity_safe_bet');
    });

    it('should use 70% multiplier when no sell price data (NaN)', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: NaN,
        quantity: 10,
        buyQuantity: 5,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(700); // 1000 * 0.70
      expect(result.reason).toBe('low_liquidity_safe_bet');
    });

    it('should use 70% multiplier when lowestPrice is 0', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 0,
        quantity: 10,
        buyQuantity: 5,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(700); // 1000 * 0.70
      expect(result.reason).toBe('low_liquidity_safe_bet');
    });
  });

  describe('sell price ceiling', () => {
    it('should cap price at 85% of lowest sell when calculated price exceeds ceiling', () => {
      // High liquidity would give 99% = 990
      // But 85% of 1000 sell = 850, so should cap
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1000, // same as buy order (rare but possible)
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(850); // capped at 1000 * 0.85
      expect(result.reason).toContain('capped_by_sell');
    });

    it('should not cap when calculated price is below sell ceiling', () => {
      // spread = (1500 - 1000) / 1000 = 50%, low liquidity = 70%
      // 1000 * 0.70 = 700, ceiling = 1500 * 0.85 = 1275
      // 700 < 1275, so no cap
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1500,
        quantity: 5,
        buyQuantity: 5,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(700);
      expect(result.reason).not.toContain('capped_by_sell');
    });
  });

  describe('liquidity score calculation', () => {
    it('should cap individual quantities at 100 when calculating liquidity', () => {
      // 200 sell + 200 buy would be 400, but capped to 100 + 100 = 200
      // This is high liquidity (>=100)
      // Note: sell ceiling may apply
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1100,
        quantity: 200,
        buyQuantity: 200,
      });
      const result = calculateFairBuyPrice(item);

      // Sell ceiling: 1100 * 0.85 = 935 < 1000 * 0.99 = 990
      expect(result.reason).toBe('high_liquidity_tight_spread_capped_by_sell');
    });

    it('should handle missing buyQuantity', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        quantity: 10,
      });
      // Remove buyQuantity to simulate missing property
      delete (item as any).buyQuantity;

      const result = calculateFairBuyPrice(item);

      // Should treat as low liquidity (10 + 0 = 10)
      expect(result.price).toBe(800); // low_liquidity_known_spread
      expect(result.reason).toBe('low_liquidity_known_spread');
    });

    it('should handle missing quantity', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        buyQuantity: 10,
      });
      // Set quantity to undefined
      (item as any).quantity = undefined;

      const result = calculateFairBuyPrice(item);

      // Should treat as low liquidity (0 + 10 = 10)
      expect(result.price).toBe(800);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle a popular, liquid item', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 5000,
        lowestPrice: 5200,
        quantity: 100,
        buyQuantity: 80,
      });
      const result = calculateFairBuyPrice(item);

      // spread = 4%, liquidity = 180 (high)
      // 5000 * 0.99 = 4950, but sell ceiling = 5200 * 0.85 = 4420
      expect(result.price).toBe(4420); // capped by sell ceiling
      expect(result.reason).toBe('high_liquidity_tight_spread_capped_by_sell');
    });

    it('should handle a rare, illiquid item', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 50000,
        lowestPrice: 80000,
        quantity: 3,
        buyQuantity: 2,
      });
      const result = calculateFairBuyPrice(item);

      // spread = 60%, liquidity = 5 (low)
      expect(result.price).toBe(35000); // 50000 * 0.70
      expect(result.reason).toBe('low_liquidity_safe_bet');
    });

    it('should handle an item with no sell listings', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 10000,
        lowestPrice: 0,
        quantity: 0,
        buyQuantity: 15,
      });
      const result = calculateFairBuyPrice(item);

      // No sell price = unknown spread, low liquidity
      expect(result.price).toBe(7000); // 10000 * 0.70
      expect(result.reason).toBe('low_liquidity_safe_bet');
    });
  });
});
