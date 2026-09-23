import fs from "node:fs";
import path from "node:path";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "../lib/learning-authority/governedGrade4Math";
import { validateReleaseManifest, type ReleaseManifest } from "../lib/learning-authority/releaseManifests";

const root = process.cwd();
const scope = JSON.parse(fs.readFileSync(path.join(root, "curriculum/releases/k12-scope.json"), "utf8")) as {
  scope: { grades: number[]; subjects: string[] };
  registeredReleases: Array<{ releaseId: string; grade: number; subject: string; sourceRef: string; authority: ReleaseManifest["provenance"]["authority"]; moeApprovalStatus: ReleaseManifest["provenance"]["moeApprovalStatus"] }>;
};
const manifests: ReleaseManifest[] = scope.registeredReleases.map((entry) => ({
  manifestVersion: "1.0.0",
  releaseId: entry.releaseId,
  grade: entry.grade,
  subject: entry.subject,
  provenance: { sourceRef: entry.sourceRef, authority: entry.authority, moeApprovalStatus: entry.moeApprovalStatus },
  release: entry.releaseId === GRADE4_MATH_ONTOLOGY_RELEASE.id ? GRADE4_MATH_ONTOLOGY_RELEASE : undefined,
}));
const reports = manifests.map(validateReleaseManifest);
const represented = new Set(manifests.map((manifest) => `${manifest.grade}:${manifest.subject}`));
const scopeGaps = scope.scope.grades.flatMap((grade) => scope.scope.subjects.flatMap((subject) =>
  represented.has(`${grade}:${subject}`) ? [] : [{ grade, subject, gaps: ["RELEASE", "LESSON", "ASSESSMENT", "EVIDENCE_POLICY", "TOOL_POLICY"] }]));
const output = { ok: reports.every((report) => report.ok), scope: { grades: scope.scope.grades, subjects: scope.scope.subjects, combinations: scope.scope.grades.length * scope.scope.subjects.length }, releases: reports, scopeGaps };
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
if (!output.ok) process.exitCode = 1;
