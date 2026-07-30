export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function publicErrorBody(error, metadata = undefined) {
  const known = error instanceof HttpError;
  const body = {
    error: {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known
        ? error.message
        : "The Reliability Engine could not complete the request."
    }
  };
  if (known && error.details !== undefined) {
    body.error.details = error.details;
  }
  if (metadata) body.metadata = metadata;
  return body;
}
