import { normalizeStatus } from "./status-normalizer.js";

const TIME_RE = /^[+\-]?\d*\.?\d+(?:e[+\-]?\d+)?$/i;

export function detectColumns(headers) {
  const aliases = {
    time: ["time", "failure time", "life", "duration", "hours", "cycles", "run_time", "test_time", "时间", "失效时间", "寿命", "测试时间"],
    status: ["status", "result", "state", "event", "failure status", "状态", "结果", "失效状态"],
    sampleId: ["sample id", "sample", "unit", "specimen", "id", "样品", "样本", "样品编号"],
    failureMode: ["failure mode", "failure", "mode", "defect", "失效模式", "故障模式"],
    testCondition: ["test condition", "condition", "temperature", "humidity", "stress", "测试条件", "温度", "湿度", "应力"]
  };
  const normalized = headers.map(header => String(header ?? "").trim().toLowerCase());
  const result = {};
  Object.entries(aliases).forEach(([field, names]) => {
    const index = normalized.findIndex(header => names.includes(header));
    if (index >= 0) result[field] = headers[index];
  });
  return result;
}

export function validateRows(rows, mapping, settings = {}) {
  const errors = [];
  const warnings = [];
  const records = [];
  const seenIds = new Map();
  let emptyRows = 0;
  let invalidTimeCount = 0;
  let invalidStatusCount = 0;
  const unit = settings.timeUnit || "hours";
  const validUnits = new Set(["hours", "cycles", "days"]);

  rows.forEach((row, index) => {
    const line = index + 2;
    const rawTime = row[mapping.time];
    const rawStatus = row[mapping.status];
    const hasAnyValue = Object.values(row).some(value => String(value ?? "").trim());
    if (!hasAnyValue) {
      emptyRows += 1;
      return;
    }

    const timeText = String(rawTime ?? "").trim().replace(/,/g, "");
    if (!TIME_RE.test(timeText)) {
      invalidTimeCount += 1;
      errors.push(`Row ${line}: invalid Time "${rawTime ?? ""}". Time must be a finite positive number.`);
      return;
    }
    const time = Number(timeText);
    if (!Number.isFinite(time) || time <= 0) {
      invalidTimeCount += 1;
      errors.push(`Row ${line}: invalid Time "${rawTime ?? ""}". Time must be a finite positive number.`);
      return;
    }

    const status = normalizeStatus(rawStatus);
    if (!status) {
      invalidStatusCount += 1;
      errors.push(`Row ${line}: unrecognized Status "${rawStatus ?? ""}".`);
      return;
    }

    const sampleId = String(row[mapping.sampleId] ?? `S${String(records.length + 1).padStart(3, "0")}`).trim() || `S${String(records.length + 1).padStart(3, "0")}`;
    if (/[\u0000-\u001F\u007F]/.test(sampleId)) warnings.push(`Row ${line}: Sample ID contains control characters.`);
    if (seenIds.has(sampleId)) warnings.push(`Duplicate Sample ID "${sampleId}" at rows ${seenIds.get(sampleId)} and ${line}.`);
    else seenIds.set(sampleId, line);

    records.push({
      sampleId,
      time,
      status,
      failureMode: String(row[mapping.failureMode] ?? "").trim(),
      testCondition: String(row[mapping.testCondition] ?? "").trim(),
      unit,
      sourceRow: line
    });
  });

  const failureCount = records.filter(record => record.status === "failure").length;
  const censoredCount = records.filter(record => record.status === "censored").length;
  const distinctTimes = new Set(records.map(record => record.time));
  if (!records.length) errors.push("No valid records were found.");
  if (records.length && !records.some(record => Number.isFinite(record.time))) errors.push("No valid Time values were found.");
  if (records.length && failureCount + censoredCount === 0) errors.push("No recognizable Status values were found.");
  if (records.length > 1 && distinctTimes.size === 1) errors.push("All Time values are identical, so Weibull parameters cannot be estimated.");
  if (records.length && failureCount === 0) errors.push("Weibull parameters cannot be estimated without observed failures. Use Reliability Demonstration for zero-failure test evaluation.");
  if (failureCount > 0 && failureCount < 5) warnings.push("Limited failure information. Parameter estimates may be unstable.");
  if (records.length && censoredCount === 0) warnings.push("No right-censored observations were detected.");
  if (!settings.timeUnit) warnings.push("Time unit was not set explicitly; hours are used by default.");
  if (settings.timeUnit && !validUnits.has(settings.timeUnit)) errors.push(`Unsupported time unit "${settings.timeUnit}".`);

  return { records, errors, warnings, emptyRows, invalidTimeCount, invalidStatusCount, failureCount, censoredCount, totalCount: records.length };
}
