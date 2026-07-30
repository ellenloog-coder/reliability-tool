import { createReliabilityServer } from "./app.js";

const host = process.env.RELIABILITY_HOST || "127.0.0.1";
const port = positiveInteger(
  process.env.RELIABILITY_PORT,
  8030
);
const bodyLimitBytes = positiveInteger(
  process.env.RELIABILITY_BODY_LIMIT_BYTES,
  1024 * 1024
);

const server = createReliabilityServer({
  bodyLimitBytes,
  logger(event) {
    console.log(JSON.stringify(event));
  }
});

server.listen(port, host, () => {
  console.log(
    `Reliability Backend listening on http://${host}:${port}`
  );
});

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : fallback;
}
