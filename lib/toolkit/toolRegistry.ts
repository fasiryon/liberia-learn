import {
  isClassroomToolkitEnabled,
  isToolkitCalculatorEnabled,
  isToolkitGeoToolsEnabled,
  isToolkitScienceToolsEnabled,
  isToolkitTimerEnabled,
} from "@/lib/serverFlags";

export type GradeBand = "1-3" | "4-6" | "7-9" | "10-12";
export type LessonType = "assessment" | "practice" | "lesson" | "lab";
export type Subject = "math" | "science" | "english" | "engineering" | "cs";

export type ToolContext = {
  subject: Subject;
  gradeBand: GradeBand;
  lessonType: LessonType;
  strandKey?: string;
};

export type ToolDefinition = {
  id: string;
  name: string;
  icon: string;
  componentName: string;
  contexts: Array<Partial<ToolContext>>;
  defaultOpen: boolean;
  category: "math" | "science" | "language" | "utility";
  a11yLabel: string;
};

const GRADE_BANDS: GradeBand[] = ["1-3", "4-6", "7-9", "10-12"];
const SUBJECTS: Subject[] = ["math", "science", "english", "engineering", "cs"];
const LESSON_TYPES: LessonType[] = ["assessment", "practice", "lesson", "lab"];

function buildContexts(
  gradeBands: GradeBand[] | "all",
  subjects: Subject[] | "all",
  lessonTypes: LessonType[] | "all",
  strandKeys?: string[]
): Array<Partial<ToolContext>> {
  const gb = gradeBands === "all" ? GRADE_BANDS : gradeBands;
  const sb = subjects === "all" ? SUBJECTS : subjects;
  const lt = lessonTypes === "all" ? LESSON_TYPES : lessonTypes;

  const contexts: Array<Partial<ToolContext>> = [];
  for (const gradeBand of gb) {
    for (const subject of sb) {
      for (const lessonType of lt) {
        if (!strandKeys || strandKeys.length === 0) {
          contexts.push({ gradeBand, subject, lessonType });
        } else {
          for (const strandKey of strandKeys) {
            contexts.push({ gradeBand, subject, lessonType, strandKey });
          }
        }
      }
    }
  }
  return contexts;
}

const TOOL_REGISTRY: ToolDefinition[] = [
  {
    id: "basic-calculator",
    name: "Basic Calculator",
    icon: "??",
    componentName: "BasicCalculator",
    contexts: buildContexts(["1-3", "4-6"], ["math", "science"], ["assessment", "practice"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open basic calculator",
  },
  {
    id: "scientific-calculator",
    name: "Scientific Calculator",
    icon: "??",
    componentName: "ScientificCalculator",
    contexts: buildContexts(["7-9", "10-12"], ["math", "science", "engineering"], ["assessment", "practice"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open scientific calculator",
  },
  {
    id: "fraction-visualizer",
    name: "Fraction Visualizer",
    icon: "??",
    componentName: "FractionVisualizer",
    contexts: buildContexts(["1-3", "4-6"], ["math"], ["lesson", "practice"], ["fractions", "ratios"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open fraction visualizer",
  },
  {
    id: "number-line",
    name: "Number Line",
    icon: "??",
    componentName: "NumberLine",
    contexts: buildContexts(["1-3", "4-6"], ["math"], ["lesson", "practice", "assessment"], ["number-sense", "integers"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open number line",
  },
  {
    id: "digital-ruler",
    name: "Digital Ruler",
    icon: "??",
    componentName: "DigitalRuler",
    contexts: buildContexts(["4-6", "7-9", "10-12"], ["math", "science"], ["lesson", "practice", "assessment"], ["measurement", "geometry"]),
    defaultOpen: false,
    category: "utility",
    a11yLabel: "Open digital ruler",
  },
  {
    id: "protractor",
    name: "Protractor",
    icon: "??",
    componentName: "Protractor",
    contexts: buildContexts(["7-9", "10-12"], ["math"], ["lesson", "practice", "assessment"], ["geometry", "angles"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open protractor",
  },
  {
    id: "multiplication-table",
    name: "Multiplication Table",
    icon: "??",
    componentName: "MultiplicationTable",
    contexts: buildContexts(["1-3", "4-6"], ["math"], ["lesson", "practice"], ["multiplication"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open multiplication table",
  },
  {
    id: "periodic-table",
    name: "Periodic Table",
    icon: "??",
    componentName: "PeriodicTable",
    contexts: buildContexts(["7-9", "10-12"], ["science"], ["lesson", "practice", "assessment"]),
    defaultOpen: false,
    category: "science",
    a11yLabel: "Open periodic table",
  },
  {
    id: "unit-converter",
    name: "Unit Converter",
    icon: "??",
    componentName: "UnitConverter",
    contexts: buildContexts(["7-9", "10-12"], ["math", "science"], ["lesson", "practice", "assessment"], ["measurement", "units"]),
    defaultOpen: false,
    category: "utility",
    a11yLabel: "Open unit converter",
  },
  {
    id: "coordinate-grid",
    name: "Coordinate Grid",
    icon: "???",
    componentName: "CoordinateGrid",
    contexts: buildContexts(["7-9", "10-12"], ["math"], ["lesson", "practice", "assessment"], ["algebra", "coordinates"]),
    defaultOpen: false,
    category: "math",
    a11yLabel: "Open coordinate grid",
  },
  {
    id: "timer",
    name: "Timer",
    icon: "??",
    componentName: "Timer",
    contexts: buildContexts("all", "all", ["assessment"]),
    defaultOpen: true,
    category: "utility",
    a11yLabel: "Open timer",
  },
  {
    id: "dictionary",
    name: "Dictionary",
    icon: "??",
    componentName: "DictionaryTool",
    contexts: buildContexts("all", ["english"], ["lesson", "practice"]),
    defaultOpen: false,
    category: "language",
    a11yLabel: "Open dictionary",
  },
];

function matchesContext(context: ToolContext, candidate: Partial<ToolContext>): boolean {
  if (candidate.subject && candidate.subject !== context.subject) return false;
  if (candidate.gradeBand && candidate.gradeBand !== context.gradeBand) return false;
  if (candidate.lessonType && candidate.lessonType !== context.lessonType) return false;
  if (candidate.strandKey && candidate.strandKey !== context.strandKey) return false;
  return true;
}

function toolGroupForFlag(toolId: string): string {
  if (toolId === "basic-calculator" || toolId === "scientific-calculator") return "calculator";
  if (toolId === "periodic-table") return "science-tools";
  if (["digital-ruler", "protractor", "coordinate-grid", "number-line"].includes(toolId)) return "geo-tools";
  if (toolId === "timer") return "timer";
  return "core";
}

function isToolAllowedByServerFlags(toolId: string): boolean {
  const group = toolGroupForFlag(toolId);
  if (group === "calculator" && !isToolkitCalculatorEnabled()) return false;
  if (group === "science-tools" && !isToolkitScienceToolsEnabled()) return false;
  if (group === "geo-tools" && !isToolkitGeoToolsEnabled()) return false;
  if (group === "timer" && !isToolkitTimerEnabled()) return false;
  return true;
}

function isValidContext(context: ToolContext): boolean {
  return (
    GRADE_BANDS.includes(context.gradeBand) &&
    SUBJECTS.includes(context.subject) &&
    LESSON_TYPES.includes(context.lessonType)
  );
}

function isEnabledByCategory(tool: ToolDefinition, enabledCategories: string[]): boolean {
  if (enabledCategories.includes("all")) return true;
  const group = toolGroupForFlag(tool.id);
  if (enabledCategories.includes(tool.id)) return true;
  if (enabledCategories.includes(group)) return true;
  if (enabledCategories.includes(tool.category)) return true;
  if (group === "core") return enabledCategories.includes("core");
  return false;
}

export function getToolsForContext(
  context: ToolContext,
  enabledCategories: string[]
): ToolDefinition[] {
  if (!isClassroomToolkitEnabled()) return [];
  if (!enabledCategories.length) return [];
  if (!context || !isValidContext(context)) return [];

  return TOOL_REGISTRY.filter((tool) => {
    if (!isToolAllowedByServerFlags(tool.id)) return false;
    if (!isEnabledByCategory(tool, enabledCategories)) return false;
    return tool.contexts.some((candidate) => matchesContext(context, candidate));
  });
}

export const TOOL_REGISTRY_DEFINITIONS = TOOL_REGISTRY;
