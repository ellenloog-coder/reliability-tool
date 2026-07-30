import { once } from "node:events";

import { createReliabilityServer } from "../app.js";

export async function withServer(options, callback) {
  const server = createReliabilityServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(baseUrl, server);
  } finally {
    server.close();
    await once(server, "close");
  }
}

export async function postJson(
  baseUrl,
  payload,
  {
    path = "/api/reliability/life-data/analyze",
    headers = {},
    raw = false
  } = {}
) {
  const body = raw ? payload : JSON.stringify(payload);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body
  });
  return {
    response,
    body: await response.json()
  };
}

export function withoutRequestMetadata(value) {
  const copy = structuredClone(value);
  if (copy.metadata) {
    delete copy.metadata.analysis_id;
    delete copy.metadata.created_at;
    delete copy.metadata.client_request_id;
  }
  return copy;
}
