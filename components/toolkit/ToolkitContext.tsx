"use client";

import { createContext, useContext } from "react";
import type { ToolContext, ToolDefinition } from "@/lib/toolkit/toolRegistry";

export type ToolkitRuntimeContext = {
  context: ToolContext;
  availableTools: ToolDefinition[];
  activeTools: string[];
  openTool: (toolId: string) => void;
  closeTool: (toolId: string) => void;
};

export const ToolkitContext = createContext<ToolkitRuntimeContext | null>(null);

export function useToolkit(): ToolkitRuntimeContext | null {
  return useContext(ToolkitContext);
}
