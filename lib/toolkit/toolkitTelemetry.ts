import type { ToolContext } from "@/lib/toolkit/toolRegistry";
import { emitTelemetry } from "@/lib/telemetry";

function sanitizeContext(context: ToolContext) {
  return {
    subject: context.subject,
    gradeBand: context.gradeBand,
    lessonType: context.lessonType,
    strandKey: context.strandKey ?? null,
  };
}

export function emitToolOpened(toolId: string, context: ToolContext): void {
  void emitTelemetry("toolkit.tool_opened", {
    toolId,
    ...sanitizeContext(context),
  });
}

export function emitToolClosed(toolId: string, durationMs: number): void {
  void emitTelemetry("toolkit.tool_closed", {
    toolId,
    durationMs,
  });
}

export function emitToolkitRendered(toolCount: number, context: ToolContext): void {
  void emitTelemetry("toolkit.rendered", {
    toolCount,
    ...sanitizeContext(context),
  });
}
