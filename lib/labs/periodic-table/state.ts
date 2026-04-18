export type PeriodicViewMode = "table" | "bohr" | "properties";
export type PeriodicProperty = "electronegativity" | "meltingPoint" | "boilingPoint";

export type PeriodicTableState = {
  selectedElement: string | null;
  viewMode: PeriodicViewMode;
  highlightCategory: string | null;
  highlightProperty: PeriodicProperty | null;
  paused: boolean;
};

export const PERIODIC_TABLE_INITIAL_STATE: PeriodicTableState = {
  selectedElement: null,
  viewMode: "table",
  highlightCategory: null,
  highlightProperty: null,
  paused: false,
};
