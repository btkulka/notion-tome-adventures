// Runs the app (vite, :1974) and the Worker (wrangler dev, :8787) together, so one
// command starts everything: `npm start`, and what Benhäus runs for Tome.
// If either stops, the other is stopped too and this exits with its code.
import { spawn, spawnSync } from "node:child_process";

const parts = [
  { tag: "web", script: "dev" },
  { tag: "api", script: "dev:api" },
];

const children = parts.map(({ tag, script }) => {
  const child = spawn(`npm run ${script}`, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = (stream, out) =>
    stream.setEncoding("utf8").on("data", (d) => {
      for (const line of d.split(/\r?\n/)) if (line) out.write(`[${tag}] ${line}\n`);
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  return child;
});

let stopping = false;
const stopAll = (code) => {
  if (stopping) return;
  stopping = true;
  // kill() would only stop the shell on Windows, leaving npm and vite/wrangler behind.
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill();
  }
  process.exitCode = code;
};

for (const c of children) c.on("exit", (code) => stopAll(code ?? 1));
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
