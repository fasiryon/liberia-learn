/**
 * Scene tool permissions over the existing classroom toolkit. A scene's
 * `tools.allowed` is the authored permission; the toolkit's server flags still
 * decide whether a tool is switched on at all. No tool is rebuilt here.
 */
import { getToolsForContext, TOOL_REGISTRY_DEFINITIONS, type ToolContext } from "@/lib/toolkit/toolRegistry";
import type { Scene } from "./types";

/** Tool ids the server has switched on, using the toolkit's own flag logic. */
export function enabledToolIds(enabledCategories: string[]): string[] {
  return TOOL_REGISTRY_DEFINITIONS.filter((tool) => {
    const context = tool.contexts[0] as ToolContext | undefined;
    return !!context && getToolsForContext(context, enabledCategories).some((candidate) => candidate.id === tool.id);
  }).map((tool) => tool.id);
}

export type SceneToolView = Readonly<{ id: string; name: string; a11yLabel: string; enabled: boolean }>;

/** What the context panel shows for a scene: permitted tools, and whether each is switched on. */
export function sceneTools(scene: Pick<Scene, "tools">, enabled: readonly string[]): SceneToolView[] {
  return scene.tools.allowed
    .filter((id) => !scene.tools.prohibited.includes(id))
    .map((id) => TOOL_REGISTRY_DEFINITIONS.find((tool) => tool.id === id))
    .filter((tool): tool is NonNullable<typeof tool> => !!tool)
    .map((tool) => ({ id: tool.id, name: tool.name, a11yLabel: tool.a11yLabel, enabled: enabled.includes(tool.id) }));
}
