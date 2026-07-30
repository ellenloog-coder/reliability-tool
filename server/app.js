import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import {
  HttpError,
  publicErrorBody
} from "./middleware/errors.js";
import {
  DEFAULT_JSON_BODY_LIMIT,
  readJsonBody
} from "./middleware/request-limit.js";
import {
  LIFE_DATA_ANALYZE_PATH,
  routeReliabilityRequest
} from "./routes/reliability.js";

export function createReliabilityServer({
  bodyLimitBytes = DEFAULT_JSON_BODY_LIMIT,
  allowedOrigins = defaultAllowedOrigins(),
  analyzeLifeData,
  logger = () => {}
} = {}) {
  return createServer(async (request, response) => {
    const startedAt = performance.now();
    const requestMetadata = {
      analysisId: randomUUID(),
      createdAt: new Date().toISOString(),
      clientRequestId: clientRequestId(request)
    };
    try {
      applyCors(request, response, allowedOrigins);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      const pathname = new URL(
        request.url,
        "http://127.0.0.1"
      ).pathname;
      if (pathname !== LIFE_DATA_ANALYZE_PATH) {
        throw new HttpError(404, "NOT_FOUND", "Route not found.");
      }
      if (request.method !== "POST") {
        throw new HttpError(
          405,
          "METHOD_NOT_ALLOWED",
          "Only POST is supported for this route."
        );
      }
      const body = await readJsonBody(request, bodyLimitBytes);
      const routed = await routeReliabilityRequest(request, body, {
        analyzeLifeData,
        requestMetadata
      });
      writeJson(response, routed.status, routed.body);
      logger({
        analysis_id: routed.body.metadata?.analysis_id,
        input_fingerprint: routed.body.metadata?.input_fingerprint,
        status: routed.body.validation?.status,
        duration_ms: Math.round((performance.now() - startedAt) * 100) / 100
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      writeJson(
        response,
        status,
        publicErrorBody(error, {
          analysis_id: requestMetadata.analysisId,
          created_at: requestMetadata.createdAt,
          client_request_id: requestMetadata.clientRequestId
        })
      );
      logger({
        analysis_id: requestMetadata.analysis_id,
        error_code: error instanceof HttpError
          ? error.code
          : "INTERNAL_ERROR",
        status: "ERROR",
        duration_ms: Math.round((performance.now() - startedAt) * 100) / 100
      });
    }
  });
}

function applyCors(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!allowedOrigins.some(rule => originMatches(origin, rule))) {
    throw new HttpError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "Request origin is not allowed."
    );
  }
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Client-Request-ID"
  );
}

function clientRequestId(request) {
  const value = request.headers["x-client-request-id"];
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 128);
  }
  return randomUUID();
}

function defaultAllowedOrigins() {
  const configured = String(
    process.env.RELIABILITY_ALLOWED_ORIGINS || ""
  ).split(",").map(item => item.trim()).filter(Boolean);
  return configured.length
    ? configured
    : [
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^http:\/\/localhost:\d+$/
      ];
}

function originMatches(origin, rule) {
  return rule instanceof RegExp ? rule.test(origin) : rule === origin;
}

function writeJson(response, status, body) {
  const json = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(json);
}
