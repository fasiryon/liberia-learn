import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ToolContext } from "@/lib/toolkit/toolRegistry";
import { ToolkitContext } from "@/components/toolkit/ToolkitContext";
import ToolkitOverlay from "@/components/toolkit/ToolkitOverlay";
import BasicCalculator from "@/components/toolkit/tools/BasicCalculator";
import ScientificCalculator from "@/components/toolkit/tools/ScientificCalculator";
import FractionVisualizer from "@/components/toolkit/tools/FractionVisualizer";
import NumberLine from "@/components/toolkit/tools/NumberLine";
import DigitalRuler from "@/components/toolkit/tools/DigitalRuler";
import Protractor from "@/components/toolkit/tools/Protractor";
import MultiplicationTable from "@/components/toolkit/tools/MultiplicationTable";
import PeriodicTable from "@/components/toolkit/tools/PeriodicTable";
import UnitConverter from "@/components/toolkit/tools/UnitConverter";
import CoordinateGrid from "@/components/toolkit/tools/CoordinateGrid";
import Timer from "@/components/toolkit/tools/Timer";
import DictionaryTool from "@/components/toolkit/tools/DictionaryTool";

const context: ToolContext = {
  subject: "math",
  gradeBand: "7-9",
  lessonType: "assessment",
};

describe("toolkit tools + overlay render", () => {
  it("renders all tool components without crashing", () => {
    const components = [
      BasicCalculator,
      ScientificCalculator,
      FractionVisualizer,
      NumberLine,
      DigitalRuler,
      Protractor,
      MultiplicationTable,
      PeriodicTable,
      UnitConverter,
      CoordinateGrid,
      Timer,
      DictionaryTool,
    ];

    for (const Component of components) {
      const html = renderToStaticMarkup(<Component onClose={() => undefined} />);
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain("Close");
    }
  });

  it("renders toolkit overlay with toolbar", () => {
    const html = renderToStaticMarkup(
      <ToolkitContext.Provider
        value={{
          context,
          availableTools: [
            {
              id: "basic-calculator",
              name: "Basic Calculator",
              icon: "??",
              componentName: "BasicCalculator",
              contexts: [context],
              defaultOpen: false,
              category: "math",
              a11yLabel: "Open basic calculator",
            },
          ],
          activeTools: [],
          openTool: () => undefined,
          closeTool: () => undefined,
        }}
      >
        <ToolkitOverlay context={context} />
      </ToolkitContext.Provider>
    );

    expect(html).toContain("Tools");
    expect(html).toContain("Basic Calculator");
  });
});
