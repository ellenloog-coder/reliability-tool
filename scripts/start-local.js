import { spawn } from "node:child_process";

const frontendHost = process.env.RELIABILITY_FRONTEND_HOST || "127.0.0.1";
const frontendPort = positiveInteger(
  process.env.RELIABILITY_FRONTEND_PORT,
  8020
);
const backendHost = process.env.RELIABILITY_HOST || "127.0.0.1";
const backendPort = positiveInteger(
  process.env.RELIABILITY_PORT,
  8030
);

const children = [
  start(process.execPath, ["server/index.js"], {
    RELIABILITY_HOST: backendHost,
    RELIABILITY_PORT: String(backendPort)
  }),
  start("python3", [
    "-m",
    "http.server",
    String(frontendPort),
    "--bind",
    frontendHost
  ])
];

console.log(
  `Reliability Tool: http://${frontendHost}:${frontendPort}`
);
console.log(
  `Reliability Backend: http://${backendHost}:${backendPort}`
);
console.log("Press Ctrl+C to stop both services.");

let stopping = false;

for (const child of children) {
  child.on("error", error => {
    console.error(`Unable to start local service: ${error.message}`);
    stopAll(1);
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    const detail = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`A local service stopped unexpectedly (${detail}).`);
    stopAll(code || 1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

function start(command, args, extraEnvironment = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnvironment
    },
    stdio: "inherit"
  });
}

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 50);
}

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : fallback;
}
