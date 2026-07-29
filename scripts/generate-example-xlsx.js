import { writeFileSync } from "node:fs";

const rows = [
  ["Sample ID", "Time", "Status", "Failure Mode", "Test Condition"],
  ["S001", "320", "Failure", "Seal crack", "85C life test"],
  ["S002", "540", "Failure", "Seal crack", "85C life test"],
  ["S003", "760", "Censored", "", "85C life test"],
  ["S004", "810", "Failure", "Capacity loss", "85C life test"],
  ["S005", "1000", "Censored", "", "85C life test"],
  ["S006", "1140", "Failure", "Connector fatigue", "85C life test"],
  ["S007", "1200", "Censored", "", "85C life test"],
  ["S008", "1275", "Failure", "Capacity loss", "85C life test"],
  ["S009", "1400", "Censored", "", "85C life test"],
  ["S010", "1500", "Censored", "", "85C life test"],
  ["S011", "1660", "Failure", "Capacity loss", "85C life test"],
  ["S012", "1800", "Censored", "", "85C life test"],
  ["S013", "1960", "Failure", "Seal crack", "85C life test"],
  ["S014", "2100", "Censored", "", "85C life test"],
  ["S015", "2250", "Censored", "", "85C life test"]
];

const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Life Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": sheetXml(rows)
};

function sheetXml(data) {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
}

function zipStore(fileMap) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  Object.entries(fileMap).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = zipHeader(0x04034b50, nameBytes, data.length, crc, offset);
    chunks.push(local, nameBytes, data);
    central.push([zipHeader(0x02014b50, nameBytes, data.length, crc, offset), nameBytes]);
    offset += local.length + nameBytes.length + data.length;
  });
  const centralOffset = offset;
  central.forEach(([header, nameBytes]) => { chunks.push(header, nameBytes); offset += header.length + nameBytes.length; });
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, central.length, true);
  view.setUint16(10, central.length, true);
  view.setUint32(12, offset - centralOffset, true);
  view.setUint32(16, centralOffset, true);
  chunks.push(end);
  return concat(chunks);
}

function zipHeader(signature, nameBytes, size, crc, relativeOffset) {
  const isCentral = signature === 0x02014b50;
  const header = new Uint8Array(isCentral ? 46 : 30);
  const view = new DataView(header.buffer);
  view.setUint32(0, signature, true);
  if (isCentral) {
    view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint32(16, crc, true); view.setUint32(20, size, true); view.setUint32(24, size, true); view.setUint16(28, nameBytes.length, true); view.setUint32(42, relativeOffset, true);
  } else {
    view.setUint16(4, 20, true); view.setUint32(14, crc, true); view.setUint32(18, size, true); view.setUint32(22, size, true); view.setUint16(26, nameBytes.length, true);
  }
  return header;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach(part => { out.set(part, offset); offset += part.length; });
  return out;
}

function crc32(bytes) {
  let c = 0xffffffff;
  bytes.forEach(byte => { c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); });
  return (c ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

writeFileSync(new URL("../examples/life-data-example.xlsx", import.meta.url), Buffer.from(zipStore(files)));

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
