/**
 * MOE objective structuring V1 (repository-only, no database access).
 *
 * Reads the already-decoded MOE archive pages in
 * curriculum/sources/intermediate/*.json (plus OCR text for scanned pages in
 * curriculum/sources/ocr/*.json when present), parses the topic tables with
 * lib/learning-authority/moeTopicTableParser.ts, and writes page-level
 * structured curriculum items with full provenance.
 *
 * Output (deterministic, no timestamps):
 *   curriculum/structured/moe-structured-v1.json   every item, counts, triage log
 *
 * Every item is imported as liberiaLearnReviewState=UNREVIEWED and
 * moeApprovalState=NOT_CLAIMED. Source provenance is not approval.
 *
 * Usage: npx tsx scripts/moe-objective-structuring-v1.ts [--check]
 *   --check  fail if the committed output differs from a fresh run.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readMoeArchivePdfEntries } from "@/lib/learning-authority/moeArchiveParser";
import { isLetterSpaced, MOE_TOPIC_TABLE_PARSER, normalizePageText, parseMoeTopicTables, type ParsedEntry } from "@/lib/learning-authority/moeTopicTableParser";
import { buildVocabulary, cutHeadingBleed, isTruncated, repairLetterSpacing, TRIAGE_VERSION, triageObjective, triageUnassigned, type TriagedItem, type TriageRecord } from "@/lib/learning-authority/structuredItemTriage";
import {
  IMPORT_MOE_APPROVAL_STATE, IMPORT_REVIEW_STATE, lacksActionVerb, validateStructuredItem,
  type ExtractionMethod, type StructuredCurriculumItem, type StructuredItemKind, type TextQualityFlag,
} from "@/lib/learning-authority/structuredCurriculumAuthority";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "curriculum/structured");
const ARCHIVES = ["GRADE-1-6", "GRADE-7-9", "Grade-10-12"] as const;
const IN_SCOPE = new Set(["MATH", "LITERACY", "SCIENCE", "SOCIAL_STUDIES"]);

type OcrPage = { page: number; text: string; engine: string; language: string };
type OcrFile = { archiveId: string; sourceMember: string; memberChecksum: string; pages: OcrPage[] };

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceSubjectOf(member: string): string {
  const name = (member.split("/").pop() ?? member).replace(/\.pdf$/i, "").replace(/[\d\-]+/g, " ").trim().toUpperCase();
  if (/ENGLISH GRAMMAR/.test(name)) return "ENGLISH_GRAMMAR";
  if (/ENGLISH/.test(name)) return "ENGLISH";
  if (/GENERAL SCIENCE/.test(name)) return "GENERAL_SCIENCE";
  if (/SOCIAL STUDIES/.test(name)) return "SOCIAL_STUDIES";
  if (/MATH/.test(name)) return "MATH";
  return name.split(/\s+/)[0]!.replace(/[^A-Z]/g, "");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function loadOcr(): Map<string, OcrFile> {
  const dir = path.join(ROOT, "curriculum/sources/ocr");
  const result = new Map<string, OcrFile>();
  if (!fs.existsSync(dir)) return result;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as OcrFile;
    result.set(data.sourceMember, data);
  }
  return result;
}

const SPACING_SUSPECT = /\s[a-z]{1,2}\s|\b[A-Za-z]\s[a-z]{2,}\b/;

/** Word vocabulary from all clean (not letter-spaced) decoded MOE pages, used to repair letter-spacing. */
function buildVocabularyFromSources() {
  const texts: string[] = [];
  for (const archiveFile of ARCHIVES) {
    const intermediate = JSON.parse(fs.readFileSync(path.join(ROOT, "curriculum/sources/intermediate", `${archiveFile}.json`), "utf8"));
    for (const manifest of intermediate.manifests) {
      for (const page of manifest.extraction.pages as { page: number; rawText: string }[]) {
        const text = normalizePageText(page.rawText ?? "", page.page);
        if (text && !isLetterSpaced(text)) texts.push(text);
      }
    }
  }
  return buildVocabulary(texts);
}

function memberChecksums(archiveFile: string): Map<string, string> {
  const buffer = fs.readFileSync(path.join(ROOT, "curriculum/sources/raw", `${archiveFile}.zip`));
  return new Map(readMoeArchivePdfEntries(buffer).map((entry) => [entry.name, sha256(entry.data)]));
}

type Summary = {
  archive: string; member: string; subject: string; sourceSubject: string; inScope: boolean;
  pages: number; decodedTextPages: number; ocrPages: number; pagesWithoutText: number[]; frontMatterPages: number[];
  blocks: number; objectives: number; objectivesByConfidence: Record<string, number>; activities: number; contents: number;
  materials: number; assessments: number; outcomes: number; unassigned: number; gradeAnomalies: number;
};

function main() {
  const check = process.argv.includes("--check");
  const ocr = loadOcr();
  const items: TriagedItem[] = [];
  const triageLog: { itemId?: string; member: string; page: number; decision: TriageRecord["decision"]; rule: string; text?: string }[] = [];
  const suppressed: { itemId?: string; member: string; page: number; rule: string; text: string }[] = [];
  const vocabulary = buildVocabularyFromSources();
  const summaries: Summary[] = [];
  const reviewQueue: { itemId?: string; member: string; page: number; reason: string; text?: string }[] = [];
  const ocrPagesUsed: { member: string; page: number }[] = [];

  for (const archiveFile of ARCHIVES) {
    const intermediate = JSON.parse(fs.readFileSync(path.join(ROOT, "curriculum/sources/intermediate", `${archiveFile}.json`), "utf8"));
    const checksums = memberChecksums(archiveFile);
    for (const manifest of intermediate.manifests) {
      const member: string = manifest.source.sourceMember;
      const subject: string = manifest.scope.subject;
      const inScope = IN_SCOPE.has(subject);
      const sourceSubject = sourceSubjectOf(member);
      const ocrFile = ocr.get(member);
      const pageMethod = new Map<number, ExtractionMethod>();
      const pages = manifest.extraction.pages.map((page: { page: number; rawText: string; status: string }) => {
        const ocrPage = page.status === "UNREADABLE" ? ocrFile?.pages.find((entry) => entry.page === page.page) : undefined;
        if (ocrPage) {
          pageMethod.set(page.page, "OCR_WINDOWS_MEDIA");
          ocrPagesUsed.push({ member, page: page.page });
          return { page: page.page, rawText: ocrPage.text };
        }
        pageMethod.set(page.page, page.status === "DECODED" ? "PDF_TEXT_DECODED" : "PDF_TEXT_UNMAPPED_FONT");
        return { page: page.page, rawText: page.rawText };
      });
      const parsed = parseMoeTopicTables(pages);
      const gradeMin: number = manifest.scope.gradeMin;
      const gradeMax: number = manifest.scope.gradeMax;

      const summary: Summary = {
        archive: archiveFile, member, subject, sourceSubject, inScope,
        pages: pages.length,
        decodedTextPages: [...pageMethod.values()].filter((method) => method !== "OCR_WINDOWS_MEDIA").length - parsed.pagesWithoutText.filter((page) => pageMethod.get(page) !== "OCR_WINDOWS_MEDIA").length,
        ocrPages: [...pageMethod.values()].filter((method) => method === "OCR_WINDOWS_MEDIA").length,
        pagesWithoutText: parsed.pagesWithoutText, frontMatterPages: parsed.frontMatterPages,
        blocks: parsed.blocks.length, objectives: 0, objectivesByConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        activities: 0, contents: 0, materials: 0, assessments: 0, outcomes: 0, unassigned: 0, gradeAnomalies: 0,
      };

      let previousGrade = 0;
      const usedIds = new Set<string>();
      for (const block of parsed.blocks) {
        const grade = block.grade;
        const gradeInRange = grade !== null && grade >= gradeMin && grade <= gradeMax;
        const outOfSequence = grade !== null && grade < previousGrade;
        if (grade !== null && grade > previousGrade) previousGrade = grade;
        const blockFlags: TextQualityFlag[] = outOfSequence ? ["SOURCE_GRADE_OUT_OF_SEQUENCE"] : [];
        if (!gradeInRange || outOfSequence) {
          summary.gradeAnomalies += 1;
          // In-range but out-of-sequence: keep the grade the source prints, flagged on every item.
          // Out-of-range: the block is outside this archive's grades and is not imported.
          triageLog.push({ member, page: block.pages[0]!, decision: gradeInRange ? "KEPT" : "SUPPRESSED",
            rule: gradeInRange ? `source_grade_${grade}_kept_out_of_sequence` : `grade_${grade}_outside_archive_${gradeMin}_${gradeMax}`, text: block.topic });
        }
        if (!gradeInRange || !inScope) {
          summary.objectives += block.objectives.length;
          continue;
        }
        const topicKey = [
          `g${grade}`, block.semester ? `s${block.semester}` : null, block.period ? `p${block.period}` : null,
          block.unit ? `u${block.unit.toLowerCase()}` : null, slug(block.topic),
        ].filter(Boolean).join("-");
        let blockId = `moe-${slug(sourceSubject)}-${topicKey}`;
        if (usedIds.has(blockId)) blockId = `${blockId}-b${block.blockIndex}`;
        usedIds.add(blockId);

        const emit = (kind: StructuredItemKind, entries: ParsedEntry[], code: string) => {
          for (const parsedEntry of entries) {
            const method = pageMethod.get(parsedEntry.page) ?? "PDF_TEXT_DECODED";
            const verbless = kind === "OBJECTIVE" && lacksActionVerb(parsedEntry.text);
            const flags = [...new Set<TextQualityFlag>([...parsedEntry.flags, ...blockFlags,
              ...(method === "OCR_WINDOWS_MEDIA" ? ["OCR_TEXT" as const] : []),
              ...(verbless ? ["OBJECTIVE_LACKS_ACTION_VERB" as const] : [])])].sort();
            const confidence = (method === "OCR_WINDOWS_MEDIA" || verbless) && parsedEntry.confidence === "HIGH" ? "MEDIUM" : parsedEntry.confidence;
            const item: StructuredCurriculumItem = {
              id: `${blockId}-${code}${parsedEntry.ordinal}`,
              kind, grade: grade!, subject, sourceSubject,
              semester: block.semester, period: block.period, unit: block.unit, topic: block.topic, topicKey: blockId,
              ordinal: parsedEntry.ordinal, text: parsedEntry.text, confidence, qualityFlags: flags,
              provenance: {
                sourceAuthority: "VERIFIED_LIBERIA_MOE_SOURCE",
                archiveId: manifest.source.archiveId, archiveDocument: manifest.source.archiveDocument,
                sourceUri: manifest.source.sourceUri, archiveChecksum: manifest.source.sourceChecksum,
                sourceMember: member, memberChecksum: checksums.get(member) ?? null,
                pages: [parsedEntry.page], extractionMethod: method, parser: MOE_TOPIC_TABLE_PARSER,
              },
              liberiaLearnReviewState: IMPORT_REVIEW_STATE,
              moeApprovalState: IMPORT_MOE_APPROVAL_STATE,
              moeApprovalEvidence: null,
            };
            const violations = validateStructuredItem(item);
            if (violations.length) throw new Error(`authority_invariant_failed:${item.id}:${violations.map((v) => v.rule).join(",")}`);
            const queued = kind === "OBJECTIVE" && (confidence === "LOW" || flags.includes("TAIL_BOUNDARY_UNCERTAIN") ||
              flags.includes("LETTER_SPACING_ARTIFACTS") || flags.includes("OCR_TEXT") || verbless ||
              isTruncated(parsedEntry.text) || cutHeadingBleed(parsedEntry.text) !== parsedEntry.text);
            if (queued) {
              // Every queued objective gets exactly one automated triage decision.
              const { item: decided, record } = triageObjective({ item, vocabulary });
              triageLog.push({ itemId: item.id, member, page: parsedEntry.page, decision: record.decision, rule: decided?.triage?.rule ?? record.rule, text: item.text });
              if (decided) items.push(decided);
              else suppressed.push({ itemId: item.id, member, page: parsedEntry.page, rule: record.rule, text: item.text });
              continue;
            }
            const repaired = SPACING_SUSPECT.test(` ${item.text} `) ? repairLetterSpacing(item.text, vocabulary) : item.text;
            if (repaired !== item.text) {
              const triage: TriageRecord = { decision: "CORRECTED", rule: "letter_spacing_repaired", by: TRIAGE_VERSION, originalText: item.text };
              items.push({ ...item, text: repaired, qualityFlags: item.qualityFlags.filter((flag) => flag !== "LETTER_SPACING_ARTIFACTS"), triage });
              triageLog.push({ itemId: item.id, member, page: parsedEntry.page, decision: "CORRECTED", rule: "letter_spacing_repaired" });
            } else {
              items.push(item);
            }
          }
        };
        emit("OUTCOME", block.outcomes, "out");
        emit("OBJECTIVE", block.objectives, "obj");
        emit("CONTENT", block.contents, "con");
        emit("ACTIVITY", block.activities, "act");
        emit("MATERIAL", block.materials, "mat");
        emit("COMPETENCY", block.competencies, "cmp");
        emit("ASSESSMENT_REFERENCE", block.assessments, "asr");
        // Unassigned table text: salvage assessment/material references, suppress the rest.
        let salvageOrdinal = 0;
        for (const entry of block.unassigned) {
          for (const outcome of triageUnassigned(entry.text)) {
            if (outcome.decision === "SUPPRESSED") {
              suppressed.push({ member, page: entry.page, rule: outcome.rule, text: entry.text.slice(0, 300) });
              triageLog.push({ member, page: entry.page, decision: "SUPPRESSED", rule: outcome.rule });
              continue;
            }
            const code = outcome.kind === "MATERIAL" ? "mat-u" : "asr-u";
            emit(outcome.kind, outcome.parts.map((part) => ({ ordinal: ++salvageOrdinal, text: part, page: entry.page, confidence: "LOW" as const, flags: ["CONTINUATION_PAGE_ASSIGNMENT" as const] })), code);
            triageLog.push({ member, page: entry.page, decision: "RECLASSIFIED", rule: outcome.rule, text: outcome.parts.join(" | ").slice(0, 200) });
          }
        }

        summary.objectives += block.objectives.length;
        for (const objective of items.filter((item) => item.kind === "OBJECTIVE" && item.topicKey === blockId)) {
          summary.objectivesByConfidence[objective.confidence] = (summary.objectivesByConfidence[objective.confidence] ?? 0) + 1;
        }
        summary.activities += block.activities.length;
        summary.contents += block.contents.length;
        summary.materials += block.materials.length;
        summary.assessments += block.assessments.length;
        summary.outcomes += block.outcomes.length;
        summary.unassigned += block.unassigned.length;
      }
      if (!parsed.blocks.length && inScope) {
        reviewQueue.push({ member, page: 0, reason: parsed.pagesWithoutText.length === pages.length ? "no text on any page (scanned PDF, OCR required)" : "no topic table header detected" });
      }
      summaries.push(summary);
    }
  }

  items.sort((a, b) => a.subject.localeCompare(b.subject) || a.grade - b.grade || a.id.localeCompare(b.id, "en", { numeric: true }));
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`duplicate_item_id:${item.id}`);
    ids.add(item.id);
  }

  if (reviewQueue.length) console.warn(`review queue not empty after triage: ${reviewQueue.length}`);
  const triageCounts = triageLog.reduce<Record<string, number>>((acc, entry) => ({ ...acc, [entry.decision]: (acc[entry.decision] ?? 0) + 1 }), {});
  const triageRules = triageLog.reduce<Record<string, number>>((acc, entry) => ({ ...acc, [entry.rule]: (acc[entry.rule] ?? 0) + 1 }), {});
  const inScopeSummaries = summaries.filter((summary) => summary.inScope);
  const objectives = items.filter((item) => item.kind === "OBJECTIVE");
  const byCell = new Map<string, { objectives: number; topics: Set<string> }>();
  for (const objective of objectives) {
    const key = `${objective.subject}|${objective.grade}`;
    const cell = byCell.get(key) ?? { objectives: 0, topics: new Set<string>() };
    cell.objectives += 1;
    cell.topics.add(objective.topicKey);
    byCell.set(key, cell);
  }
  const countKinds = Object.fromEntries(["OUTCOME", "OBJECTIVE", "CONTENT", "ACTIVITY", "MATERIAL", "COMPETENCY", "ASSESSMENT_REFERENCE"].map((kind) => [kind, items.filter((item) => item.kind === kind).length]));
  const report = {
    reportVersion: "1.0.0",
    parser: MOE_TOPIC_TABLE_PARSER,
    authorityNote: "MOE source provenance is not MOE approval. All items are UNREVIEWED and NOT_CLAIMED.",
    counts: {
      items: items.length,
      byKind: countKinds,
      objectivesByConfidence: objectives.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.confidence]: (acc[item.confidence] ?? 0) + 1 }), {}),
      objectivesByExtraction: objectives.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.provenance.extractionMethod]: (acc[item.provenance.extractionMethod] ?? 0) + 1 }), {}),
      topicBlocks: new Set(items.map((item) => item.topicKey)).size,
      cellsWithObjectives: byCell.size,
      reviewQueue: reviewQueue.length,
      triage: triageCounts,
      suppressed: suppressed.length,
      ocrPagesUsed: ocrPagesUsed.length,
      outOfScopeMembersParsedForCountsOnly: summaries.filter((summary) => !summary.inScope).length,
    },
    cells: [...byCell.entries()].map(([key, value]) => ({ subject: key.split("|")[0], grade: Number(key.split("|")[1]), objectives: value.objectives, topics: value.topics.size }))
      .sort((a, b) => a.subject!.localeCompare(b.subject!) || a.grade - b.grade),
    members: summaries,
    ocrPagesUsed,
    reviewQueue,
    triage: { version: TRIAGE_VERSION, note: "Automated triage empties the review queue. It is not LiberiaLearn human review and not MOE approval.", byDecision: triageCounts, byRule: triageRules },
    suppressed,
    items,
  };

  const json = `${JSON.stringify(report, null, 2)}\n`;
  const outFile = path.join(OUT_DIR, "moe-structured-v1.json");
  if (check) {
    const committed = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";
    if (committed !== json) { console.error("moe-structured-v1.json is stale; rerun without --check"); process.exit(1); }
    console.log("moe-structured-v1.json matches a fresh deterministic run");
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outFile, json);
  console.log(JSON.stringify({ counts: report.counts, inScopeMembers: inScopeSummaries.map((s) => ({ member: s.member, blocks: s.blocks, objectives: s.objectives, ocr: s.ocrPages, noText: s.pagesWithoutText.length })) }, null, 2));
}

main();
