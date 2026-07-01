import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const processes = [
  spawn(process.execPath, ["server/seoApiServer.js"], {
    env: { ...process.env, SEO_API_PORT: "8788" },
    stdio: "inherit",
  }),
  spawn(npmCommand, ["run", "dev"], { shell: true, stdio: "inherit" }),
];

function shutdown(signal) {
  for (const child of processes) {
    child.kill(signal);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
