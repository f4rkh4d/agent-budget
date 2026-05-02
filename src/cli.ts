#!/usr/bin/env bun
/**
 * agent-budget — see what your AI agents are costing you.
 *
 *   ab today                spend so far today, by project
 *   ab week                 last 7 days, by day
 *   ab month                last 30 days, by project
 *   ab top [N]              highest-spend sessions all-time
 *   ab project <path>       breakdown for one project
 *   ab live                 tail the active session and stream cost
 *   ab raw                  dump every assistant turn as JSON (pipe-friendly)
 */

import { aggAll, aggSince, aggToday, startOfDay, ymd, type Bucket } from "./agg";
import { iterEntries } from "./parse";
import { costUsd } from "./pricing";

const VERSION = "0.1.0";

const NOCOLOR = !!process.env.NO_COLOR || !process.stdout.isTTY;
const RESET = NOCOLOR ? "" : "\x1b[0m";
const BOLD = NOCOLOR ? "" : "\x1b[1m";
const DIM = NOCOLOR ? "" : "\x1b[2m";
const RED = NOCOLOR ? "" : "\x1b[31m";
const GREEN = NOCOLOR ? "" : "\x1b[32m";
const CYAN = NOCOLOR ? "" : "\x1b[36m";

const fmt = (n: number) =>
  n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`;

const compactTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : `${n}`;

function printBuckets(buckets: Bucket[], label: string) {
  if (buckets.length === 0) {
    console.log(`${DIM}no activity${RESET}`);
    return;
  }
  const total = buckets.reduce((s, b) => s + b.cost, 0);
  console.log(`${BOLD}${label}${RESET}  ${GREEN}${fmt(total)}${RESET}`);
  console.log();
  const width = Math.max(...buckets.map((b) => b.key.length), 20);
  for (const b of buckets) {
    const bar = "█".repeat(Math.max(1, Math.round((b.cost / total) * 24)));
    const tk =
      `in ${compactTokens(b.tokens.input)} · out ${compactTokens(b.tokens.output)} · ` +
      `cache r/w ${compactTokens(b.tokens.cacheRead)}/${compactTokens(b.tokens.cacheWrite5m + b.tokens.cacheWrite1h)}`;
    console.log(
      `  ${b.key.padEnd(width)}  ${CYAN}${bar.padEnd(24)}${RESET}  ${BOLD}${fmt(b.cost).padStart(7)}${RESET}  ${DIM}${tk}${RESET}`,
    );
  }
  console.log();
}

function cmdToday() {
  printBuckets(aggToday(), `today (${ymd(new Date())})`);
}

function cmdWeek() {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  printBuckets(aggSince(startOfDay(since), "day"), "last 7 days");
}

function cmdMonth() {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  printBuckets(aggSince(startOfDay(since), "project"), "last 30 days");
}

function cmdTop(args: string[]) {
  const n = Math.max(1, Number(args[0] ?? "10") | 0);
  const all = aggAll("session").slice(0, n);
  printBuckets(all, `top ${n} sessions, all-time`);
}

function cmdProject(args: string[]) {
  if (args.length === 0) {
    console.error("usage: ab project <path>");
    process.exit(1);
  }
  const target = args[0]!;
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const all = aggSince(since, "session").filter((b) => b.key.startsWith(`${target}::`));
  printBuckets(all, `${target} (last 60 days)`);
}

function cmdRaw() {
  for (const e of iterEntries()) {
    process.stdout.write(`${JSON.stringify({ ...e, cost: costUsd(e.tokens, e.model) })}\n`);
  }
}

async function cmdLive() {
  // Find newest jsonl, tail it forever.
  const { spawn } = await import("node:child_process");
  const find = spawn("sh", [
    "-c",
    "ls -t ~/.claude/projects/*/*.jsonl 2>/dev/null | head -1",
  ]);
  let path = "";
  for await (const chunk of find.stdout) path += chunk.toString();
  path = path.trim();
  if (!path) {
    console.error("no active session found");
    process.exit(1);
  }
  console.log(`${BOLD}tailing${RESET} ${DIM}${path}${RESET}`);
  console.log();
  let total = 0;
  const tail = spawn("tail", ["-n", "0", "-F", path]);
  tail.stdout.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (!line || line[0] !== "{") continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.type !== "assistant") continue;
      const u = obj.message?.usage;
      if (!u) continue;
      const cc = u.cache_creation ?? {};
      const c = costUsd(
        {
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheWrite5m: cc.ephemeral_5m_input_tokens ?? 0,
          cacheWrite1h: cc.ephemeral_1h_input_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
        },
        obj.message.model ?? "unknown",
      );
      total += c;
      const ts = new Date(obj.timestamp ?? Date.now()).toLocaleTimeString();
      const model = (obj.message.model ?? "?").replace(/^claude-/, "").replace(/\[.*?\]/g, "");
      console.log(
        `${DIM}${ts}${RESET}  ${model.padEnd(14)}  ${BOLD}+${fmt(c)}${RESET}  ${DIM}=${fmt(total)}${RESET}`,
      );
    }
  });
}

function help() {
  console.log(`${BOLD}agent-budget${RESET} — see what your AI agents are costing you

${BOLD}Usage${RESET}
  ab today                       spend so far today, by project
  ab week                        last 7 days, by day
  ab month                       last 30 days, by project
  ab top [N]                     highest-spend sessions all-time (default 10)
  ab project <path>              breakdown for one project (last 60 days)
  ab live                        tail active session and stream cost
  ab raw                         dump every turn as JSON (pipe-friendly)
  ab version                     print version

${DIM}Reads ~/.claude/projects/. Cost = list price × tokens; subscription pricing may differ.${RESET}
`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case "today": cmdToday(); break;
    case "week": cmdWeek(); break;
    case "month": cmdMonth(); break;
    case "top": cmdTop(args); break;
    case "project": cmdProject(args); break;
    case "live": await cmdLive(); break;
    case "raw": cmdRaw(); break;
    case "version": case "-v": case "--version": console.log(VERSION); break;
    case undefined: case "help": case "-h": case "--help": help(); break;
    default:
      console.error(`${RED}unknown command:${RESET} ${cmd}`);
      help();
      process.exit(1);
  }
} catch (e) {
  console.error(`${RED}✕${RESET} ${(e as Error).message}`);
  process.exit(1);
}
