import fs from "node:fs";
import path from "node:path";

type Issue = { path: string; message: string };

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function asArray(x: any): any[] {
  return Array.isArray(x) ? x : [];
}

function includesAny(haystack: string, needles: string[]) {
  const h = (haystack || "").toLowerCase();
  return needles.some(n => h.includes(String(n).toLowerCase()));
}

function main() {
  const agent1Path = process.argv[2];
  if (!agent1Path) {
    console.error("Usage: node scripts/validate-hard-gates.ts <Agent1.json>");
    process.exit(1);
  }

  const frameworkPath = path.resolve("docs/internal/requirements/lesson-quality-framework.json");
  const fw = readJson<any>(frameworkPath);
  const doc = readJson<any>(agent1Path);

  const issues: Issue[] = [];

  const contentType = doc?.content_type;
  if (contentType !== "LESSON") {
    // For now only enforce hard-gates for LESSON artifacts.
    console.log(JSON.stringify({ ok: true, enforced: false, reason: "content_type != LESSON" }, null, 2));
    process.exit(0);
  }

  const units = asArray(doc?.units);
  if (units.length < fw.hard_gates.lesson.units_min) {
    issues.push({ path: "/units", message: `Expected >= ${fw.hard_gates.lesson.units_min} unit(s), got ${units.length}` });
  }

  // Flatten lessons
  const lessons = units.flatMap((u: any, ui: number) => {
    const ls = asArray(u?.lessons);
    if (ls.length < fw.hard_gates.lesson.lessons_per_unit_min) {
      issues.push({ path: `/units/${ui}/lessons`, message: `Expected >= ${fw.hard_gates.lesson.lessons_per_unit_min} lesson(s) in unit, got ${ls.length}` });
    }
    return ls.map((l: any, li: number) => ({ l, ui, li }));
  });

  for (const { l, ui, li } of lessons) {
    const objectives = asArray(l?.learning_objectives);
    if (objectives.length < fw.hard_gates.lesson.objectives_per_lesson_min) {
      issues.push({
        path: `/units/${ui}/lessons/${li}/learning_objectives`,
        message: `Expected >= ${fw.hard_gates.lesson.objectives_per_lesson_min} objective(s), got ${objectives.length}`
      });
    }

    const activities = asArray(l?.activities);
    if (activities.length < fw.hard_gates.lesson.activities_per_lesson_min) {
      issues.push({
        path: `/units/${ui}/lessons/${li}/activities`,
        message: `Expected >= ${fw.hard_gates.lesson.activities_per_lesson_min} activity(ies), got ${activities.length}`
      });
    }

    const hasPractice = activities.some((a: any) => a?.type === "PRACTICE");
    if (!hasPractice) {
      issues.push({
        path: `/units/${ui}/lessons/${li}/activities`,
        message: `Must include a PRACTICE activity`
      });
    }

    // Activity completeness
    for (let ai = 0; ai < activities.length; ai++) {
      const a = activities[ai];
      for (const f of fw.hard_gates.activity_completeness.required_fields as string[]) {
        if (a?.[f] === undefined || a?.[f] === null || a?.[f] === "") {
          issues.push({ path: `/units/${ui}/lessons/${li}/activities/${ai}/${f}`, message: `Missing required field: ${f}` });
        }
      }
      const dur = a?.duration_minutes;
      const [minDur, maxDur] = fw.hard_gates.activity_completeness.duration_minutes_range as [number, number];
      if (typeof dur !== "number" || dur < minDur || dur > maxDur) {
        issues.push({ path: `/units/${ui}/lessons/${li}/activities/${ai}/duration_minutes`, message: `duration_minutes must be between ${minDur} and ${maxDur}` });
      }
      const instr = a?.instructions ?? {};
      for (const k of fw.hard_gates.activity_completeness.instructions_required_fields as string[]) {
        if (typeof instr?.[k] !== "string" || !instr[k].trim()) {
          issues.push({ path: `/units/${ui}/lessons/${li}/activities/${ai}/instructions/${k}`, message: `Missing instructions.${k}` });
        }
      }
    }

    // Assessments
    const assessments = asArray(l?.assessments);
    if (assessments.length < fw.hard_gates.lesson.assessments_per_lesson_min) {
      issues.push({
        path: `/units/${ui}/lessons/${li}/assessments`,
        message: `Expected >= ${fw.hard_gates.lesson.assessments_per_lesson_min} assessment(s), got ${assessments.length}`
      });
    }

    for (let si = 0; si < assessments.length; si++) {
      const s = assessments[si];
      const qs = asArray(s?.questions);
      if (qs.length < fw.hard_gates.lesson.questions_per_assessment_min) {
        issues.push({ path: `/units/${ui}/lessons/${li}/assessments/${si}/questions`, message: `Expected >= ${fw.hard_gates.lesson.questions_per_assessment_min} question(s), got ${qs.length}` });
      }

      for (let qi = 0; qi < qs.length; qi++) {
        const q = qs[qi];

        for (const f of fw.hard_gates.assessment_completeness.per_question_required_fields as string[]) {
          if (q?.[f] === undefined || q?.[f] === null || q?.[f] === "") {
            issues.push({ path: `/units/${ui}/lessons/${li}/assessments/${si}/questions/${qi}/${f}`, message: `Missing required field: ${f}` });
          }
        }

        const hints = asArray(q?.hints);
        if (hints.length < fw.hard_gates.assessment_completeness.min_hints) {
          issues.push({ path: `/units/${ui}/lessons/${li}/assessments/${si}/questions/${qi}/hints`, message: `Expected >= 2 hints, got ${hints.length}` });
        }

        if (q?.type === "MCQ") {
          const opts = asArray(q?.options);
          if (opts.length < fw.hard_gates.assessment_completeness.mcq_min_options) {
            issues.push({ path: `/units/${ui}/lessons/${li}/assessments/${si}/questions/${qi}/options`, message: `MCQ must have >= 4 options, got ${opts.length}` });
          }
        }

        const rubricTypes = new Set(fw.hard_gates.assessment_completeness.rubric_required_for_types as string[]);
        if (rubricTypes.has(String(q?.type)) && !q?.rubric) {
          issues.push({ path: `/units/${ui}/lessons/${li}/assessments/${si}/questions/${qi}/rubric`, message: `Rubric required for question type ${q?.type}` });
        }
      }
    }

    // Localization
    const cc = l?.cultural_context ?? doc?.cultural_context ?? {};
    const examples = asArray(cc?.local_examples);
    if (examples.length < fw.hard_gates.localization.min_local_examples) {
      issues.push({ path: `/units/${ui}/lessons/${li}/cultural_context/local_examples`, message: `Expected >= 3 local examples, got ${examples.length}` });
    }

    const exText = examples.join(" | ");
    const moneyNeedles = fw.hard_gates.localization.must_include[0].example_contains as string[];
    if (!includesAny(exText, moneyNeedles)) {
      issues.push({ path: `/units/${ui}/lessons/${li}/cultural_context/local_examples`, message: `Must include a money example referencing LD or Liberian Dollar` });
    }

    const communityNeedles = fw.hard_gates.localization.must_include[1].example_contains_any as string[];
    if (!includesAny(exText, communityNeedles)) {
      issues.push({ path: `/units/${ui}/lessons/${li}/cultural_context/local_examples`, message: `Must include a geography/community example (county/community/district/Monrovia etc.)` });
    }
  }

  if (issues.length) {
    console.error(JSON.stringify({ ok: false, issues }, null, 2));
    process.exit(2);
  }

  console.log(JSON.stringify({ ok: true, enforced: true }, null, 2));
}

main();

