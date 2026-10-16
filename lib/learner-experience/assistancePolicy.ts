import type { Scene } from "./types";

/** Shared presentation policy; the tutor server reapplies it to its authorized lesson.
 * Free responses are protected conservatively until an approved assistance contract
 * can distinguish scaffolded practice from independent work. This grants no scoring.
 */
export function sceneAllowsTutor(scene: Scene): boolean {
  return scene.type !== "MASTERY_CHECK"
    && scene.type !== "CHECK_UNDERSTANDING"
    && scene.interaction.kind !== "ASSESSMENT_HANDOFF"
    && scene.interaction.kind !== "FREE_RESPONSE"
    && !scene.tools.prohibited.some(id => /tutor|assistant/i.test(id));
}
