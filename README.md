<div align="center">

# agent-budget

see what your Claude Code agents are actually costing you.

[![release](https://img.shields.io/github/v/release/f4rkh4d/agent-budget?style=flat-square&color=000)](https://github.com/f4rkh4d/agent-budget/releases)
[![license](https://img.shields.io/github/license/f4rkh4d/agent-budget?style=flat-square&color=000)](LICENSE)
[![downloads](https://img.shields.io/github/downloads/f4rkh4d/agent-budget/total?style=flat-square&color=000)](https://github.com/f4rkh4d/agent-budget/releases)

</div>

reads `~/.claude/projects/<encoded-cwd>/<session>.jsonl` — the transcript files Claude Code already writes — and converts them into a USD bill at current Anthropic list prices. no telemetry, no extra config, no API keys. just `ab today` and you know.

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

## why

Claude Code shows you tokens, not money. if you're paying per token (API or any pay-as-you-go plan), there's no way to see which project is the budget hole until the invoice arrives. `agent-budget` is the answer key.

## install

```sh
curl -fsSL https://raw.githubusercontent.com/f4rkh4d/agent-budget/main/install.sh | bash
```

or grab a binary from [Releases](https://github.com/f4rkh4d/agent-budget/releases).

or build from source — bun, no deps:

```sh
bun run build
./dist/ab today
```

## commands

| | |
|---|---|
| `ab today` | spend so far today, by project |
| `ab week` | last 7 days, by day |
| `ab month` | last 30 days, by project |
| `ab top [N]` | highest-spend sessions all-time (default 10) |
| `ab project <path>` | breakdown for one project (last 60 days) |
| `ab session <id>` | breakdown for sessions matching a substring |
| `ab live` | tail the active session and stream cost as turns happen |
| `ab raw` | dump every assistant turn as one JSON line — pipe into `jq`, `duckdb`, whatever |

`today`, `week`, `month`, `top`, `project`, `session` all accept `--json` for piping. set `NO_COLOR=1` (or pipe stdout) to drop ANSI codes.

## pricing

uses public Anthropic list prices (May 2026). if you're on a flat subscription (Claude Pro / Claude Max), the dollar number is theoretical — it's what the same usage would cost on the API. useful for comparing projects against each other and for cost-modelling if you ever leave the subscription.

pricing table is hardcoded in [`src/pricing.ts`](src/pricing.ts) — PRs welcome when Anthropic moves prices.

## what it counts

per assistant turn: `input_tokens`, `output_tokens`, `cache_creation_input_tokens` split into 5m / 1h ephemeral, `cache_read_input_tokens`. exactly what shows up in `message.usage` in the transcript.

system tools the model invokes (web search, web fetch) aren't priced separately — Anthropic charges those alongside the parent turn's tokens, so they're already included.

## honesty

- this is a cost estimator, not your invoice. real billing has rounding, regional discounts, and minimums.
- Anthropic occasionally adds new fields to the transcript schema. if a future model fits none of the known patterns, it's priced as Sonnet — that's a soft assumption, not a guarantee.
- local-only. reads files on your disk. sends nothing anywhere.

## license

MIT
