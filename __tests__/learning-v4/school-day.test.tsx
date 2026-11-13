// school-day/1.0.0: the day shell reads the Chief of Staff resolved days only (founder decision 6), shows each slot's
// period-matrix stage, links a period only to its exact pinned package, and never claims a completion or a record.
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SchoolDayJourney } from "@/components/experience/day/SchoolDayJourney";
import { bandForGrade, blockAt, dayCoverage, GRADES, schoolDayFromResolved } from "@/lib/learner-experience/day/schoolDay";
import { resolveLessonLinks, schoolDayForGrade } from "@/lib/learner-experience/day/loadSchoolDay";

const resolved = (grade: number) => JSON.parse(fs.readFileSync(`curriculum/program/stem-v1/resolved-days/g${grade}-day1.json`, "utf8"));
const matrix = JSON.parse(fs.readFileSync("curriculum/program/stem-v1/period-matrix.json", "utf8")).rows;
const draft6 = (key: string) => JSON.parse(fs.readFileSync(`curriculum/factory-v4/drafts/4.0.0-draft.6/${key}/manifest.json`, "utf8")).packageHash;
const attendance = { status: "NOT_RECORDED" as const, note: "Teacher takes attendance." };

describe("resolved days are the only planning source", () => {
  it("the day shell has no second day generator and reads resolved-days", () => {
    const sources = ["lib/learner-experience/day/schoolDay.ts", "lib/learner-experience/day/loadSchoolDay.ts"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(sources).not.toContain("bandTemplateDay");
    expect(sources).not.toContain("day-plans");
    expect(sources).not.toContain("course-catalog");
    expect(sources).toContain("resolved-days");
  });

  it("loads every grade K-12 from its own resolved day, Kindergarten as grade 0", () => {
    for (const grade of GRADES) {
      const day = schoolDayForGrade(grade);
      expect(day.grade).toBe(grade);
      expect(day.band).toBe(bandForGrade(grade));
      expect(day.blocks.map((b) => b.slot)).toEqual(resolved(grade).blocks.map((b: any) => b.slot));
      expect(day.blocks.at(-1)!.end).toBe("15:00");
      for (const b of day.blocks) if (b.binding.kind === "GAP") expect(b.binding.label).toBe(resolved(grade).blocks.find((x: any) => x.slot === b.slot).binding.studentLabel);
    }
    expect(schoolDayForGrade(0).gradeLabel).toBe("K");
  });

  it("binds G7 to its four sealed draft.6 lessons and two school-day drafts by exact hash, with replacement orders", () => {
    const day = schoolDayForGrade(7), periods = day.blocks.filter((b) => b.kind === "PERIOD");
    for (const b of periods.slice(0, 4)) {
      expect(b.binding.kind).toBe("LESSON");
      if (b.binding.kind === "LESSON") { expect(b.binding.packageHash).toBe(draft6(b.binding.key)); expect(b.binding.replacementOrder?.orderId).toMatch(/^GO-G07-P\d-/); }
    }
    const civics = periods[3].binding;
    expect(civics.kind === "LESSON" && civics.packageHash).toBe("2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb");
    expect(civics.kind === "LESSON" && civics.requiresAttachment).toContain("geographic map");
    expect(day.blocks.find((b) => b.slot === "SUPPORT")?.binding.kind).toBe("GAP");
    expect(day.blocks.find((b) => b.slot === "END_OF_DAY")?.binding).toMatchObject({ kind: "GAP", order: { orderId: "GO-G07-EOD" } });
    expect(dayCoverage(day)).toEqual({ periods: 8, lessons: 6, gaps: 2, teacherLed: 0 });
  });

  it("attaches the period-matrix stage to each teaching slot", () => {
    const day = schoolDayForGrade(7);
    expect(day.blocks.find((b) => b.slot === "P4")?.stage).toMatchObject({ stage: "FACTORY_VALIDATED", g3: "G3_REVISE", humanSubjectExpert: "NOT_PERFORMED" });
    expect(schoolDayForGrade(0).blocks.find((b) => b.slot === "P1")?.stage?.stage).toBe("PLANNED");
    expect(day.blocks.find((b) => b.slot === "ARRIVAL")?.stage).toBeNull();
  });

  it("finds the current and next block on the school clock", () => {
    const day = schoolDayForGrade(7);
    expect(blockAt(day, "07:10").phase).toBe("BEFORE_SCHOOL");
    expect(blockAt(day, "11:15")).toMatchObject({ current: { slot: "P4" }, next: { slot: "LUNCH" } });
    expect(blockAt(day, "14:45")).toMatchObject({ current: { slot: "END_OF_DAY" } });
    expect(blockAt(day, "15:30").phase).toBe("AFTER_SCHOOL");
  });

  it("rejects malformed or authority-claiming days instead of guessing", () => {
    const approved = resolved(7); approved.blocks[2].binding.officialStatus = "APPROVED";
    expect(() => schoolDayFromResolved(approved, matrix)).toThrow("day_binding_status");
    const overlap = resolved(7); overlap.blocks[3].start = "08:30";
    expect(() => schoolDayFromResolved(overlap, matrix)).toThrow("day_plan_times");
    const band = resolved(0); band.developmentalBand = "6-8";
    expect(() => schoolDayFromResolved(band, matrix)).toThrow("day_band_mismatch");
    const unbanded = resolved(7); delete unbanded.developmentalBand;
    expect(() => schoolDayFromResolved(unbanded, matrix)).toThrow("day_band_missing");
    const filler = resolved(3); filler.blocks.find((b: any) => b.binding.kind === "CONTENT_GAP").binding.body = "made-up lesson";
    expect(() => schoolDayFromResolved(filler, matrix)).toThrow("day_gap_invalid");
  });

  it("accepts a passing replacement bound as FACTORY_LESSON", () => {
    const day = resolved(3), slot = day.blocks.find((b: any) => b.slot === "P1");
    slot.binding = { kind: "FACTORY_LESSON", key: "g3-math-arrays", version: "4.0.0-k12.1-draft.1", selection: "factory@4.0.0-k12.1-draft.1@g3-math-arrays",
      packageHash: "a".repeat(64), candidateSha256: "b".repeat(64), orderId: "GO-G03-P1-MATH-U1", officialStatus: "NOT_APPROVED",
      studentLabel: "Pilot draft lesson (not yet approved) - ungraded", title: "Arrays", generationOrder: slot.binding.generationOrder };
    const p1 = schoolDayFromResolved(day, matrix).blocks.find((b) => b.slot === "P1")!;
    expect(p1.binding).toMatchObject({ kind: "LESSON", source: "FACTORY_LESSON", fillsOrder: "GO-G03-P1-MATH-U1" });
    expect(p1.unit?.title).toBe("Multiplication and division facts with arrays");
    expect(resolveLessonLinks({ ...schoolDayFromResolved(day, matrix) }, "/r", () => true)[p1.id]).toMatchObject({ href: null, unavailable: expect.stringContaining("not in this build") });
  });
});

describe("lesson links", () => {
  it("links only exact pinned packages the route can play, and says why otherwise", () => {
    const day = schoolDayForGrade(7);
    const links = resolveLessonLinks(day, "/lab-review/v4-lessons", (s) => s.endsWith("@g7-math-fractions"));
    const bySlot = (slot: string) => links[day.blocks.find((b) => b.slot === slot)!.id];
    expect(bySlot("P1").href).toBe("/lab-review/v4-lessons/factory@4.0.0-draft.6@g7-math-fractions");
    expect(bySlot("P2")).toMatchObject({ href: null, unavailable: expect.stringContaining("cannot open that version") });
    expect(bySlot("P5")).toMatchObject({ href: null, unavailable: expect.stringContaining("not in this build") });
    const tampered = resolved(7); tampered.blocks.find((b: any) => b.slot === "P1").binding.packageHash = "0".repeat(64);
    const t = schoolDayFromResolved(tampered, matrix);
    expect(resolveLessonLinks(t, "/x", () => true)[t.blocks.find((b) => b.slot === "P1")!.id]).toMatchObject({ href: null, unavailable: expect.stringContaining("does not match") });
  });
});

describe("age-band interfaces", () => {
  const render = (grade: number, at: string) => { const day = schoolDayForGrade(grade);
    return renderToStaticMarkup(<SchoolDayJourney day={day} lessons={resolveLessonLinks(day, "/r", () => true)} attendance={attendance} clockAt={at} />); };
  it("K-2 is a picture schedule with no timetable table and no stage jargon", () => {
    const html = render(0, "08:30");
    expect(html).toContain('data-day-band="K_2"');
    expect(html).toContain("My school day");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("data-day-stage");
  });
  it("9-12 gets the full timetable table", () => {
    expect(render(11, "10:30")).toContain("<table");
  });
  it("Grade 7 shows the current lesson by exact hash, its stage and replacement order, and claims no completion", () => {
    const html = render(7, "11:20");
    expect(html).toContain('data-day-now="P4"');
    expect(html).toContain('data-package-hash="2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb"');
    expect(html).toContain('data-day-stage="FACTORY_VALIDATED"');
    expect(html).toContain('data-day-replacement="GO-G07-P4-CIVICS-U1-R"');
    expect(html).toContain("not yet reviewed by a subject expert");
    expect(html).not.toMatch(/\b(completed|mastered|score)\b/i);
  });
});
