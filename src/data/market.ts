/**
 * Market resource trading — deterministic exchange rates driven by Commerce research.
 *
 * ## Rates formula
 *
 * All trades go through *wealth* as the intermediary currency.
 *
 * Selling a resource (resource → wealth):
 *   sellRate(resource, com) = BASE_SELL[resource] + com * SELL_STEP[resource]
 *   wealth received = amount × sellRate
 *
 * Buying a resource (wealth → resource):
 *   buyCost(resource, com) = max(FLOOR_BUY[resource], BASE_BUY[resource] − com * BUY_STEP[resource])
 *   wealth spent = amount × buyCost
 *
 * At com=0 the spread is intentionally unfavourable (sell low, buy high).
 * Each Commerce level closes the spread; at com=5 rates are close to parity.
 *
 * ## How to test (manual)
 *   1. Open the browser game.
 *   2. Research Commerce at least once.
 *   3. Build a Market (M key with a citizen selected).
 *   4. Select the Market — the HUD panel shows current rates.
 *   5. Press U (sell 50 food), I (buy 20 metal), O (sell 50 timber), P (buy 50 timber).
 *   6. Confirm wealth changes match the displayed rates.
 *   7. Confirm that attempting a trade without sufficient resources shows a toast message.
 *
 * ## Unit tests (no test runner present in this repo, but you can run:)
 *   npx tsx src/data/market.ts   — uncomment the self-test block at the bottom.
 */

export type TradeResource = 'food' | 'timber' | 'metal';

export interface ExchangeRates {
  /** Wealth received per unit sold */
  sellFood: number;
  sellTimber: number;
  sellMetal: number;
  /** Wealth cost per unit bought */
  buyFood: number;
  buyTimber: number;
  buyMetal: number;
}

// Base sell rates (wealth per unit) at Commerce level 0
const BASE_SELL: Record<TradeResource, number> = {
  food: 0.30,
  timber: 0.40,
  metal: 0.70,
};
const SELL_STEP: Record<TradeResource, number> = {
  food: 0.05,
  timber: 0.06,
  metal: 0.08,
};

// Base buy costs (wealth per unit) at Commerce level 0
const BASE_BUY: Record<TradeResource, number> = {
  food: 0.90,
  timber: 1.10,
  metal: 2.20,
};
const BUY_STEP: Record<TradeResource, number> = {
  food: 0.08,
  timber: 0.10,
  metal: 0.20,
};
const FLOOR_BUY: Record<TradeResource, number> = {
  food: 0.45,
  timber: 0.55,
  metal: 1.10,
};

/** Return current exchange rates given a Commerce research level (integer ≥ 0). */
export function getExchangeRates(commerceLevel: number): ExchangeRates {
  const com = Math.max(0, commerceLevel);
  const sellRate = (r: TradeResource) => BASE_SELL[r] + com * SELL_STEP[r];
  const buyRate = (r: TradeResource) =>
    Math.max(FLOOR_BUY[r], BASE_BUY[r] - com * BUY_STEP[r]);
  return {
    sellFood: sellRate('food'),
    sellTimber: sellRate('timber'),
    sellMetal: sellRate('metal'),
    buyFood: buyRate('food'),
    buyTimber: buyRate('timber'),
    buyMetal: buyRate('metal'),
  };
}

export interface TradeResources {
  food: number;
  timber: number;
  metal: number;
  wealth: number;
}

export interface TradeResult {
  ok: boolean;
  reason?: string;
  /** Deltas applied when ok=true */
  delta?: Partial<TradeResources>;
}

/**
 * Check whether a trade is valid without mutating any state.
 * `hasMarket` must reflect whether the player actually owns a market building.
 */
export function canTrade(
  resources: TradeResources,
  from: TradeResource | 'wealth',
  to: TradeResource | 'wealth',
  amount: number,
  commerceLevel: number,
  hasMarket: boolean
): TradeResult {
  if (!hasMarket) {
    return { ok: false, reason: 'No market building' };
  }
  if (amount <= 0) {
    return { ok: false, reason: 'Amount must be positive' };
  }
  if (from === to) {
    return { ok: false, reason: 'Cannot trade a resource for itself' };
  }

  const rates = getExchangeRates(commerceLevel);

  // Selling a resource for wealth
  if (to === 'wealth' && from !== 'wealth') {
    const res = from as TradeResource;
    if (resources[res] < amount) {
      return { ok: false, reason: `Not enough ${res} (need ${amount}, have ${Math.floor(resources[res])})` };
    }
    const wealthGain = amount * rates[`sell${cap(res)}` as keyof ExchangeRates];
    return { ok: true, delta: { [res]: -amount, wealth: wealthGain } };
  }

  // Buying a resource with wealth
  if (from === 'wealth' && to !== 'wealth') {
    const res = to as TradeResource;
    const cost = amount * rates[`buy${cap(res)}` as keyof ExchangeRates];
    if (resources.wealth < cost) {
      return { ok: false, reason: `Not enough wealth (need ${cost.toFixed(1)}, have ${Math.floor(resources.wealth)})` };
    }
    return { ok: true, delta: { wealth: -cost, [res]: amount } };
  }

  // Resource-to-resource: sell from → wealth → buy to (two-step, atomic)
  if (from !== 'wealth' && to !== 'wealth') {
    const fromRes = from as TradeResource;
    const toRes = to as TradeResource;
    if (resources[fromRes] < amount) {
      return { ok: false, reason: `Not enough ${fromRes} (need ${amount}, have ${Math.floor(resources[fromRes])})` };
    }
    const wealthGain = amount * rates[`sell${cap(fromRes)}` as keyof ExchangeRates];
    const totalWealth = resources.wealth + wealthGain;
    const unitCost = rates[`buy${cap(toRes)}` as keyof ExchangeRates];
    const toAmount = wealthGain / unitCost;
    const wealthCost = toAmount * unitCost;
    if (totalWealth < wealthCost) {
      return { ok: false, reason: `Not enough wealth after selling ${fromRes}` };
    }
    return {
      ok: true,
      delta: { [fromRes]: -amount, [toRes]: toAmount },
    };
  }

  return { ok: false, reason: 'Invalid trade parameters' };
}

/**
 * Execute a trade against a mutable resources object.
 * Returns the TradeResult; if ok, resources have been updated in place.
 */
export function executeTrade(
  resources: TradeResources,
  from: TradeResource | 'wealth',
  to: TradeResource | 'wealth',
  amount: number,
  commerceLevel: number,
  hasMarket: boolean
): TradeResult {
  const result = canTrade(resources, from, to, amount, commerceLevel, hasMarket);
  if (!result.ok || !result.delta) return result;
  for (const [key, value] of Object.entries(result.delta) as [keyof TradeResources, number][]) {
    resources[key] = (resources[key] ?? 0) + value;
  }
  return result;
}

/** Capitalise first letter helper. */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
