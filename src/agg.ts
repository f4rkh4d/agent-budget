import { type Entry, iterEntries } from "./parse";
import { costUsd, type Tokens } from "./pricing";

export interface Bucket {
  key: string;
  cost: number;
  tokens: Tokens;
  byModel: Record<string, { cost: number; tokens: Tokens }>;
  count: number;
}

const zeroTokens = (): Tokens => ({
  input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0,
});

function addTokens(a: Tokens, b: Tokens): void {
  a.input += b.input;
  a.output += b.output;
  a.cacheWrite5m += b.cacheWrite5m;
  a.cacheWrite1h += b.cacheWrite1h;
  a.cacheRead += b.cacheRead;
}

function bucketize(
  entries: Iterable<Entry>,
  keyFn: (e: Entry) => string,
): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const e of entries) {
    const k = keyFn(e);
    let b = m.get(k);
    if (!b) {
      b = { key: k, cost: 0, tokens: zeroTokens(), byModel: {}, count: 0 };
      m.set(k, b);
    }
    const c = costUsd(e.tokens, e.model);
    b.cost += c;
    b.count += 1;
    addTokens(b.tokens, e.tokens);
    const mk = b.byModel[e.model] ?? { cost: 0, tokens: zeroTokens() };
    mk.cost += c;
    addTokens(mk.tokens, e.tokens);
    b.byModel[e.model] = mk;
  }
  return [...m.values()].sort((x, y) => y.cost - x.cost);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function aggToday(): Bucket[] {
  const since = startOfDay(new Date());
  return bucketize(iterEntries({ since }), (e) => e.project);
}

export function aggSince(since: Date, group: "project" | "day" | "session"): Bucket[] {
  return bucketize(iterEntries({ since }), (e) => {
    if (group === "project") return e.project;
    if (group === "day") return ymd(new Date(e.timestamp));
    return `${e.project}::${e.sessionId}`;
  });
}

export function aggAll(group: "project" | "day" | "session"): Bucket[] {
  return bucketize(iterEntries(), (e) => {
    if (group === "project") return e.project;
    if (group === "day") return ymd(new Date(e.timestamp));
    return `${e.project}::${e.sessionId}`;
  });
}
