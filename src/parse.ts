/**
 * Walks ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl and yields
 * one Entry per assistant message that has a usage block.
 *
 * Encoded path: leading slash dropped, slashes → dashes. We reverse it
 * to get the original cwd back for display.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Tokens } from "./pricing";

export const PROJECTS_ROOT = join(homedir(), ".claude", "projects");

export interface Entry {
  project: string; // decoded cwd
  sessionId: string;
  timestamp: string; // ISO
  model: string;
  tokens: Tokens;
}

export function decodeProject(name: string): string {
  // Reverse of CC's encoding. Leading dash represents the leading slash.
  return name.replace(/^-/, "/").replace(/-/g, "/");
}

export function* iterEntries(opts?: { since?: Date }): Generator<Entry> {
  if (!existsSync(PROJECTS_ROOT)) return;
  const since = opts?.since;
  for (const dir of readdirSync(PROJECTS_ROOT)) {
    const dirPath = join(PROJECTS_ROOT, dir);
    let st: ReturnType<typeof statSync>;
    try { st = statSync(dirPath); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = join(dirPath, file);
      try {
        const fs = statSync(filePath);
        if (since && fs.mtime < since) continue;
      } catch { continue; }
      const sessionId = file.replace(/\.jsonl$/, "");
      yield* iterFile(filePath, decodeProject(dir), sessionId, since);
    }
  }
}

function* iterFile(
  path: string,
  project: string,
  sessionId: string,
  since: Date | undefined,
): Generator<Entry> {
  // Sync read is fine — most session files are <10MB.
  const text = require("node:fs").readFileSync(path, "utf-8") as string;
  for (const line of text.split("\n")) {
    if (!line || line[0] !== "{") continue;
    let obj: any;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type !== "assistant") continue;
    const u = obj.message?.usage;
    if (!u) continue;
    if (since && obj.timestamp && new Date(obj.timestamp) < since) continue;
    const cc = u.cache_creation ?? {};
    yield {
      project,
      sessionId,
      timestamp: obj.timestamp ?? "",
      model: obj.message.model ?? "unknown",
      tokens: {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheWrite5m: cc.ephemeral_5m_input_tokens ?? 0,
        cacheWrite1h: cc.ephemeral_1h_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
      },
    };
  }
}
