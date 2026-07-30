import { HttpError } from "./errors.js";

export const DEFAULT_JSON_BODY_LIMIT = 1024 * 1024;

export async function readJsonBody(
  request,
  limitBytes = DEFAULT_JSON_BODY_LIMIT
) {
  const contentType = String(request.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(
      415,
      "UNSUPPORTED_CONTENT_TYPE",
      "Content-Type must be application/json."
    );
  }

  const contentLength = Number(request.headers["content-length"]);
  if (
    Number.isFinite(contentLength)
    && contentLength > limitBytes
  ) {
    throw new HttpError(
      413,
      "REQUEST_BODY_TOO_LARGE",
      `JSON request body exceeds the ${limitBytes} byte limit.`
    );
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > limitBytes) {
      throw new HttpError(
        413,
        "REQUEST_BODY_TOO_LARGE",
        `JSON request body exceeds the ${limitBytes} byte limit.`
      );
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    throw new HttpError(
      400,
      "MALFORMED_JSON",
      "Request body must contain a JSON object."
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      "MALFORMED_JSON",
      "Request body is not valid JSON."
    );
  }
}
