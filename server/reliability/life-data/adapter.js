import { normalizeStatus } from "../../../src/reliability/status-normalizer.js";
import { HttpError } from "../../middleware/errors.js";

const TOP_LEVEL_FIELDS = new Set([
  "rows",
  "mapping",
  "settings",
  "presentation"
]);
const SETTING_FIELDS = new Set([
  "timeUnit",
  "missionTime",
  "targetReliability",
  "distribution",
  "confidenceLevel",
  "bLifePercentiles"
]);
const MAPPING_FIELDS = new Set([
  "sampleId",
  "time",
  "status",
  "failureMode",
  "testCondition"
]);
const DEFAULT_B_LIFE_PERCENTILES = Object.freeze([0.01, 0.05, 0.1, 0.5]);
const NUMERIC_TEXT = /^[+\-]?\d*\.?\d+(?:e[+\-]?\d+)?$/i;

export function adaptLifeDataRequest(payload) {
  if (!isPlainObject(payload)) {
    throw new HttpError(
      400,
      "UNRECOGNIZED_REQUEST_STRUCTURE",
      "Request body must be a JSON object."
    );
  }
  rejectUnknownKeys(payload, TOP_LEVEL_FIELDS, "request");
  if (!Array.isArray(payload.rows)) {
    throw new HttpError(
      400,
      "UNRECOGNIZED_REQUEST_STRUCTURE",
      "rows must be an array."
    );
  }
  if (!isPlainObject(payload.mapping)) {
    throw new HttpError(
      400,
      "UNRECOGNIZED_REQUEST_STRUCTURE",
      "mapping must be an object."
    );
  }
  rejectUnknownKeys(payload.mapping, MAPPING_FIELDS, "mapping");
  if (
    typeof payload.mapping.time !== "string"
    || typeof payload.mapping.status !== "string"
  ) {
    throw new HttpError(
      400,
      "UNRECOGNIZED_REQUEST_STRUCTURE",
      "mapping.time and mapping.status must be column-name strings."
    );
  }
  if (
    payload.settings !== undefined
    && !isPlainObject(payload.settings)
  ) {
    throw new HttpError(
      400,
      "UNRECOGNIZED_REQUEST_STRUCTURE",
      "settings must be an object when provided."
    );
  }
  if (
    payload.presentation !== undefined
    && !isPlainObject(payload.presentation)
  ) {
    throw new HttpError(
      400,
      "UNRECOGNIZED_REQUEST_STRUCTURE",
      "presentation must be an object when provided."
    );
  }
  const settings = { ...(payload.settings || {}) };
  rejectUnknownKeys(settings, SETTING_FIELDS, "settings");
  validateMethodApplicability(settings);

  const rows = payload.rows.map((row, index) => {
    if (!isPlainObject(row)) {
      throw new HttpError(
        400,
        "UNRECOGNIZED_REQUEST_STRUCTURE",
        `rows[${index}] must be an object.`
      );
    }
    const normalized = { ...row };
    const timeColumn = payload.mapping.time;
    const statusColumn = payload.mapping.status;
    if (Object.hasOwn(row, timeColumn)) {
      normalized[timeColumn] = normalizeNumericValue(row[timeColumn]);
    }
    if (Object.hasOwn(row, statusColumn)) {
      const status = normalizeStatus(row[statusColumn]);
      normalized[statusColumn] = status || row[statusColumn];
    }
    return normalized;
  });

  for (const key of ["missionTime", "targetReliability"]) {
    if (Object.hasOwn(settings, key)) {
      settings[key] = normalizeNumericValue(settings[key]);
    }
  }

  const engineInput = {
    rows,
    mapping: { ...payload.mapping },
    settings: engineSettings(settings)
  };
  return {
    engineInput,
    fingerprintInput: semanticFingerprintInput(engineInput, settings),
    presentation: payload.presentation === undefined
      ? null
      : {
          productName: payload.presentation.productName ?? "",
          lang: payload.presentation.lang ?? "en",
          customPercentile:
            payload.presentation.customPercentile ?? "",
          customTime: payload.presentation.customTime ?? ""
        }
  };
}

function validateMethodApplicability(settings) {
  const distribution = settings.distribution ?? "weibull-2p";
  if (distribution !== "weibull-2p") {
    throw new HttpError(
      422,
      "METHOD_NOT_APPLICABLE",
      "Only the frozen Weibull 2P method is supported.",
      { field: "settings.distribution", supported: ["weibull-2p"] }
    );
  }
  if (
    settings.confidenceLevel !== undefined
    && settings.confidenceLevel !== null
    && settings.confidenceLevel !== ""
  ) {
    throw new HttpError(
      422,
      "METHOD_NOT_APPLICABLE",
      "Life Data confidence intervals are not available in the frozen reference behavior.",
      { field: "settings.confidenceLevel" }
    );
  }
  if (
    settings.bLifePercentiles !== undefined
    && !sameNumberArray(
      settings.bLifePercentiles,
      DEFAULT_B_LIFE_PERCENTILES
    )
  ) {
    throw new HttpError(
      422,
      "METHOD_NOT_APPLICABLE",
      "Only the frozen B1, B5, B10, and B50 outputs are supported.",
      {
        field: "settings.bLifePercentiles",
        supported: DEFAULT_B_LIFE_PERCENTILES
      }
    );
  }
}

function engineSettings(settings) {
  const output = {};
  for (const key of ["timeUnit", "missionTime", "targetReliability"]) {
    if (Object.hasOwn(settings, key)) output[key] = settings[key];
  }
  return output;
}

function semanticFingerprintInput(input, settings) {
  return {
    module: "life-data",
    method: {
      distribution: settings.distribution ?? "weibull-2p",
      confidenceLevel: null,
      bLifePercentiles: [...DEFAULT_B_LIFE_PERCENTILES]
    },
    settings: semanticSettings(input.settings),
    rows: input.rows.map(row => semanticRow(row, input.mapping))
  };
}

function semanticSettings(settings) {
  const output = {};
  for (const key of ["timeUnit", "missionTime", "targetReliability"]) {
    if (Object.hasOwn(settings, key)) output[key] = settings[key];
  }
  return output;
}

function semanticRow(row, mapping) {
  const output = {};
  for (const field of [
    "sampleId",
    "time",
    "status",
    "failureMode",
    "testCondition"
  ]) {
    const column = mapping[field];
    if (column && Object.hasOwn(row, column)) output[field] = row[column];
  }
  return output;
}

function normalizeNumericValue(value) {
  if (typeof value !== "string") return value;
  const text = value.trim().replace(/,/g, "");
  if (!NUMERIC_TEXT.test(text)) return value;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : value;
}

function rejectUnknownKeys(value, allowed, location) {
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) {
    throw new HttpError(
      400,
      "UNKNOWN_FIELD",
      `Unknown ${location} field(s): ${unknown.join(", ")}.`,
      { location, fields: unknown }
    );
  }
}

function sameNumberArray(actual, expected) {
  return (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => Number(value) === expected[index])
  );
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  );
}
