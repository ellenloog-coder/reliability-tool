import { normalizeStatus } from "./status-normalizer.js";

const EXPOSURE_RE = /^[+\-]?\d*\.?\d+(?:e[+\-]?\d+)?$/i;
const TIME_UNITS = new Set(["hours", "cycles", "days", "minutes", "other"]);

export function detectMTBFColumns(headers) {
  const aliases = {
    exposureTime: ["exposure time", "test time", "operating time", "runtime", "run time", "duration", "hours", "cycles", "time", "暴露时间", "测试时间", "运行时间", "时长", "周期数"],
    status: ["status", "result", "state", "event", "failure status", "状态", "结果", "失效状态"],
    unitId: ["unit id", "unit", "sample id", "sample", "equipment", "system", "id", "设备编号", "样品编号", "样本编号", "单元编号"],
    failureMode: ["failure mode", "failure", "mode", "defect", "失效模式", "故障模式"],
    testCondition: ["test condition", "condition", "environment", "temperature", "stress", "测试条件", "环境", "温度", "应力"],
    notes: ["notes", "note", "comment", "comments", "备注", "说明"]
  };
  const normalized = headers.map(header => String(header ?? "").trim().toLowerCase());
  const result = {};
  Object.entries(aliases).forEach(([field, names]) => {
    const index = normalized.findIndex(header => names.includes(header));
    if (index >= 0) result[field] = headers[index];
  });
  return result;
}

export function validateMTBFSummaryInput(input) {
  const errors = [];
  const warnings = [];
  const totalExposure = numeric(input.totalExposure);
  const failureCount = numeric(input.failureCount);
  const missionTime = numeric(input.missionTime);
  const targetMTBF = input.targetMTBF === "" || input.targetMTBF == null ? null : numeric(input.targetMTBF);
  if (!Number.isFinite(totalExposure) || totalExposure <= 0) errors.push("Total Time on Test must be a finite positive number.");
  if (!Number.isInteger(failureCount) || failureCount < 0) errors.push("Failure Count must be a non-negative integer.");
  if (Number.isFinite(totalExposure) && Number.isFinite(failureCount) && failureCount > totalExposure * 1000000) errors.push("Failure Count is outside a reasonable range for the entered exposure.");
  if (!Number.isFinite(missionTime) || missionTime <= 0) errors.push("Mission Time must be a finite positive number.");
  if (targetMTBF !== null && (!Number.isFinite(targetMTBF) || targetMTBF <= 0)) errors.push("Target MTBF must be a finite positive number.");
  if (!TIME_UNITS.has(input.timeUnit)) errors.push(`Unsupported time unit "${input.timeUnit}".`);
  if (failureCount === 0) warnings.push("A finite MTBF point estimate cannot be calculated from a zero-failure test. Use Reliability Demonstration to evaluate the evidence against a defined reliability target and confidence level.");
  return {
    errors,
    warnings,
    input: {
      totalExposure,
      failureCount,
      censoredCount: null,
      totalUnits: null,
      missionTime,
      targetMTBF,
      timeUnit: input.timeUnit
    }
  };
}

export function validateMTBFUnitRows(rows, mapping, settings = {}) {
  const errors = [];
  const warnings = [];
  const records = [];
  const seenIds = new Map();
  let emptyRows = 0;
  let invalidExposureCount = 0;
  let invalidStatusCount = 0;
  const timeUnit = settings.timeUnit || "hours";
  if (!TIME_UNITS.has(timeUnit)) errors.push(`Unsupported time unit "${timeUnit}".`);

  rows.forEach((row, index) => {
    const line = index + 2;
    const hasAnyValue = Object.values(row).some(value => String(value ?? "").trim());
    if (!hasAnyValue) {
      emptyRows += 1;
      return;
    }
    const rawExposure = row[mapping.exposureTime];
    const exposureText = String(rawExposure ?? "").trim().replace(/,/g, "");
    if (!EXPOSURE_RE.test(exposureText)) {
      invalidExposureCount += 1;
      errors.push(`Row ${line}: invalid Exposure Time "${rawExposure ?? ""}". Exposure Time must be a finite positive number.`);
      return;
    }
    const exposureTime = Number(exposureText);
    if (!Number.isFinite(exposureTime) || exposureTime <= 0) {
      invalidExposureCount += 1;
      errors.push(`Row ${line}: invalid Exposure Time "${rawExposure ?? ""}". Exposure Time must be a finite positive number.`);
      return;
    }
    const rawStatus = row[mapping.status];
    const status = normalizeStatus(rawStatus);
    if (!status) {
      invalidStatusCount += 1;
      errors.push(`Row ${line}: unrecognized Status "${rawStatus ?? ""}".`);
      return;
    }
    const unitId = String(row[mapping.unitId] ?? `U${String(records.length + 1).padStart(3, "0")}`).trim() || `U${String(records.length + 1).padStart(3, "0")}`;
    if (seenIds.has(unitId)) warnings.push(`Duplicate Unit ID "${unitId}" at rows ${seenIds.get(unitId)} and ${line}.`);
    else seenIds.set(unitId, line);
    records.push({
      unitId,
      exposureTime,
      status,
      failureMode: String(row[mapping.failureMode] ?? "").trim(),
      testCondition: String(row[mapping.testCondition] ?? "").trim(),
      notes: String(row[mapping.notes] ?? "").trim(),
      sourceRow: line
    });
  });

  const failureCount = records.filter(record => record.status === "failure").length;
  const censoredCount = records.filter(record => record.status === "censored").length;
  const totalExposure = records.reduce((sum, record) => sum + record.exposureTime, 0);
  if (!records.length) errors.push("No valid unit exposure records were found.");
  if (failureCount === 0) warnings.push("A finite MTBF point estimate cannot be calculated from a zero-failure test. Use Reliability Demonstration to evaluate the evidence against a defined reliability target and confidence level.");
  return {
    records,
    errors,
    warnings,
    emptyRows,
    invalidExposureCount,
    invalidStatusCount,
    totalExposure,
    failureCount,
    censoredCount,
    totalUnits: records.length
  };
}

function numeric(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  return Number(String(value).trim().replace(/,/g, ""));
}
