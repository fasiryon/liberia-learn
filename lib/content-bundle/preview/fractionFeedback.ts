/**
 * On-screen practice feedback for activity experiences. Pure and local: it reads only the task
 * (the prompt's stated fraction or the picture on screen) and the learner's current response, and
 * returns words. It stores nothing, sends nothing and is not evidence or mastery.
 */
import type { ExperienceTask, FractionVisual, SetObject } from "@/lib/content-bundle/v1/activityExperience";

export type FeedbackState = "MATCH" | "NOT_YET" | "INCOMPLETE";
export type Feedback = Readonly<{ state: FeedbackState; message: string }>;

export type TaskResponse =
  | Readonly<{ kind: "SELECTION"; selected: readonly number[] }>
  | Readonly<{ kind: "FRACTION"; numerator: number; denominator: number }>
  | Readonly<{ kind: "EQUAL_CHOICE"; equal: boolean | null }>;

const NOUNS: Readonly<Record<SetObject, [string, string]>> = { BOTTLE_CAP: ["bottle cap", "bottle caps"], MANGO: ["mango", "mangoes"], STONE: ["stone", "stones"] };
export const nounFor = (object: SetObject, count: number) => NOUNS[object][count === 1 ? 0 : 1];

/** Parts counted by a picture: the whole and the marked/shaded part. */
export function pictureCounts(visual: FractionVisual): Readonly<{ whole: number; part: number; noun: string }> {
  return visual.kind === "STRIP"
    ? { whole: visual.parts, part: visual.shaded.length, noun: "parts" }
    : { whole: visual.objects, part: visual.marked.length, noun: nounFor(visual.object, 2) };
}

const isEqualStrip = (visual: FractionVisual) => visual.kind === "STRIP" && (visual.widths === null || visual.widths.every((w) => w === visual.widths![0]));

export function evaluateTask(task: ExperienceTask, response: TaskResponse): Feedback | null {
  switch (task.kind) {
    case "SHADE_STRIP": {
      if (response.kind !== "SELECTION") return null;
      const n = response.selected.length;
      if (n === 0) return { state: "INCOMPLETE", message: "Tap the parts of the strip you want to shade, then check." };
      const { numerator, denominator } = task.ask;
      if (n === numerator) return { state: "MATCH", message: `Yes. You shaded ${n} of ${denominator} equal parts. That is ${numerator}/${denominator}.` };
      return { state: "NOT_YET", message: `Not yet. You shaded ${n} of ${denominator} parts, which is ${n}/${denominator}. The top number of ${numerator}/${denominator} tells how many parts to shade.` };
    }
    case "MARK_SET": {
      if (response.kind !== "SELECTION") return null;
      const n = response.selected.length;
      const noun = nounFor(task.object, 2);
      if (n === 0) return { state: "INCOMPLETE", message: `Tap the ${noun} you want to mark, then check.` };
      const { numerator, denominator } = task.ask;
      const perGroup = task.objects / denominator;
      const fits = n === numerator * perGroup;
      // When groups are drawn, the marked objects must also fill whole groups.
      const wholeGroups = task.groups === null || [...Array(denominator).keys()].every((g) => {
        const inGroup = response.selected.filter((i) => Math.floor(i / perGroup) === g).length;
        return inGroup === 0 || inGroup === perGroup;
      });
      if (fits && wholeGroups) return { state: "MATCH", message: `Yes. You marked ${n} of the ${task.objects} ${noun}: ${numerator} of ${denominator} equal groups. That is ${numerator}/${denominator} of the set.` };
      if (fits) return { state: "NOT_YET", message: `Not yet. You marked ${n} ${nounFor(task.object, n)}, but they are spread across groups. Mark whole groups: ${numerator}/${denominator} means ${numerator} of the ${denominator} equal groups.` };
      return { state: "NOT_YET", message: `Not yet. You marked ${n} of the ${task.objects} ${noun}. For ${numerator}/${denominator}, share the ${task.objects} ${noun} into ${denominator} equal groups, then mark ${numerator} ${numerator === 1 ? "group" : "groups"}.` };
    }
    case "NAME_FRACTION": {
      if (response.kind !== "FRACTION") return null;
      const { whole, part, noun } = pictureCounts(task.visual);
      const { numerator, denominator } = response;
      if (denominator === 0) return { state: "INCOMPLETE", message: "Set the bottom number first: how many make the whole?" };
      if (numerator === part && denominator === whole) return { state: "MATCH", message: `Yes. ${part} of the ${whole} ${noun} ${task.visual.kind === "STRIP" ? "are shaded" : "are marked"}, so the fraction is ${part}/${whole}.` };
      if (numerator === whole && denominator === part) return { state: "NOT_YET", message: "Not yet. Your numbers are swapped. The bottom number is the whole; the top number is the part you are describing." };
      if (denominator !== whole) return { state: "NOT_YET", message: `Not yet. Your bottom number is ${denominator}. The bottom number is the whole: count every one of the ${noun} in the picture.` };
      return { state: "NOT_YET", message: `Not yet. Your bottom number is right. For the top number, count only the ${task.visual.kind === "STRIP" ? "shaded parts" : `marked ${noun}`}.` };
    }
    case "EQUAL_PARTS": {
      if (response.kind !== "EQUAL_CHOICE") return null;
      if (response.equal === null) return { state: "INCOMPLETE", message: "Choose an answer, then check." };
      const equal = isEqualStrip(task.visual);
      const parts = task.visual.kind === "STRIP" ? task.visual.parts : 0;
      if (response.equal === equal) return { state: "MATCH", message: equal ? `Yes. The ${parts} parts are the same size, so each part is 1/${parts} of the whole.` : `Yes. The pieces are not the same size, so they are not equal parts. A piece is 1/${parts} only when all ${parts} parts are equal.` };
      return { state: "NOT_YET", message: "Not yet. Look at the size of each piece, not only how many pieces there are." };
    }
    case "ON_PAPER":
      return null;
  }
}
