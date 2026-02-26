import {
  isClassroomToolkitEnabled,
  isToolkitCalculatorEnabled,
  isToolkitGeoToolsEnabled,
  isToolkitScienceToolsEnabled,
  isToolkitTimerEnabled,
} from "@/lib/serverFlags";
import { getToolsForContext, type ToolContext } from "@/lib/toolkit/toolRegistry";
import ToolkitClientProvider from "@/components/toolkit/ToolkitClientProvider";

interface ToolkitProviderProps {
  context: ToolContext;
  children: React.ReactNode;
}

function getEnabledToolkitCategories(): string[] {
  const categories = ["math", "science", "language", "utility", "core"];
  if (isToolkitCalculatorEnabled()) categories.push("calculator");
  if (isToolkitScienceToolsEnabled()) categories.push("science-tools");
  if (isToolkitGeoToolsEnabled()) categories.push("geo-tools");
  if (isToolkitTimerEnabled()) categories.push("timer");
  return categories;
}

export default function ToolkitProvider({ context, children }: ToolkitProviderProps) {
  if (!isClassroomToolkitEnabled()) {
    return <>{children}</>;
  }

  const enabledCategories = getEnabledToolkitCategories();
  const availableTools = getToolsForContext(context, enabledCategories);

  return (
    <ToolkitClientProvider
      context={context}
      enabledCategories={enabledCategories}
      availableTools={availableTools}
    >
      {children}
    </ToolkitClientProvider>
  );
}
