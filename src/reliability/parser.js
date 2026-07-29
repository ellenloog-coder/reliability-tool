export function parseDelimitedText(text, delimiter = null) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return { headers: [], rows: [] };
  const guessedDelimiter = delimiter || guessDelimiter(normalized);
  const table = parseCsv(normalized, guessedDelimiter);
  const headers = table[0].map((header, index) => String(header || `Column ${index + 1}`).trim());
  const rows = table.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  return { headers, rows };
}

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseDelimitedText(await file.text(), ",");
  if (name.endsWith(".tsv")) return parseDelimitedText(await file.text(), "\t");
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith(".xls")) return parseLegacyXls(await file.text());
  return parseDelimitedText(await file.text());
}

function guessDelimiter(text) {
  const line = text.split("\n")[0] || "";
  return (line.match(/\t/g) || []).length > (line.match(/,/g) || []).length ? "\t" : ",";
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter(cells => cells.some(value => String(value).trim()));
}

function parseLegacyXls(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("<") && /<table|<worksheet|<Workbook/i.test(trimmed)) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr")).map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    if (rows.length) return tableToRows(rows);
  }
  if (trimmed.includes("\t") || trimmed.includes(",")) return parseDelimitedText(trimmed);
  throw new Error("This .xls file appears to be a legacy binary workbook. Please save it as .xlsx, CSV, TSV, or Excel HTML/XML format for local browser parsing.");
}

async function parseXlsx(buffer) {
  const entries = await unzipEntries(buffer);
  const workbook = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Invalid XLSX workbook.");
  const firstSheetRelId = matchAttr(workbook, /<sheet\b[^>]*r:id="([^"]+)"/);
  const target = firstSheetRelId ? matchRelTarget(rels, firstSheetRelId) : "worksheets/sheet1.xml";
  const sheetPath = `xl/${target.replace(/^\/?xl\//, "")}`;
  const sheet = entries.get(sheetPath);
  if (!sheet) throw new Error("Unable to find the first XLSX worksheet.");
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  return tableToRows(parseSheetXml(sheet, sharedStrings));
}

async function unzipEntries(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const entries = new Map();
  let offset = 0;
  while (offset < bytes.length - 30) {
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
    const dataStart = nameStart + fileNameLength + extraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) entries.set(name, decoder.decode(data));
    else if (method === 8) entries.set(name, decoder.decode(await inflateRaw(data)));
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === "undefined") throw new Error("Compressed XLSX parsing is not available in this browser.");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(xml) {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map(match => stripTags(match[1]));
}

function parseSheetXml(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = matchAttr(cellMatch[0], /r="([A-Z]+)\d+"/);
      const index = ref ? columnIndex(ref) : row.length;
      const type = matchAttr(cellMatch[1], /t="([^"]+)"/);
      const value = matchAttr(cellMatch[2], /<v>([\s\S]*?)<\/v>/) ?? stripTags(matchAttr(cellMatch[2], /<is>([\s\S]*?)<\/is>/) ?? "");
      row[index] = type === "s" ? sharedStrings[Number(value)] ?? "" : decodeXml(value);
    }
    rows.push(row.map(value => value ?? ""));
  }
  return rows;
}

function tableToRows(table) {
  const headers = (table[0] || []).map((header, index) => String(header || `Column ${index + 1}`).trim());
  const rows = table.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  return { headers, rows };
}

function matchAttr(text, regex) {
  return (String(text).match(regex) || [])[1] ?? null;
}

function matchRelTarget(rels, id) {
  const match = Array.from(rels.matchAll(/<Relationship\b[^>]*>/g)).find(item => item[0].includes(`Id="${id}"`));
  return match ? matchAttr(match[0], /Target="([^"]+)"/) : null;
}

function columnIndex(ref) {
  return ref.split("").reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function stripTags(value) {
  return decodeXml(String(value).replace(/<[^>]+>/g, ""));
}

function decodeXml(value) {
  return String(value ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}
