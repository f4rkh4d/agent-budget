# agent-budget

See what your Claude Code agents are actually costing you.

Reads `~/.claude/projects/<encoded-cwd>/<session>.jsonl` — the transcript files Claude Code already writes — and converts them into a USD bill using current Anthropic list prices. No telemetry, no extra config, no API keys. Just `ab today` and you know.

```
$ ab today
today (2026-05-02)  $1069

  /Users/bennett/Projects     ████████████████████████   $1067  in 1k · out 801k · cache r/w 568M/5M
  /Users/bennett/Desktop/...  █                          $1.83  in 78 · out 1k · cache r/w 3M/134k
```

```
$ ab top 5
top 5 sessions, all-time  $16709

  /Users/bennett/Projects::2b47b4dd... ██████  $3971
  /Users/bennett/Projects::cf17f347... █████   $3665
  ...
```

## Why

Claude Code shows you tokens, not money. If you're paying per token (API or any pay-as-you-go plan), you have no idea which project is the budget hole until the invoice arrives. `agent-budget` is the answer key.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/f4rkh4d/agent-budget/main/install.sh | bash
```

Or grab a binary from [Releases](https://github.com/f4rkh4d/agent-budget/releases).

Or build from source:

```sh
bun install     # nothing to install actually, no deps
bun run build
./dist/ab today
```

## Commands

| | |
|---|---|
| `ab today` | spend so far today, by project |
| `ab week` | last 7 days, by day |
| `ab month` | last 30 days, by project |
| `ab top [N]` | highest-spend sessions all-time (default 10) |
| `ab project <path>` | breakdown for one project (last 60 days) |
| `ab live` | tail the active session and stream cost as turns happen |
| `ab raw` | dump every assistant turn as one JSON line — pipe into `jq`, `duckdb`, whatever |

## Pricing

Uses public Anthropic list prices (May 2026). If you're on a flat subscription (Claude Pro / Claude Max), the dollar number is theoretical — it's what the same usage would cost on the API. Useful for comparing projects against each other and for cost-modelling if you ever leave the subscription.

Pricing table is hardcoded in [`src/pricing.ts`](src/pricing.ts) — PRs welcome when Anthropic moves prices.

## What it counts

Per assistant turn: `input_tokens`, `output_tokens`, `cache_creation_input_tokens` split into 5m / 1h ephemeral, `cache_read_input_tokens`. Exactly what shows up in `message.usage` in the transcript.

System tools the model invokes (web search, web fetch) are not priced separately — Anthropic charges those alongside the parent turn's tokens, so they're already included.

## Honesty

- This is a cost estimator, not your invoice. Real billing has rounding, regional discounts, and minimums.
- Anthropic occasionally adds new fields to the transcript schema. If a future model fits none of the known patterns, it's priced as Sonnet — that's a soft assumption, not a guarantee.
- Local-only. Reads files on your disk. Sends nothing anywhere.

## License

MIT
