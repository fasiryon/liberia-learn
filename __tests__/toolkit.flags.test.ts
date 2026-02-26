import { afterEach, describe, expect, it } from "vitest";
import { getToolsForContext, type ToolContext } from "@/lib/toolkit/toolRegistry";

const context: ToolContext = { subject: "math", gradeBand: "7-9", lessonType: "assessment" };
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

afterEach(() => {
  delete process.env.ENABLE_CLASSROOM_TOOLKIT;
  delete process.env.ENABLE_TOOLKIT_CALCULATOR;
  delete process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS;
  delete process.env.ENABLE_TOOLKIT_GEO_TOOLS;
  delete process.env.ENABLE_TOOLKIT_TIMER;
});

describe("toolkit flags", () => {
  it("ENABLE_CLASSROOM_TOOLKIT=false returns []", () => {
    process.env.ENABLE_CLASSROOM_TOOLKIT = "false";
    process.env.ENABLE_TOOLKIT_CALCULATOR = "true";
    process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_GEO_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_TIMER = "true";
    expect(getToolsForContext(context, enabledCategories)).toEqual([]);
  });

  it("ENABLE_TOOLKIT_CALCULATOR=false removes calculators", () => {
    process.env.ENABLE_CLASSROOM_TOOLKIT = "true";
    process.env.ENABLE_TOOLKIT_CALCULATOR = "false";
    process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_GEO_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_TIMER = "true";

    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).not.toContain("scientific-calculator");
    expect(ids).not.toContain("basic-calculator");
  });

  it("ENABLE_TOOLKIT_SCIENCE_TOOLS=false removes periodic-table", () => {
    process.env.ENABLE_CLASSROOM_TOOLKIT = "true";
    process.env.ENABLE_TOOLKIT_CALCULATOR = "true";
    process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS = "false";
    process.env.ENABLE_TOOLKIT_GEO_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_TIMER = "true";

    const scienceContext: ToolContext = { subject: "science", gradeBand: "7-9", lessonType: "lesson" };
    const ids = getToolsForContext(scienceContext, enabledCategories).map((tool) => tool.id);
    expect(ids).not.toContain("periodic-table");
  });

  it("all true returns full set for context", () => {
    process.env.ENABLE_CLASSROOM_TOOLKIT = "true";
    process.env.ENABLE_TOOLKIT_CALCULATOR = "true";
    process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_GEO_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_TIMER = "true";

    const ids = getToolsForContext(context, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("scientific-calculator");
    expect(ids).toContain("timer");
  });

  it("partial flags return only enabled categories", () => {
    process.env.ENABLE_CLASSROOM_TOOLKIT = "true";
    process.env.ENABLE_TOOLKIT_CALCULATOR = "false";
    process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS = "false";
    process.env.ENABLE_TOOLKIT_GEO_TOOLS = "true";
    process.env.ENABLE_TOOLKIT_TIMER = "false";

    const geometryContext: ToolContext = {
      subject: "math",
      gradeBand: "7-9",
      lessonType: "lesson",
      strandKey: "geometry",
    };
    const ids = getToolsForContext(geometryContext, enabledCategories).map((tool) => tool.id);
    expect(ids).toContain("protractor");
    expect(ids).not.toContain("scientific-calculator");
    expect(ids).not.toContain("timer");
  });
});
