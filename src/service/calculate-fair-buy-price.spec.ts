import { calculateFairBuyPrice } from './item-drop.service';
import { CMarketItem } from '../steamexts';

interface MockMarketItemOptions {
  highestBuyOrder?: number;
  lowestPrice?: number;
  quantity?: number;
  buyQuantity?: number;
  medianSalePrices?: Array<{ hour: Date; price: number; quantity: number }>;
}

function createMockMarketItem(
  overrides: MockMarketItemOptions = {},
): CMarketItem {
  return {
    highestBuyOrder: 1000,
    lowestPrice: 1200,
    quantity: 50,
    buyQuantity: 50,
    medianSalePrices: [],
    ...overrides,
  } as CMarketItem;
}

function createMedianSales(
  prices: number[],
  quantity = 5,
): Array<{ hour: Date; price: number; quantity: number }> {
  return prices.map((price, i) => ({
    hour: new Date(Date.now() - i * 3600000),
    price, // in float format like 3.23 for 323 cents
    quantity,
  }));
}

describe('calculateFairBuyPrice', () => {
  describe('edge cases', () => {
    it('should return 0 when highestBuyOrder is NaN and no sell orders', () => {
      const item = createMockMarketItem({
        highestBuyOrder: NaN,
        lowestPrice: 0,
        quantity: 0,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });

    it('should return 0 when highestBuyOrder is 0 and no sell orders', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 0,
        lowestPrice: 0,
        quantity: 0,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });

    it('should return 0 when highestBuyOrder is negative and no sell orders', () => {
      const item = createMockMarketItem({
        highestBuyOrder: -100,
        lowestPrice: 0,
        quantity: 0,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });

    it('should use 90% of sell price when no buy orders but 5+ sell orders', () => {
      const item = createMockMarketItem({
        highestBuyOrder: NaN,
        lowestPrice: 500,
        quantity: 20, // 20 sell orders
        buyQuantity: 0,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(450); // 500 * 0.9
      expect(result.reason).toBe('no_buy_orders_use_sell');
    });

    it('should return 0 when no buy orders and fewer than 5 sell orders', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 0,
        lowestPrice: 500,
        quantity: 3, // only 3 sell orders - not reliable
        buyQuantity: 0,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(0);
      expect(result.reason).toBe('no_buy_orders');
    });
  });

  describe('high liquidity (100+ combined orders)', () => {
    it('should use mid-price (50% into spread), capped by sell ceiling', () => {
      // highestBuy: 1000, lowestSell: 1200, spread: 200
      // mid-price = 1000 + 200 * 0.5 = 1100
      // ceiling = 1200 * 0.9 = 1080
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(1080); // capped at 90% of sell
      expect(result.reason).toBe('high_liquidity_mid_price_capped_by_sell');
    });

    it('should use full mid-price when ceiling is not hit', () => {
      // highestBuy: 1000, lowestSell: 1500, spread: 500
      // mid-price = 1000 + 500 * 0.5 = 1250
      // ceiling = 1500 * 0.9 = 1350 (not hit)
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1500,
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(1250);
      expect(result.reason).toBe('high_liquidity_mid_price');
    });

    it('should cap at 90% of lowest sell', () => {
      // highestBuy: 900, lowestSell: 1000, spread: 100
      // mid-price = 900 + 100 * 0.5 = 950
      // ceiling = 1000 * 0.9 = 900
      const item = createMockMarketItem({
        highestBuyOrder: 900,
        lowestPrice: 1000,
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(900);
      expect(result.reason).toBe('high_liquidity_mid_price_capped_by_sell');
    });
  });

  describe('medium liquidity (30-100 combined orders)', () => {
    it('should position 30% into spread', () => {
      // highestBuy: 1000, lowestSell: 1200, spread: 200
      // price = 1000 + 200 * 0.3 = 1060
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1200,
        quantity: 20,
        buyQuantity: 20,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(1060);
      expect(result.reason).toBe('medium_liquidity_spread');
    });

    it('should cap at 90% of lowest sell', () => {
      // highestBuy: 900, lowestSell: 950, spread: 50
      // price = 900 + 50 * 0.3 = 915
      // ceiling = 950 * 0.9 = 855
      const item = createMockMarketItem({
        highestBuyOrder: 900,
        lowestPrice: 950,
        quantity: 20,
        buyQuantity: 20,
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(900); // floored to buy since 855 < 900
      expect(result.reason).toBe(
        'medium_liquidity_spread_capped_by_sell_floored_to_buy',
      );
    });
  });

  describe('low liquidity with median history', () => {
    it('should use median price as reference, position 40% toward it', () => {
      // highestBuy: 371, median: 480 (4.80 in float), lowestSell: 539
      // spreadToMedian = 480 - 371 = 109
      // price = 371 + 109 * 0.4 = 414
      const item = createMockMarketItem({
        highestBuyOrder: 371,
        lowestPrice: 539,
        quantity: 5,
        buyQuantity: 5,
        medianSalePrices: createMedianSales([4.8, 4.9, 4.7, 4.85, 4.75]),
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(414);
      expect(result.reason).toBe('low_liquidity_median_based');
    });

    it('should still cap at 90% of lowest sell', () => {
      // highestBuy: 400, median: 500 (5.00), lowestSell: 420
      // spreadToMedian = 500 - 400 = 100
      // price = 400 + 100 * 0.4 = 440
      // ceiling = 420 * 0.9 = 378
      // But floor is 400, so price = 400
      const item = createMockMarketItem({
        highestBuyOrder: 400,
        lowestPrice: 420,
        quantity: 5,
        buyQuantity: 5,
        medianSalePrices: createMedianSales([5.0, 5.1, 4.9]),
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(400);
      expect(result.reason).toBe(
        'low_liquidity_median_based_capped_by_sell_floored_to_buy',
      );
    });
  });

  describe('low liquidity without median history', () => {
    it('should beat highest buy by 10%', () => {
      // highestBuy: 1000
      // price = 1000 * 1.1 = 1100
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 0, // no sell data
        quantity: 5,
        buyQuantity: 5,
        medianSalePrices: [],
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(1100);
      expect(result.reason).toBe('low_liquidity_beat_buy');
    });

    it('should beat highest buy even when lowestSell exists but no median', () => {
      // Without median and with crazy high lowestSell, should just beat buy
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 5000, // crazy high sell
        quantity: 1,
        buyQuantity: 2,
        medianSalePrices: [],
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(1100); // 1000 * 1.1
      expect(result.reason).toBe('low_liquidity_beat_buy');
    });

    it('should cap at 90% of sell even when beating buy', () => {
      // highestBuy: 1000, lowestSell: 1050
      // price = 1000 * 1.1 = 1100
      // ceiling = 1050 * 0.9 = 945
      // floor = 1000
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1050,
        quantity: 2,
        buyQuantity: 2,
        medianSalePrices: [],
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(1000); // floored to buy
      expect(result.reason).toBe(
        'low_liquidity_beat_buy_capped_by_sell_floored_to_buy',
      );
    });
  });

  describe('floor to highest buy order', () => {
    it('should never go below highest buy order', () => {
      // Edge case where calculations might go below
      const item = createMockMarketItem({
        highestBuyOrder: 1000,
        lowestPrice: 1010, // very tight spread
        quantity: 60,
        buyQuantity: 60,
      });
      const result = calculateFairBuyPrice(item);

      // mid-price = 1000 + 10 * 0.5 = 1005
      // ceiling = 1010 * 0.9 = 909
      // floored to 1000
      expect(result.price).toBe(1000);
      expect(result.reason).toContain('floored_to_buy');
    });
  });

  describe('median price calculation', () => {
    it('should use median of recent sales', () => {
      // Prices: 4.0, 5.0, 6.0 -> median = 5.0 = 500 cents
      // highestBuy: 400, spreadToMedian: 100
      // price = 400 + 100 * 0.4 = 440
      const item = createMockMarketItem({
        highestBuyOrder: 400,
        lowestPrice: 800,
        quantity: 3,
        buyQuantity: 3,
        medianSalePrices: createMedianSales([4.0, 5.0, 6.0]),
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(440);
      expect(result.reason).toBe('low_liquidity_median_based');
    });

    it('should ignore entries with 0 quantity', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 400,
        lowestPrice: 800,
        quantity: 3,
        buyQuantity: 3,
        medianSalePrices: [
          { hour: new Date(), price: 5.0, quantity: 5 },
          { hour: new Date(), price: 10.0, quantity: 0 }, // should be ignored
          { hour: new Date(), price: 5.0, quantity: 3 },
        ],
      });
      const result = calculateFairBuyPrice(item);

      // median of [5.0, 5.0] = 5.0 = 500 cents
      // price = 400 + 100 * 0.4 = 440
      expect(result.price).toBe(440);
    });

    it('should fall back to beat_buy when median is below highest buy', () => {
      // If median sales are below current buy orders, don't use them
      const item = createMockMarketItem({
        highestBuyOrder: 500,
        lowestPrice: 800,
        quantity: 3,
        buyQuantity: 3,
        medianSalePrices: createMedianSales([3.0, 3.5, 4.0]), // 300-400 cents
      });
      const result = calculateFairBuyPrice(item);

      expect(result.price).toBe(550); // 500 * 1.1
      expect(result.reason).toBe('low_liquidity_beat_buy');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle user example: buy=371, sell=539, want ~480', () => {
      // With medium sales history around 4.80 (480 cents)
      const item = createMockMarketItem({
        highestBuyOrder: 371,
        lowestPrice: 539,
        quantity: 10,
        buyQuantity: 8,
        medianSalePrices: createMedianSales([4.75, 4.85, 4.8, 4.9, 4.7]),
      });
      const result = calculateFairBuyPrice(item);

      // median ~= 480, spreadToMedian = 109
      // price = 371 + 109 * 0.4 = 414
      expect(result.price).toBeGreaterThan(371);
      expect(result.price).toBeLessThan(539);
      expect(result.reason).toBe('low_liquidity_median_based');
    });

    it('should handle popular liquid item', () => {
      // For high liquidity with tight spread, ceiling often applies
      const item = createMockMarketItem({
        highestBuyOrder: 5000,
        lowestPrice: 6000, // wider spread so ceiling doesn't hit
        quantity: 150,
        buyQuantity: 120,
      });
      const result = calculateFairBuyPrice(item);

      // spread = 1000, mid-price = 5000 + 1000 * 0.5 = 5500
      // ceiling = 6000 * 0.9 = 5400 (hits ceiling)
      expect(result.price).toBe(5400);
      expect(result.reason).toBe('high_liquidity_mid_price_capped_by_sell');
    });

    it('should handle rare item with crazy sell price', () => {
      const item = createMockMarketItem({
        highestBuyOrder: 10000,
        lowestPrice: 50000, // someone listing 5x the buy
        quantity: 1,
        buyQuantity: 3,
        medianSalePrices: [], // no history
      });
      const result = calculateFairBuyPrice(item);

      // Just beat buy by 10%
      expect(result.price).toBe(11000);
      expect(result.reason).toBe('low_liquidity_beat_buy');
    });
  });
});
