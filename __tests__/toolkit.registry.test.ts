import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToolsForContext, type ToolContext } from "@/lib/toolkit/toolRegistry";

vi.mock("@/lib/serverFlags", () => ({
  isClassroomToolkitEnabled: () => process.env.ENABLE_CLASSROOM_TOOLKIT === "true",
  isToolkitCalculatorEnabled: () => process.env.ENABLE_TOOLKIT_CALCULATOR === "true",
  isToolkitScienceToolsEnabled: () => process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS === "true",
  isToolkitGeoToolsEnabled: () => process.env.ENABLE_TOOLKIT_GEO_TOOLS === "true",
  isToolkitTimerEnabled: () => process.env.ENABLE_TOOLKIT_TIMER === "true",
}));

function withAllToolkitFlagsEnabled() {
  process.env.ENABLE_CLASSROOM_TOOLKIT = "true";
  process.env.ENABLE_TOOLKIT_CALCULATOR = "true";
  process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS = "true";
  process.env.ENABLE_TOOLKIT_GEO_TOOLS = "true";
  process.env.ENABLE_TOOLKIT_TIMER = "true";
}

const enabledCategories = [
  "math",
  "science",
  "language",
  "utility",
  "core",
  "calculator",
  "science-tools",
  "geo-tools",
  "timer",
];

describe("toolkit registry", () => {
  beforeEach(() => {
    withAllToolkitFlagsEnabled();
  });

  afterEach(() => {
    delete process.env.ENABLE_CLASSROOM_TOOLKIT;
    delete process.env.ENABLE_TOOLKIT_CALCULATOR;
    delete process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS;
    delete process.env.ENABLE_TOOLKIT_GEO_TOOLS;
    delete process.env.ENABLE_TOOLKIT_TIMER;
  });

  it("math + grade 1-3 + assessment includes basic-calculator", () => {
    const context: ToolContext = { subject: "math", gradeBand: "1-3", lessonType: "assessment" };
    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("basic-calculator");
  });

  it("math + grade 7-9 + assessment includes scientific-calculator, not basic-calculator", () => {
    const context: ToolContext = { subject: "math", gradeBand: "7-9", lessonType: "assessment" };
    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("scientific-calculator");
    expect(ids).not.toContain("basic-calculator");
  });

  it("science + grade 7-9 + lesson includes periodic-table", () => {
    const context: ToolContext = { subject: "science", gradeBand: "7-9", lessonType: "lesson" };
    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("periodic-table");
  });

  it("math + grade 7-9 + lesson + geometry includes protractor and digital-ruler", () => {
    const context: ToolContext = { subject: "math", gradeBand: "7-9", lessonType: "lesson", strandKey: "geometry" };
    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("protractor");
    expect(ids).toContain("digital-ruler");
  });

  it("all subjects + grade 1-3 + assessment includes timer", () => {
    const context: ToolContext = { subject: "english", gradeBand: "1-3", lessonType: "assessment" };
    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("timer");
  });

  it("english + any grade + lesson includes dictionary", () => {
    const context: ToolContext = { subject: "english", gradeBand: "10-12", lessonType: "lesson" };
    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("dictionary");
  });

  it("unknown context returns empty array", () => {
    const badContext = { subject: "history", gradeBand: "0", lessonType: "none" } as any;
    expect(getToolsForContext(badContext, enabledCategories)).toEqual([]);
  });

  it("enabledCategories=[] returns empty array regardless of context", () => {
    const context: ToolContext = { subject: "math", gradeBand: "1-3", lessonType: "assessment" };
    expect(getToolsForContext(context, [])).toEqual([]);
  });
});
