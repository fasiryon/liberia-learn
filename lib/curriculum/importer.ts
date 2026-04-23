import { createHash } from "crypto";
import { inflateRawSync, inflateSync } from "zlib";

import { prisma } from "@/lib/db";
import { slugify } from "@/lib/curriculum-helpers";

type ImporterUser = {
  id: string;
  role: string;
  schoolId?: string | null;
};

type JsonRecord = Record<string, unknown>;

export type CurriculumImportInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  subject?: string;
  grade?: number;
};

export type NormalizedImportedLesson = {
  title: string;
  objectives: string[];
  body: string;
  assessment: string;
  teacherNotes: string | null;
  unitTitle: string;
  term: string | null;
};

export type NormalizedImportedCurriculum = {
  sourceFormat: "pdf" | "docx" | "text";
  sourceFileName: string;
  subject: string;
  grade: number;
  term: string | null;
  units: Array<{
    title: string;
    lessons: NormalizedImportedLesson[];
  }>;
  rawTextHash: string;
  rawTextPreview: string;
};

function asCleanLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function stripXml(value: string) {
  return value
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (offset < buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const fileName = buffer
      .subarray(offset + 30, offset + 30 + fileNameLength)
      .toString("utf8");
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = buffer.subarray(dataStart, dataEnd);

    if (method === 0) {
      entries.set(fileName, Buffer.from(compressed));
    } else if (method === 8) {
      entries.set(fileName, inflateRawSync(compressed));
    }

    offset = dataEnd;
  }

  return entries;
}

function extractDocxText(buffer: Buffer) {
  const documentXml = readZipEntries(buffer).get("word/document.xml");
  if (!documentXml) {
    throw Object.assign(new Error("DOCX document.xml not found"), { status: 400 });
  }

  const xml = documentXml.toString("utf8");
  return xml
    .split(/<\/w:p>/g)
    .map(stripXml)
    .filter(Boolean)
    .join("\n");
}

function decodePdfString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfStreamText(stream: Buffer) {
  const text = stream.toString("latin1");
  const parts: string[] = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  for (const match of text.matchAll(literalRegex)) {
    parts.push(decodePdfString(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  const arrayRegex = /\[((?:\((?:\\.|[^\\)])*\)\s*)+)\]\s*TJ/g;
  for (const match of text.matchAll(arrayRegex)) {
    const segment = match[1];
    const strings = segment.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    parts.push(strings.map((item) => decodePdfString(item.slice(1, -1))).join(""));
  }

  return parts.join("\n");
}

function extractPdfText(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const streams: Buffer[] = [];
  const streamRegex = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamRegex)) {
    const dict = match[1];
    const raw = Buffer.from(match[2], "latin1");
    if (/FlateDecode/.test(dict)) {
      try {
        streams.push(inflateSync(raw));
      } catch {
        streams.push(raw);
      }
    } else {
      streams.push(raw);
    }
  }

  const extracted = streams.map(extractPdfStreamText).filter(Boolean).join("\n");
  if (extracted.trim()) return extracted;

  return extractPdfStreamText(buffer);
}

function detectSourceFormat(fileName: string, mimeType: string): NormalizedImportedCurriculum["sourceFormat"] {
  const lower = fileName.toLowerCase();
  if (mimeType.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    mimeType.includes("wordprocessingml") ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  return "text";
}

export function extractCurriculumImportText(input: CurriculumImportInput) {
  const format = detectSourceFormat(input.fileName, input.mimeType);
  if (format === "pdf") return { format, text: extractPdfText(input.buffer) };
  if (format === "docx") return { format, text: extractDocxText(input.buffer) };
  return { format, text: input.buffer.toString("utf8") };
}

function parseJsonCurriculum(text: string) {
  try {
    const parsed = JSON.parse(text) as JsonRecord;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readScalar(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeFromJson(
  parsed: JsonRecord,
  fallback: { subject: string; grade: number; fileName: string; format: NormalizedImportedCurriculum["sourceFormat"]; rawText: string }
): NormalizedImportedCurriculum | null {
  const unitsInput = Array.isArray(parsed.units) ? parsed.units : [];
  if (unitsInput.length === 0 && !Array.isArray(parsed.lessons)) {
    return null;
  }

  const subject = readScalar(parsed, "subject") ?? fallback.subject;
  const gradeValue = Number(parsed.grade ?? fallback.grade);
  const grade = Number.isInteger(gradeValue) && gradeValue >= 1 && gradeValue <= 12 ? gradeValue : fallback.grade;
  const term = readScalar(parsed, "term");
  const rawLessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
  const units = (unitsInput.length > 0 ? unitsInput : [{ title: readScalar(parsed, "unit") ?? "Imported Unit", lessons: rawLessons }])
    .map((unit, unitIndex) => {
      const unitRecord = unit && typeof unit === "object" ? (unit as JsonRecord) : {};
      const unitTitle = readScalar(unitRecord, "title") ?? `Imported Unit ${unitIndex + 1}`;
      const lessons = (Array.isArray(unitRecord.lessons) ? unitRecord.lessons : []).map((lesson, lessonIndex) => {
        const lessonRecord = lesson && typeof lesson === "object" ? (lesson as JsonRecord) : {};
        return {
          title: readScalar(lessonRecord, "title") ?? `Imported Lesson ${lessonIndex + 1}`,
          objectives: readArray(lessonRecord.objectives ?? lessonRecord.objective),
          body: readScalar(lessonRecord, "body") ?? readScalar(lessonRecord, "content") ?? "",
          assessment: readScalar(lessonRecord, "assessment") ?? readArray(lessonRecord.assessments).join("\n"),
          teacherNotes: readScalar(lessonRecord, "teacherNotes") ?? readScalar(lessonRecord, "teacher_notes"),
          unitTitle,
          term,
        } satisfies NormalizedImportedLesson;
      });
      return { title: unitTitle, lessons };
    })
    .filter((unit) => unit.lessons.length > 0);

  return {
    sourceFormat: fallback.format,
    sourceFileName: fallback.fileName,
    subject,
    grade,
    term,
    units,
    rawTextHash: createHash("sha256").update(fallback.rawText).digest("hex"),
    rawTextPreview: fallback.rawText.slice(0, 1200),
  };
}

function extractValue(line: string, label: string) {
  const pattern = new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, "i");
  return line.match(pattern)?.[1]?.trim() ?? null;
}

function normalizeFromText(params: {
  text: string;
  subject: string;
  grade: number;
  fileName: string;
  format: NormalizedImportedCurriculum["sourceFormat"];
}): NormalizedImportedCurriculum {
  const lines = asCleanLines(params.text);
  const subject =
    lines.map((line) => extractValue(line, "subject")).find(Boolean) ?? params.subject;
  const gradeText = lines.map((line) => extractValue(line, "grade")).find(Boolean);
  const gradeNumber = Number(gradeText?.match(/\d+/)?.[0] ?? params.grade);
  const grade =
    Number.isInteger(gradeNumber) && gradeNumber >= 1 && gradeNumber <= 12
      ? gradeNumber
      : params.grade;
  const term = lines.map((line) => extractValue(line, "term")).find(Boolean) ?? null;

  const unitChunks: Array<{ title: string; lines: string[] }> = [];
  let currentUnit = { title: "Imported Unit", lines: [] as string[] };
  for (const line of lines) {
    if (/^(subject|grade|term)\s*[:\-]/i.test(line)) {
      continue;
    }
    const unitTitle = extractValue(line, "unit") ?? (/^unit\s+\d+/i.test(line) ? line : null);
    if (unitTitle && currentUnit.lines.length > 0) {
      unitChunks.push(currentUnit);
      currentUnit = { title: unitTitle, lines: [] };
      continue;
    }
    if (unitTitle) {
      currentUnit.title = unitTitle;
      continue;
    }
    currentUnit.lines.push(line);
  }
  unitChunks.push(currentUnit);

  const units = unitChunks
    .map((unit) => {
      const lessonChunks: Array<{ title: string; lines: string[] }> = [];
      let currentLesson = { title: unit.title, lines: [] as string[] };
      for (const line of unit.lines) {
        const lessonTitle = extractValue(line, "lesson") ?? (/^lesson\s+\d+/i.test(line) ? line : null);
        if (lessonTitle && currentLesson.lines.length > 0) {
          lessonChunks.push(currentLesson);
          currentLesson = { title: lessonTitle, lines: [] };
          continue;
        }
        if (lessonTitle) {
          currentLesson.title = lessonTitle;
          continue;
        }
        currentLesson.lines.push(line);
      }
      lessonChunks.push(currentLesson);

      const lessons = lessonChunks
        .map((lesson, index) => {
          const objectives = lesson.lines
            .map((line) => extractValue(line, "objective") ?? extractValue(line, "objectives"))
            .filter((value): value is string => Boolean(value))
            .flatMap((value) => value.split(/;|\|/g).map((item) => item.trim()).filter(Boolean));
          const assessment =
            lesson.lines.map((line) => extractValue(line, "assessment")).find(Boolean) ??
            "Teacher checks for correct explanation and independent practice accuracy.";
          const teacherNotes =
            lesson.lines.map((line) => extractValue(line, "teacher notes")).find(Boolean) ??
            lesson.lines.map((line) => extractValue(line, "teacher note")).find(Boolean) ??
            null;
          const body = lesson.lines
            .filter(
              (line) =>
                !/^(subject|grade|term|objective|objectives|assessment|teacher notes?)\s*[:\-]/i.test(line)
            )
            .join("\n");
          return {
            title: lesson.title || `Imported Lesson ${index + 1}`,
            objectives: objectives.length > 0 ? objectives : [`Understand ${lesson.title || unit.title}.`],
            body,
            assessment,
            teacherNotes,
            unitTitle: unit.title,
            term,
          } satisfies NormalizedImportedLesson;
        })
        .filter((lesson) => lesson.body.trim().length > 0 || lesson.objectives.length > 0);

      return { title: unit.title, lessons };
    })
    .filter((unit) => unit.lessons.length > 0);

  return {
    sourceFormat: params.format,
    sourceFileName: params.fileName,
    subject,
    grade,
    term,
    units,
    rawTextHash: createHash("sha256").update(params.text).digest("hex"),
    rawTextPreview: params.text.slice(0, 1200),
  };
}

export function normalizeImportedCurriculum(input: {
  text: string;
  format: NormalizedImportedCurriculum["sourceFormat"];
  fileName: string;
  subject?: string;
  grade?: number;
}) {
  const subject = input.subject?.trim() || "GENERAL";
  const grade = input.grade && input.grade >= 1 && input.grade <= 12 ? input.grade : 1;
  const parsed = parseJsonCurriculum(input.text);
  const normalizedFromJson = parsed
    ? normalizeFromJson(parsed, {
        subject,
        grade,
        fileName: input.fileName,
        format: input.format,
        rawText: input.text,
      })
    : null;
  const normalized =
    normalizedFromJson ??
    normalizeFromText({
      text: input.text,
      subject,
      grade,
      fileName: input.fileName,
      format: input.format,
    });

  if (normalized.units.length === 0) {
    throw Object.assign(new Error("No usable units or lessons found in import."), {
      status: 400,
    });
  }

  for (const unit of normalized.units) {
    for (const lesson of unit.lessons) {
      if (!lesson.title.trim() || (!lesson.body.trim() && lesson.objectives.length === 0)) {
        throw Object.assign(new Error("Imported lessons must have a title and usable content."), {
          status: 400,
        });
      }
    }
  }

  return normalized;
}

export async function persistImportedCurriculum(params: {
  imported: NormalizedImportedCurriculum;
  user: ImporterUser;
}) {
  const { imported, user } = params;
  const importedAt = new Date();
  const version = await prisma.curriculumVersion.create({
    data: {
      versionName: `import-${slugify(imported.sourceFileName.replace(/\.[^.]+$/, ""))}-${importedAt.getTime()}`,
      status: "DRAFT",
      createdById: user.id,
    },
    select: { id: true, versionName: true },
  });

  const created = [];
  const seenHashes = new Set<string>();
  for (const [unitIndex, unit] of imported.units.entries()) {
    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      const payload = {
        title: lesson.title,
        subject: imported.subject,
        grade: imported.grade,
        term: lesson.term,
        unitTitle: unit.title,
        body: lesson.body,
        objectives: lesson.objectives,
        assessment: lesson.assessment,
        teacherNotes: lesson.teacherNotes,
        source: {
          type: "curriculum_import",
          format: imported.sourceFormat,
          fileName: imported.sourceFileName,
          rawTextHash: imported.rawTextHash,
          importedAt: importedAt.toISOString(),
          importedByUserId: user.id,
        },
        approvalStatus: "PENDING_APPROVAL",
        originalImportedVersion: true,
      };
      const payloadString = JSON.stringify(payload);
      const hash = createHash("sha256").update(payloadString).digest("hex");
      if (seenHashes.has(hash)) {
        continue;
      }
      seenHashes.add(hash);

      const contentId = `import-${imported.subject.toLowerCase()}-g${imported.grade}-${slugify(unit.title)}-${lessonIndex + 1}-${hash.slice(0, 8)}`;
      const record = await prisma.curriculumContent.upsert({
        where: { contentId },
        update: {
          title: lesson.title,
          grade: imported.grade,
          subject: imported.subject,
          contentType: "lesson",
          status: "pending_approval",
          version: version.versionName,
          payload,
          hash,
          unitId: `import-${slugify(unit.title)}`,
          orderInUnit: unitIndex * 100 + lessonIndex + 1,
          versionId: version.id,
        },
        create: {
          contentId,
          title: lesson.title,
          grade: imported.grade,
          subject: imported.subject,
          contentType: "lesson",
          status: "pending_approval",
          version: version.versionName,
          payload,
          moeAlignments: [],
          hash,
          unitId: `import-${slugify(unit.title)}`,
          orderInUnit: unitIndex * 100 + lessonIndex + 1,
          lessonType: "core",
          teacherCreated: user.role === "TEACHER",
          versionId: version.id,
        },
        select: {
          id: true,
          contentId: true,
          title: true,
        },
      });
      created.push(record);
    }
  }

  if (created.length === 0) {
    throw Object.assign(new Error("Import contained only duplicate lessons."), {
      status: 409,
    });
  }

  return {
    version,
    importedLessons: created,
    unitCount: imported.units.length,
    lessonCount: created.length,
  };
}
