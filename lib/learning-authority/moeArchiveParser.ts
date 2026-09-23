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
  manifestVersion: "1.0.0";
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
    parser: "deterministic-pdf-text-v1";
    extractedLineCount: number;
    standards: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: null }> }>[];
    objectives: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: null }> }>[];
    sequencing: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: null }> }>[];
    assessmentReferences: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: null }> }>[];
    resourceReferences: readonly Readonly<{ text: string; locator: Readonly<{ member: string; line: number; page: null }> }>[];
  }>;
}>;

type ZipEntry = Readonly<{ name: string; data: Buffer }>;

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

function decodePdfHexString(value: string): string {
  const bytes = Buffer.from(value, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) result += String.fromCharCode(bytes.readUInt16BE(index));
    return result;
  }
  return bytes.toString("latin1");
}

function extractPdfStreamText(stream: Buffer): string {
  const text = stream.toString("latin1");
  const parts: string[] = [];
  for (const match of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
    parts.push(decodePdfString(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }
  for (const match of text.matchAll(/<([0-9a-f]+)>\s*Tj/gi)) parts.push(decodePdfHexString(match[1]));
  for (const match of text.matchAll(/\[((?:\((?:\\.|[^\\)])*\)\s*)+)\]\s*TJ/g)) {
    const strings = match[1].match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    parts.push(strings.map((item) => decodePdfString(item.slice(1, -1))).join(""));
  }
  for (const match of text.matchAll(/\[((?:<(?:[0-9a-f]+)>\s*)+)\]\s*TJ/gi)) {
    const strings = match[1].match(/<(?:[0-9a-f]+)>/gi) ?? [];
    parts.push(strings.map((item) => decodePdfHexString(item.slice(1, -1))).join(""));
  }
  return parts.join("\n");
}

function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  const streams: Buffer[] = [];
  for (const match of source.matchAll(/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(match[2], "latin1");
    if (/FlateDecode/.test(match[1])) {
      try { streams.push(inflateSync(raw)); } catch { streams.push(raw); }
    } else streams.push(raw);
  }
  return streams.map(extractPdfStreamText).filter(Boolean).join("\n") || extractPdfStreamText(buffer);
}

export function extractMoePdfText(buffer: Buffer): string {
  return extractPdfText(buffer);
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

function evidence(lines: string[], pattern: RegExp, member: string) {
  return lines.flatMap((text, index) => pattern.test(text) ? [{ text, locator: { member, line: index + 1, page: null as null } }] : []);
}

export function parseMoeArchive(source: MoeArchiveSource, buffer: Buffer): IntermediateMoeManifest[] {
  const archiveChecksum = createHash("sha256").update(buffer).digest("hex");
  return readMoeArchivePdfEntries(buffer).map((entry) => {
    const lines = cleanLines(extractPdfText(entry.data));
    return {
      manifestVersion: "1.0.0",
      status: "INTERMEDIATE_REVIEW_ONLY",
      source: {
        archiveId: source.id, archiveDocument: source.document, archivePath: source.localPath,
        sourceUri: source.sourceUri, authority: source.authority, sourceMember: entry.name,
        sourceChecksum: archiveChecksum,
      },
      scope: { gradeMin: source.gradeMin, gradeMax: source.gradeMax, subject: subjectFromMember(entry.name) },
      extraction: {
        parser: "deterministic-pdf-text-v1",
        extractedLineCount: lines.length,
        standards: evidence(lines, /\bstandard\b|\bcompetenc/i, entry.name),
        objectives: evidence(lines, /\bobjective\b|\blearning outcome\b|\bstudents? will/i, entry.name),
        sequencing: evidence(lines, /semester|period|unit|topic|strand|lesson|week/i, entry.name),
        assessmentReferences: evidence(lines, /assessment|examination|test|question|evaluation/i, entry.name),
        resourceReferences: evidence(lines, /textbook|resource|materials|reference/i, entry.name),
      },
    } satisfies IntermediateMoeManifest;
  });
}

export function parseMoeArchiveJson(source: MoeArchiveSource, buffer: Buffer): string {
  return JSON.stringify({ source, manifests: parseMoeArchive(source, buffer) }, null, 2) + "\n";
}
