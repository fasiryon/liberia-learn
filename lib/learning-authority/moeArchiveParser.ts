import { createHash } from "node:crypto";
import { inflateRawSync, inflateSync } from "node:zlib";

export type MoeArchiveSource = Readonly<{
  id: string;
  document: string;
  localPath: string;
  sourceUri: string;
  authority: "VERIFIED_LIBERIA_MOE_SOURCE";
  gradeMin: number;
  gradeMax: number;
}>;

export type IntermediateMoeManifest = Readonly<{
  manifestVersion: "1.2.0";
  status: "INTERMEDIATE_REVIEW_ONLY";
  source: Readonly<{
    archiveId: string;
    archiveDocument: string;
    archivePath: string;
    sourceUri: string;
    authority: "VERIFIED_LIBERIA_MOE_SOURCE";
    sourceMember: string;
    sourceChecksum: string;
  }>;
  scope: Readonly<{ gradeMin: number; gradeMax: number; subject: string }>;
  extraction: Readonly<{
    parser: "deterministic-pdf-page-text-v3";
    extractedLineCount: number;
    pageCount: number;
    decodedPageCount: number;
    unreadablePageCount: number;
    reviewQueue: readonly Readonly<{ page: number; reason: string; confidence: "LOW" | "MEDIUM" }>[];
    pages: readonly Readonly<{
      page: number;
      rawText: string;
      status: "DECODED" | "PARTIAL" | "UNREADABLE";
      candidates: readonly Readonly<{ kind: "STANDARD" | "OBJECTIVE" | "SEQUENCING" | "ASSESSMENT" | "RESOURCE"; text: string; confidence: "LOW" | "MEDIUM"; section: string | null; line: number }>[];
    }>[];
    standards: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: number }>; confidence: "LOW" | "MEDIUM" }>[];
    objectives: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: number }>; confidence: "LOW" | "MEDIUM" }>[];
    sequencing: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: number }>; confidence: "LOW" | "MEDIUM" }>[];
    assessmentReferences: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: number }>; confidence: "LOW" | "MEDIUM" }>[];
    resourceReferences: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: number }>; confidence: "LOW" | "MEDIUM" }>[];
  }>;
}>;

type ZipEntry = Readonly<{ name: string; data: Buffer }>;
type PdfObject = Readonly<{ id: string; body: string }>;
type UnicodeMap = ReadonlyMap<number, string>;

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset <= buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) { offset += 1; continue; }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error(`unsupported_zip_method:${method}:${name}`);
    entries.push({ name, data });
    offset = start + compressedSize;
  }
  return entries;
}

export function readMoeArchivePdfEntries(buffer: Buffer): readonly ZipEntry[] {
  return readZipEntries(buffer).filter((entry) => entry.name.toLowerCase().endsWith(".pdf"));
}

function decodePdfString(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, " ")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
}

function decodePdfHexString(value: string, unicodeMap: UnicodeMap = new Map()): string {
  const bytes = Buffer.from(value, "hex");
  if (unicodeMap.size) {
    const width = value.length % 4 === 0 ? 4 : 2;
    let mapped = "";
    for (let index = 0; index < value.length; index += width) {
      const code = Number.parseInt(value.slice(index, index + width), 16);
      mapped += unicodeMap.get(code) ?? String.fromCharCode(code);
    }
    return mapped;
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) result += String.fromCharCode(bytes.readUInt16BE(index));
    return result;
  }
  return bytes.toString("latin1");
}

function decodePdfTextArray(value: string, unicodeMap: UnicodeMap): string {
  const tokens: string[] = value.match(/\((?:\\.|[^\\)])*\)|<(?:[0-9a-f]+)>|-?\d+(?:\.\d+)?/gi) ?? [];
  return tokens.filter((token) => token.startsWith("(") || token.startsWith("<"))
    .map((token) => token.startsWith("(") ? decodePdfString(token.slice(1, -1)) : decodePdfHexString(token.slice(1, -1), unicodeMap))
    .join("");
}

function extractPdfStreamText(stream: Buffer, unicodeMap: UnicodeMap = new Map(), fontMaps: ReadonlyMap<string, UnicodeMap> = new Map()): string {
  const text = stream.toString("latin1");
  const parts: string[] = [];
  const fonts = [...text.matchAll(/\/([^\s]+)\s+[-\d.]+\s+Tf/g)];
  const operators = /(?:\((?:\\.|[^\\)])*\)\s*Tj|<(?:[0-9a-f]+)>\s*Tj|\[((?:\\.|[^\]])*)\]\s*TJ)/gi;
  for (const match of text.matchAll(operators)) {
    const activeFont = fonts.filter((font) => (font.index ?? 0) < (match.index ?? 0)).at(-1)?.[1];
    const activeMap = (activeFont && fontMaps.get(activeFont)) ?? unicodeMap;
    const value = match[0];
    if (/\]\s*TJ$/i.test(value)) parts.push(decodePdfTextArray(value.slice(1, value.lastIndexOf("]")), activeMap));
    else if (/^</.test(value)) parts.push(decodePdfHexString(value.slice(1, value.indexOf(">")), activeMap));
    else parts.push(decodePdfString(value.slice(1, value.lastIndexOf(")"))));
  }
  return parts.join("\n");
}

function pdfObjects(buffer: Buffer): PdfObject[] {
  const source = buffer.toString("latin1");
  return [...source.matchAll(/(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g)].map((match) => ({ id: `${match[1]} ${match[2]}`, body: match[3] }));
}

function decodePdfStream(body: string): Buffer {
  const match = body.match(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!match) return Buffer.from(body, "latin1");
  const raw = Buffer.from(match[2], "latin1");
  if (/FlateDecode/.test(match[1])) {
    try { return inflateSync(raw); } catch { return raw; }
  }
  return raw;
}

function unicodeMaps(objects: readonly PdfObject[]): ReadonlyMap<string, UnicodeMap> {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const result = new Map<string, UnicodeMap>();
  for (const object of objects) {
    const target = object.body.match(/\/ToUnicode\s+(\d+)\s+(\d+)\s+R/);
    if (!target) continue;
    const cmapObject = byId.get(`${target[1]} ${target[2]}`);
    if (!cmapObject) continue;
    const text = decodePdfStream(cmapObject.body).toString("latin1");
    const map = new Map<number, string>();
    const destination = (hex: string) => {
      const value = Buffer.from(hex, "hex");
      const start = value.length >= 2 && value[0] === 0xfe && value[1] === 0xff ? 2 : 0;
      if (value.length - start >= 2) return String.fromCharCode(...Array.from({ length: Math.floor((value.length - start) / 2) }, (_, i) => value.readUInt16BE(start + i * 2)));
      return value.toString("latin1");
    };
    for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/gi)) {
      for (const match of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(Number.parseInt(match[1], 16), destination(match[2]));
    }
    for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/gi)) {
      for (const match of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(?:<([0-9a-f]+)>|\[((?:\s*<[0-9a-f]+>\s*)+)\])/gi)) {
        const start = Number.parseInt(match[1], 16);
        const end = Number.parseInt(match[2], 16);
        const values = match[4]?.match(/<([0-9a-f]+)>/gi)?.map((item) => destination(item.slice(1, -1))) ?? [];
        const base = match[3] ? Number.parseInt(match[3], 16) : 0;
        for (let code = start; code <= end; code++) map.set(code, values.length ? values[code - start] : String.fromCodePoint(base + code - start));
      }
    }
    result.set(object.id, map);
  }
  return result;
}

function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  const objects = pdfObjects(buffer);
  const maps = unicodeMaps(objects);
  const streams: Buffer[] = [];
  for (const match of source.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(match[2], "latin1");
    if (/FlateDecode/.test(match[1])) {
      try { streams.push(inflateSync(raw)); } catch { streams.push(raw); }
    } else streams.push(raw);
  }
  return streams.map((stream) => extractPdfStreamText(stream, maps.values().next().value ?? new Map())).filter(Boolean).join("\n") || extractPdfStreamText(buffer);
}

function pageFontMaps(pageObject: PdfObject, byId: ReadonlyMap<string, PdfObject>, maps: ReadonlyMap<string, UnicodeMap>) {
  const resourcesRef = pageObject.body.match(/\/Resources\s+(\d+)\s+(\d+)\s+R/);
  const resources = resourcesRef ? byId.get(`${resourcesRef[1]} ${resourcesRef[2]}`)?.body ?? "" : pageObject.body;
  const fontBlock = resources.match(/\/Font\s*<<([\s\S]*?)>>/);
  const result = new Map<string, UnicodeMap>();
  for (const match of (fontBlock?.[1] ?? "").matchAll(/\/([^\s]+)\s+(\d+)\s+(\d+)\s+R/g)) {
    const map = maps.get(`${match[2]} ${match[3]}`);
    if (map) result.set(match[1], map);
  }
  return result;
}

export function extractMoePdfText(buffer: Buffer): string {
  return extractPdfText(buffer);
}

type PdfPageText = Readonly<{ page: number; rawText: string; status: "DECODED" | "PARTIAL" | "UNREADABLE" }>;

function extractPdfPages(buffer: Buffer): PdfPageText[] {
  const objects = pdfObjects(buffer);
  const byId = new Map(objects.map((object) => [object.id, object]));
  const maps = unicodeMaps(objects);
  const combinedMap = new Map<number, string>();
  for (const map of maps.values()) for (const [code, value] of map) combinedMap.set(code, value);
  const pages = objects.filter((object) => /\/Type\s*\/Page(?:\s|\/)/.test(object.body));
  const parsed = pages.map((pageObject, index) => {
    const contents = pageObject.body.match(/\/Contents\s*(?:\[([\s\S]*?)\]|(\d+\s+\d+\s+R))/);
    const references = (contents?.[1] ?? contents?.[2] ?? "").match(/\d+\s+\d+\s+R/g) ?? [];
    const fontMaps = pageFontMaps(pageObject, byId, maps);
    const streams = references.map((reference) => byId.get(reference.replace(/\s+R$/, "").replace(/\s+/, " "))).filter(Boolean).map((object) => extractPdfStreamText(decodePdfStream(object!.body), combinedMap, fontMaps));
    const rawText = streams.filter(Boolean).join("\n");
    return { page: index + 1, rawText, status: rawText.trim() ? (fontMaps.size ? "DECODED" : "PARTIAL") : "UNREADABLE" } satisfies PdfPageText;
  });
  if (parsed.length) return parsed;
  const fallback = extractPdfText(buffer);
  return [{ page: 1, rawText: fallback, status: fallback.trim() ? "PARTIAL" : "UNREADABLE" }];
}

function cleanLines(text: string): string[] {
  return text.replace(/\r/g, "\n").split(/\n|\f/g).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function subjectFromMember(member: string): string {
  const name = member.split("/").pop()?.toUpperCase() ?? member.toUpperCase();
  if (name.includes("ENGLISH")) return "LITERACY";
  if (name.includes("SCIENCE")) return "SCIENCE";
  if (name.includes("MATH")) return "MATH";
  if (name.includes("SOCIAL STUDIES")) return "SOCIAL_STUDIES";
  if (name.includes("BIOLOGY") || name.includes("CHEMISTRY") || name.includes("PHYSICS")) return "SCIENCE";
  if (name.includes("GEOGRAPHY") || name.includes("HISTORY")) return "SOCIAL_STUDIES";
  return "UNMAPPED_SOURCE_SUBJECT";
}

type CandidateKind = "STANDARD" | "OBJECTIVE" | "SEQUENCING" | "ASSESSMENT" | "RESOURCE";

function pageCandidates(page: PdfPageText) {
  const lines = cleanLines(page.rawText);
  const section = lines.find((line) => /^(standard|competenc|objective|unit|strand|topic|semester|period)\b/i.test(line)) ?? null;
  const candidates: Array<{ kind: CandidateKind; text: string; confidence: "LOW" | "MEDIUM"; section: string | null; line: number }> = [];
  for (const [index, text] of lines.entries()) {
    const matches: Array<[CandidateKind, RegExp]> = [
      ["STANDARD", /^(?:content )?standard(?:s)?\b|^competenc(?:y|ies)\b/i],
      ["OBJECTIVE", /^(?:specific )?objective(?:s)?\b|^students?\s+(?:will|should|can)\b/i],
      ["SEQUENCING", /^(?:semester|period|unit|strand|topic|lesson|week)\b/i],
      ["ASSESSMENT", /^(?:assessment|examination|test|question|evaluation)\b/i],
      ["RESOURCE", /^(?:textbook|resource|materials?|reference)\b/i],
    ];
    for (const [kind, pattern] of matches) if (pattern.test(text)) candidates.push({ kind, text, confidence: page.status === "DECODED" ? "MEDIUM" : "LOW", section, line: index + 1 });
  }
  return candidates;
}

export function parseMoeArchive(source: MoeArchiveSource, buffer: Buffer): IntermediateMoeManifest[] {
  const archiveChecksum = createHash("sha256").update(buffer).digest("hex");
  return readMoeArchivePdfEntries(buffer).map((entry) => {
    const pages = extractPdfPages(entry.data);
    const pageRecords = pages.map((page) => ({ page: page.page, rawText: page.rawText, status: page.status, candidates: pageCandidates(page) }));
    const candidates = pageRecords.flatMap((page) => page.candidates.map((candidate) => ({ ...candidate, locator: { member: entry.name, line: candidate.line, page: page.page } })));
    const reviewQueue = pageRecords.filter((page) => page.status !== "DECODED" || page.candidates.length === 0).map((page) => ({ page: page.page, reason: page.status === "UNREADABLE" ? "No decodable text stream." : page.candidates.length === 0 ? "Readable text lacks a reliable standards/objectives heading; human review required." : "Text decoded without complete font mapping.", confidence: "LOW" as const }));
    const standards = candidates.filter((candidate) => candidate.kind === "STANDARD");
    const objectives = candidates.filter((candidate) => candidate.kind === "OBJECTIVE");
    return {
      manifestVersion: "1.2.0",
      status: "INTERMEDIATE_REVIEW_ONLY",
      source: {
        archiveId: source.id, archiveDocument: source.document, archivePath: source.localPath,
        sourceUri: source.sourceUri, authority: source.authority, sourceMember: entry.name,
        sourceChecksum: archiveChecksum,
      },
      scope: { gradeMin: source.gradeMin, gradeMax: source.gradeMax, subject: subjectFromMember(entry.name) },
      extraction: {
        parser: "deterministic-pdf-page-text-v3",
        extractedLineCount: pageRecords.reduce((total, page) => total + cleanLines(page.rawText).length, 0),
        pageCount: pageRecords.length,
        decodedPageCount: pageRecords.filter((page) => page.status === "DECODED").length,
        unreadablePageCount: pageRecords.filter((page) => page.status === "UNREADABLE").length,
        reviewQueue,
        pages: pageRecords,
        standards, objectives,
        sequencing: candidates.filter((candidate) => candidate.kind === "SEQUENCING"),
        assessmentReferences: candidates.filter((candidate) => candidate.kind === "ASSESSMENT"),
        resourceReferences: candidates.filter((candidate) => candidate.kind === "RESOURCE"),
      },
    } satisfies IntermediateMoeManifest;
  });
}

export function parseMoeArchiveJson(source: MoeArchiveSource, buffer: Buffer): string {
  return JSON.stringify({ source, manifests: parseMoeArchive(source, buffer) }, null, 2) + "\n";
}
