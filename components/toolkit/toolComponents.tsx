"use client";

import type { ComponentType } from "react";

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

export type ToolComponentProps = {
  onClose?: () => void;
  assessmentMode?: boolean;
};

export const TOOL_COMPONENTS: Record<string, ComponentType<ToolComponentProps>> = {
  "basic-calculator": BasicCalculator,
  "scientific-calculator": ScientificCalculator,
  "fraction-visualizer": FractionVisualizer,
  "number-line": NumberLine,
  "digital-ruler": DigitalRuler,
  protractor: Protractor,
  "multiplication-table": MultiplicationTable,
  "periodic-table": PeriodicTable,
  "unit-converter": UnitConverter,
  "coordinate-grid": CoordinateGrid,
  timer: Timer,
  dictionary: DictionaryTool,
};
