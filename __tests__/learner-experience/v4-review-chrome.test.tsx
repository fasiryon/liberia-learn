// Interactive Learning V4 review route chrome (R7): factory-generated DRAFTs and hand-authored reference fixtures are
// labelled apart, versions are chosen explicitly, unverified entries are never linkable, and provenance stays in the
// reviewer bar. The catalogue itself (integrity, no fallback) is the T2 loader's and is tested there.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { compareVersions, factoryVersions, selectionHref, V4ReviewBar, V4ReviewGallery, V4SelectionRejected, type V4ReviewEntryView } from "@/components/experience/review/V4Review";

const base = "/lab-review/v4-lessons";
const entry = (over: Partial<V4ReviewEntryView> & Pick<V4ReviewEntryView, "selection" | "origin" | "lessonKey" | "candidateVersion">): V4ReviewEntryView => ({
  title: `Lesson ${over.lessonKey}`, grade: 7, subject: "MATH", state: "DRAFT", reviewStatus: "REVISION_REQUIRED", integrity: "VERIFIED",
  provenance: { sourceLineage: { kind: "SOURCE_ROW_ONLY", label: "row @ rev" }, candidateSha256: "c".repeat(64), learnerProjectionSha256: "p".repeat(64), packageHash: "a".repeat(64) },
  blockers: ["MOE_OBJECTIVE_UNBOUND"], ...over,
});
const geo4 = entry({ selection: "factory@4.0.0-draft.4@g7-math-area-perimeter", origin: "FACTORY_GENERATED", lessonKey: "g7-math-area-perimeter", candidateVersion: "4.0.0-draft.4" });
const geo5 = entry({ selection: "factory@4.0.0-draft.5@g7-math-area-perimeter", origin: "FACTORY_GENERATED", lessonKey: "g7-math-area-perimeter", candidateVersion: "4.0.0-draft.5" });
const frac4 = entry({ selection: "factory@4.0.0-draft.4@g7-math-fractions", origin: "FACTORY_GENERATED", lessonKey: "g7-math-fractions", candidateVersion: "4.0.0-draft.4" });
const geoRef = entry({ selection: "g7-math-area-perimeter", origin: "HAND_AUTHORED_FIXTURE", lessonKey: "g7-math-area-perimeter", candidateVersion: "4.0.0-draft.1", reviewStatus: "REVIEW_BLOCKED" });

describe("V4 review gallery", () => {
  const html = renderToStaticMarkup(<V4ReviewGallery entries={[frac4, geoRef, geo4, geo5]} rejected={[{ selection: "factory@4.0.0-draft.5@g7-math-fractions", origin: "FACTORY_GENERATED", reason: "PACKAGE_HASH_MISMATCH" }]} basePath={base} />);

  it("labels the two origins apart and lists factory lessons first, geometry featured", () => {
    expect(html).toContain("Factory-generated DRAFT");
    expect(html).toContain("Hand-authored reference fixture");
    expect(html.indexOf('data-v4-origin="FACTORY_GENERATED"')).toBeLessThan(html.indexOf('data-v4-origin="HAND_AUTHORED_FIXTURE"'));
    expect(html.indexOf('data-v4-lesson="g7-math-area-perimeter"')).toBeLessThan(html.indexOf('data-v4-lesson="g7-math-fractions"'));
    expect(html).toMatch(/data-v4-lesson="g7-math-area-perimeter" data-featured="true"/);
  });

  it("offers each factory version as an explicit link, newest first, with literal @ keys", () => {
    expect(html).toContain(`href="${base}/factory@4.0.0-draft.5@g7-math-area-perimeter"`);
    expect(html).toContain(`href="${base}/factory@4.0.0-draft.4@g7-math-area-perimeter"`);
    expect(html.indexOf("4.0.0-draft.5 · latest verified")).toBeGreaterThan(-1);
    expect(html).toContain(`href="${base}/g7-math-area-perimeter"`);
  });

  it("shows rejected packages without a link and never lists unverified entries", () => {
    expect(html).toContain("PACKAGE_HASH_MISMATCH");
    expect(html).not.toContain(`href="${base}/factory@4.0.0-draft.5@g7-math-fractions"`);
    const tampered = renderToStaticMarkup(<V4ReviewGallery entries={[{ ...geo5, integrity: "FAILED" }, { ...geo4, state: "APPROVED" }]} rejected={[]} basePath={base} />);
    expect(tampered).not.toContain("factory@");
    expect(tampered).toContain("No verified factory package is available.");
  });
});

describe("V4 review bar and rejection", () => {
  it("names origin, manifest version and status, links the other version and the fixture, and keeps hashes in reviewer chrome", () => {
    const html = renderToStaticMarkup(<V4ReviewBar entry={geo4} versions={factoryVersions([geo4, geo5]).get("g7-math-area-perimeter")!} reference={geoRef} basePath={base} />);
    expect(html).toContain('data-v4-version="4.0.0-draft.4"');
    expect(html).toContain("Factory-generated DRAFT");
    expect(html).toContain("DRAFT · REVISION_REQUIRED");
    expect(html).toContain('aria-current="page">4.0.0-draft.4');
    expect(html).toContain(`href="${base}/factory@4.0.0-draft.5@g7-math-area-perimeter"`);
    expect(html).toContain("Compare: hand-authored fixture");
    expect(html).toContain(`data-v4-projection="${"p".repeat(64)}"`);
  });

  it("a rejected selection plays nothing and offers no substitute version", () => {
    const html = renderToStaticMarkup(<V4SelectionRejected selection="factory@4.0.0-draft.4@g7-math-area-perimeter" reason="CANDIDATE_HASH_MISMATCH" basePath={base} />);
    expect(html).toContain("Selection rejected");
    expect(html).toContain('data-v4-rejection="CANDIDATE_HASH_MISMATCH"');
    expect(html.match(/href="/g)).toHaveLength(1);
  });

  it("orders versions and builds hrefs deterministically", () => {
    expect(["4.0.0-draft.4", "4.0.0", "4.0.0-draft.10", "x"].sort(compareVersions)).toEqual(["4.0.0", "4.0.0-draft.10", "4.0.0-draft.4", "x"]);
    expect(selectionHref(base, "factory@4.0.0-draft.4@g7-math-area-perimeter")).toBe(`${base}/factory@4.0.0-draft.4@g7-math-area-perimeter`);
    expect(selectionHref(base, "../x")).toBe(`${base}/..%2Fx`);
  });
});
