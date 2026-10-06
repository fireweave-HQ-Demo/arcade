/**
 * Polling process supervisor for API inside Docker Desktop.
 * Bind mounts sync files immediately; inotify/`bun --watch` often miss host edits on macOS.
 */
import { spawn, type Subprocess } from "bun";
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const roots = ["apps/api", "packages"];
const watchExt = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);
const ignore = new Set(["node_modules", "dist", ".git"]);
const intervalMs = Number(process.env.DOCKER_WATCH_INTERVAL_MS ?? 400);

async function fingerprint(dir: string): Promise<string> {
  let acc = 0n;
  async function walk(path: string) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name) || entry.name.startsWith(".")) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!watchExt.has(extname(entry.name))) continue;
      try {
        const s = await stat(full);
        acc += BigInt(Math.trunc(s.mtimeMs)) + BigInt(s.size);
      } catch {
        /* ignore transient */
      }
    }
  }
  await walk(dir);
  return acc.toString();
}

async function snapshot(): Promise<string> {
  const parts: string[] = [];
  for (const root of roots) parts.push(await fingerprint(root));
  return parts.join(":");
}

let child: Subprocess | null = null;

function start() {
  if (child) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
  child = spawn({
    cmd: ["bun", "apps/api/src/main.ts"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
}

start();
let prev = await snapshot();
console.log(`[docker-api-watch] polling every ${intervalMs}ms`);

setInterval(async () => {
  if (child && child.exitCode !== null) {
    console.log(`[docker-api-watch] API exited (${child.exitCode}) — restarting`);
    start();
    return;
  }
  const next = await snapshot();
  if (next === prev) return;
  prev = next;
  console.log("[docker-api-watch] change detected — restarting API");
  start();
}, intervalMs);

process.on("SIGTERM", () => {
  child?.kill();
  process.exit(0);
});
process.on("SIGINT", () => {
  child?.kill();
  process.exit(0);
});
