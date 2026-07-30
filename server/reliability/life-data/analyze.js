import { randomUUID } from "node:crypto";

import {
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_ENGINE_VERSION,
  RELIABILITY_FIXTURE_VERSION
} from "../../../src/reliability/engine/contract.js";
import { adaptLifeDataRequest } from "./adapter.js";
import { validateLifeDataInput } from "./validation.js";
import { calculateLifeData } from "./calculation.js";
import { decideLifeData } from "./decision.js";
import { buildLifeDataInsight } from "./insight.js";
import { buildLifeDataCharts } from "./charts.js";
import { buildLifeDataReportPayload } from "./report-payload.js";
import { createInputFingerprint } from "./fingerprint.js";
import {
  BACKEND_ENGINE_VERSION,
  REFERENCE_BASELINE_ID
} from "../version.js";

export function analyzeBackendLifeData(
  payload,
  {
    analysisId = randomUUID(),
    createdAt = new Date().toISOString(),
    clientRequestId = randomUUID()
  } = {}
) {
  const adapted = adaptLifeDataRequest(payload);
  const fingerprint = createInputFingerprint(adapted.fingerprintInput);
  const metadata = {
    analysis_id: analysisId,
    module: "life-data",
    baseline_id: REFERENCE_BASELINE_ID,
    reference_engine_version: RELIABILITY_ENGINE_VERSION,
    backend_engine_version: BACKEND_ENGINE_VERSION,
    contract_version: RELIABILITY_CONTRACT_VERSION,
    fixture_version: RELIABILITY_FIXTURE_VERSION,
    input_fingerprint: fingerprint.value,
    fingerprint_algorithm: fingerprint.algorithm,
    created_at: createdAt,
    client_request_id: clientRequestId
  };
  const validation = validateLifeDataInput(adapted.engineInput);
  const base = {
    validation: validation.structured,
    validation_issues: validation.issues,
    calculation: null,
    decision: null,
    reason_codes: [],
    insight: null,
    warnings: [...validation.structured.warnings],
    assumptions: [],
    limitations: [],
    charts: null,
    report_payload: null,
    compatibility: {
      validation: validation.raw,
      fit: null,
      metrics: null,
      mtbf: null,
      insight: null
    },
    metadata
  };
  if (validation.structured.status === "INVALID") {
    assertSerializableFinite(base);
    return base;
  }

  const calculation = calculateLifeData(
    validation.raw,
    adapted.engineInput.settings
  );
  const decision = decideLifeData(
    calculation,
    adapted.engineInput.settings
  );
  const insight = buildLifeDataInsight(
    validation.structured,
    calculation,
    decision
  );
  const charts = buildLifeDataCharts(
    validation.raw,
    calculation,
    adapted.presentation,
    adapted.engineInput.settings.targetReliability
  );
  const compatibility = {
    validation: validation.raw,
    fit: calculation.parameters,
    metrics: {
      ...calculation.metrics,
      targetComparison: decision.existingDecision
    },
    mtbf: calculation.supplementalMTBF,
    insight: insight.compatibility
  };
  const reportPayload = buildLifeDataReportPayload({
    compatibility,
    mapping: adapted.engineInput.mapping,
    settings: adapted.engineInput.settings,
    charts,
    presentation: adapted.presentation
  });
  const response = {
    ...base,
    calculation,
    decision,
    reason_codes: [...decision.reasonCodes],
    insight: insight.structured,
    assumptions: [],
    limitations: [...insight.structured.limitations],
    charts,
    report_payload: reportPayload,
    compatibility
  };
  assertSerializableFinite(response);
  return response;
}

export function assertSerializableFinite(value, path = "$") {
  if (value === undefined) {
    throw new TypeError(`Undefined response value at ${path}.`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite response value at ${path}.`);
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSerializableFinite(item, `${path}[${index}]`)
    );
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    assertSerializableFinite(item, `${path}.${key}`);
  }
}
