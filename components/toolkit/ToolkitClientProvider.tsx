"use client";

import { useMemo, useState } from "react";
import type { ToolContext, ToolDefinition } from "@/lib/toolkit/toolRegistry";
import { ToolkitContext } from "@/components/toolkit/ToolkitContext";
import ToolkitOverlay from "@/components/toolkit/ToolkitOverlay";

interface ToolkitClientProviderProps {
  context: ToolContext;
  children: React.ReactNode;
  availableTools: ToolDefinition[];
  enabledCategories?: string[];
}

export default function ToolkitClientProvider({
  context,
  children,
  availableTools,
  enabledCategories,
}: ToolkitClientProviderProps) {
  const [activeTools, setActiveTools] = useState<string[]>(
    availableTools.filter((tool) => tool.defaultOpen).map((tool) => tool.id)
  );

  const value = useMemo(
    () => ({
      context,
      availableTools,
      activeTools,
      openTool: (toolId: string) => {
        setActiveTools((prev) => (prev.includes(toolId) ? prev : [...prev, toolId]));
      },
      closeTool: (toolId: string) => {
        setActiveTools((prev) => prev.filter((id) => id !== toolId));
      },
    }),
    [activeTools, availableTools, context]
  );

  return (
    <ToolkitContext.Provider value={value}>
      {children}
      <ToolkitOverlay context={context} enabledCategories={enabledCategories} />
    </ToolkitContext.Provider>
  );
}
