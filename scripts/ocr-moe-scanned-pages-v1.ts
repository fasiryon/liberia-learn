/**
 * OCR only the MOE pages that genuinely failed PDF text decoding.
 *
 * A page qualifies when the intermediate extraction marked it UNREADABLE (no
 * decodable text stream). Pages marked PARTIAL already carry usable text and
 * are NOT re-extracted. OCR uses the built-in Windows OCR engine through
 * scripts/ocr/windows-ocr-pdf.ps1; the page text is then rebuilt from line
 * geometry (lib/learning-authority/ocrTableLayout.ts).
 *
 * Output: curriculum/sources/ocr/<archive>--<member>.json
 * Usage:  npx tsx scripts/ocr-moe-scanned-pages-v1.ts   (Windows only)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readMoeArchivePdfEntries } from "@/lib/learning-authority/moeArchiveParser";
import { ocrPageToText, type OcrLine } from "@/lib/learning-authority/ocrTableLayout";

const ROOT = process.cwd();
const ARCHIVES = ["GRADE-1-6", "GRADE-7-9", "Grade-10-12"] as const;
const IN_SCOPE = new Set(["MATH", "LITERACY", "SCIENCE", "SOCIAL_STUDIES"]);

type PsPage = { page: number; width: number; height: number; text: string; lines: OcrLine[] | OcrLine | null };

function main() {
  if (process.platform !== "win32") throw new Error("Windows OCR requires Windows");
  const outDir = path.join(ROOT, "curriculum/sources/ocr");
  fs.mkdirSync(outDir, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "moe-ocr-"));
  const summary: { member: string; pages: number[] }[] = [];

  for (const archive of ARCHIVES) {
    const intermediate = JSON.parse(fs.readFileSync(path.join(ROOT, "curriculum/sources/intermediate", `${archive}.json`), "utf8"));
    const entries = new Map(readMoeArchivePdfEntries(fs.readFileSync(path.join(ROOT, "curriculum/sources/raw", `${archive}.zip`))).map((entry) => [entry.name, entry.data]));
    for (const manifest of intermediate.manifests) {
      if (!IN_SCOPE.has(manifest.scope.subject)) continue;
      const unreadable: number[] = manifest.extraction.pages.filter((page: { status: string }) => page.status === "UNREADABLE").map((page: { page: number }) => page.page);
      if (!unreadable.length) continue;
      const member: string = manifest.source.sourceMember;
      const data = entries.get(member);
      if (!data) throw new Error(`member_missing:${member}`);
      const pdfPath = path.join(work, "member.pdf");
      const jsonPath = path.join(work, "ocr.json");
      fs.writeFileSync(pdfPath, data);
      execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(ROOT, "scripts/ocr/windows-ocr-pdf.ps1"), "-PdfPath", pdfPath, "-OutPath", jsonPath], { stdio: "inherit" });
      const ocr = JSON.parse(fs.readFileSync(jsonPath, "utf8").replace(/^﻿/, ""));
      const pages = (ocr.pages as PsPage[]).filter((page) => unreadable.includes(page.page)).map((page) => {
        const lines = page.lines == null ? [] : Array.isArray(page.lines) ? page.lines : [page.lines];
        return { page: page.page, width: page.width, height: page.height, text: ocrPageToText(lines), ocrText: page.text, lines };
      });
      const record = {
        archiveId: manifest.source.archiveId,
        sourceMember: member,
        memberChecksum: createHash("sha256").update(data).digest("hex"),
        engine: ocr.engine,
        language: ocr.language,
        scale: ocr.scale,
        selection: "pages marked UNREADABLE by deterministic-pdf-page-text-v3 (no decodable text stream)",
        pages,
      };
      const file = `${archive}--${member.split("/").pop()!.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9]+/g, "-")}.json`;
      fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(record, null, 2)}\n`);
      summary.push({ member, pages: pages.map((page) => page.page) });
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
  console.log(JSON.stringify({ ocrMembers: summary.length, ocrPages: summary.reduce((total, entry) => total + entry.pages.length, 0), summary }, null, 2));
}

main();
