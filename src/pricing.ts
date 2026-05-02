/**
 * Per-million-token USD prices for Anthropic models. Cache write splits
 * 5m vs 1h ephemeral. Cache read is the same regardless of TTL.
 *
 * Source: https://www.anthropic.com/pricing (May 2026 list prices).
 */

export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
}

const PRICES: Record<string, ModelPrice> = {
  // Opus 4.x family
  "claude-opus-4-7": { input: 15, output: 75, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5 },
  "claude-opus-4-6": { input: 15, output: 75, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5 },
  "claude-opus-4-5": { input: 15, output: 75, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5 },
  "claude-opus-4": { input: 15, output: 75, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5 },

  // Sonnet 4.x
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3 },
  "claude-sonnet-4": { input: 3, output: 15, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3 },

  // Haiku 4.x
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1 },
  "claude-haiku-4": { input: 1, output: 5, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1 },

  // Legacy 3.x — best effort fallback
  "claude-3-5-sonnet": { input: 3, output: 15, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3 },
  "claude-3-5-haiku": { input: 0.8, output: 4, cacheWrite5m: 1, cacheWrite1h: 1.6, cacheRead: 0.08 },
  "claude-3-opus": { input: 15, output: 75, cacheWrite5m: 18.75, cacheWrite1h: 30, cacheRead: 1.5 },
};

const FAMILY: Array<[RegExp, ModelPrice]> = [
  [/opus/i, PRICES["claude-opus-4-7"]!],
  [/sonnet/i, PRICES["claude-sonnet-4-6"]!],
  [/haiku/i, PRICES["claude-haiku-4-5"]!],
];

export function priceFor(model: string): ModelPrice {
  const exact = PRICES[model];
  if (exact) return exact;
  // Strip suffixes like [1m] or trailing -date stamps then retry exact.
  const stripped = model.replace(/\[.*?\]/g, "").replace(/-\d{8}$/, "");
  if (PRICES[stripped]) return PRICES[stripped]!;
  for (const [re, p] of FAMILY) if (re.test(model)) return p;
  // Unknown model — assume Sonnet rates so it's neither free nor outrageous.
  return PRICES["claude-sonnet-4-6"]!;
}

export interface Tokens {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
}

export function costUsd(t: Tokens, model: string): number {
  const p = priceFor(model);
  return (
    (t.input * p.input +
      t.output * p.output +
      t.cacheWrite5m * p.cacheWrite5m +
      t.cacheWrite1h * p.cacheWrite1h +
      t.cacheRead * p.cacheRead) /
    1_000_000
  );
}
