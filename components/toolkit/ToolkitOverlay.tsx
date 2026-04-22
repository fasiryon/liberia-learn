"use client";

import { useEffect, useMemo, useState } from "react";
import type { ToolContext } from "@/lib/toolkit/toolRegistry";
import { useToolkit } from "@/components/toolkit/ToolkitContext";
import { TOOL_COMPONENTS } from "@/components/toolkit/toolComponents";
import DraggablePanel from "@/components/toolkit/DraggablePanel";
import { emitToolClosed, emitToolOpened, emitToolkitRendered } from "@/lib/toolkit/toolkitTelemetry";

interface ToolkitOverlayProps {
  context: ToolContext;
  enabledCategories?: string[];
}

export default function ToolkitOverlay({ context }: ToolkitOverlayProps) {
  const toolkit = useToolkit();
  const [collapsed, setCollapsed] = useState(false);
  const [openedAt, setOpenedAt] = useState<Record<string, number>>({});

  const tools = toolkit?.availableTools ?? [];
  const activeTools = toolkit?.activeTools;

  useEffect(() => {
    emitToolkitRendered(tools.length, context);
  }, [context, tools.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.innerWidth < 640);
  }, []);

  const activeToolSet = useMemo(() => new Set(activeTools ?? []), [activeTools]);

  if (!toolkit || tools.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[900]">
      <div className="pointer-events-auto rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/95 p-2 shadow-none">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--ll-text)]">Tools</span>
          <button
            type="button"
            aria-label="Toggle toolkit toolbar"
            className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className={`flex gap-2 ${collapsed ? "flex-col" : "flex-row flex-wrap"}`}>
          {(collapsed ? tools.slice(0, 1) : tools).map((tool) => (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.a11yLabel}
              className={`rounded border px-3 py-2 text-sm ${
                activeToolSet.has(tool.id)
                  ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)]"
                  : "border-[var(--ll-border)] bg-[var(--ll-bg)]"
              }`}
              onClick={() => {
                if (activeToolSet.has(tool.id)) {
                  const started = openedAt[tool.id] ?? Date.now();
                  emitToolClosed(tool.id, Date.now() - started);
                  toolkit.closeTool(tool.id);
                } else {
                  setOpenedAt((prev) => ({ ...prev, [tool.id]: Date.now() }));
                  emitToolOpened(tool.id, context);
                  toolkit.openTool(tool.id);
                }
              }}
            >
              <span aria-hidden="true" className="mr-1">{tool.icon}</span>
              {collapsed ? "Open" : tool.name}
            </button>
          ))}
        </div>
      </div>

      {(activeTools ?? []).map((toolId, index) => {
        const definition = tools.find((tool) => tool.id === toolId);
        if (!definition) return null;
        const ToolComponent = TOOL_COMPONENTS[toolId];
        if (!ToolComponent) return null;

        return (
          <DraggablePanel
            key={toolId}
            title={definition.name}
            a11yLabel={definition.a11yLabel}
            initialPosition={{ x: 24 + index * 24, y: 32 + index * 24 }}
            onClose={() => {
              const started = openedAt[toolId] ?? Date.now();
              emitToolClosed(toolId, Date.now() - started);
              toolkit.closeTool(toolId);
            }}
          >
            <ToolComponent
              onClose={() => {
                const started = openedAt[toolId] ?? Date.now();
                emitToolClosed(toolId, Date.now() - started);
                toolkit.closeTool(toolId);
              }}
              assessmentMode={context.lessonType === "assessment"}
            />
          </DraggablePanel>
        );
      })}
    </div>
  );
}
