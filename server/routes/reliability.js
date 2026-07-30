import { analyzeBackendLifeData } from "../reliability/life-data/analyze.js";
import { HttpError } from "../middleware/errors.js";

export const LIFE_DATA_ANALYZE_PATH =
  "/api/reliability/life-data/analyze";

export async function routeReliabilityRequest(
  request,
  body,
  {
    analyzeLifeData = analyzeBackendLifeData,
    requestMetadata
  } = {}
) {
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
  const result = await analyzeLifeData(body, requestMetadata);
  return {
    status: result.validation.status === "INVALID" ? 422 : 200,
    body: result
  };
}
