export const ELEMENT_CATEGORIES = [
  "alkali_metal",
  "alkaline_earth_metal",
  "transition_metal",
  "post_transition_metal",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble_gas",
  "lanthanide",
  "actinide",
] as const;

export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export type ElementBlock = "s" | "p" | "d" | "f";

export type PeriodicElement = {
  symbol: string;
  name: string;
  atomicNumber: number;
  atomicMass: number;
  group: number | null;
  period: number;
  block: ElementBlock;
  category: ElementCategory;
  electronegativity: number | null;
  meltingPoint: number | null;
  boilingPoint: number | null;
  electronConfig: string;
  shells: number[];
};

// Normalized from the public Periodic-Table-JSON dataset. Temperatures are converted from Kelvin to Celsius.
export const ELEMENTS: PeriodicElement[] = [
  { symbol: "H", name: "Hydrogen", atomicNumber: 1, atomicMass: 1.008, group: 1, period: 1, block: "s", category: "nonmetal", electronegativity: 2.2, meltingPoint: -259.16, boilingPoint: -252.88, electronConfig: "1s1", shells: [1] },
  { symbol: "He", name: "Helium", atomicNumber: 2, atomicMass: 4.0026022, group: 18, period: 1, block: "s", category: "noble_gas", electronegativity: null, meltingPoint: -272.2, boilingPoint: -268.93, electronConfig: "1s2", shells: [2] },
  { symbol: "Li", name: "Lithium", atomicNumber: 3, atomicMass: 6.94, group: 1, period: 2, block: "s", category: "alkali_metal", electronegativity: 0.98, meltingPoint: 180.5, boilingPoint: 1329.85, electronConfig: "[He] 2s1", shells: [2,1] },
  { symbol: "Be", name: "Beryllium", atomicNumber: 4, atomicMass: 9.01218315, group: 2, period: 2, block: "s", category: "alkaline_earth_metal", electronegativity: 1.57, meltingPoint: 1286.85, boilingPoint: 2468.85, electronConfig: "[He] 2s2", shells: [2,2] },
  { symbol: "B", name: "Boron", atomicNumber: 5, atomicMass: 10.81, group: 13, period: 2, block: "p", category: "metalloid", electronegativity: 2.04, meltingPoint: 2075.85, boilingPoint: 3926.85, electronConfig: "[He] 2s2 2p1", shells: [2,3] },
  { symbol: "C", name: "Carbon", atomicNumber: 6, atomicMass: 12.011, group: 14, period: 2, block: "p", category: "nonmetal", electronegativity: 2.55, meltingPoint: null, boilingPoint: null, electronConfig: "[He] 2s2 2p2", shells: [2,4] },
  { symbol: "N", name: "Nitrogen", atomicNumber: 7, atomicMass: 14.007, group: 15, period: 2, block: "p", category: "nonmetal", electronegativity: 3.04, meltingPoint: -210, boilingPoint: -195.79, electronConfig: "[He] 2s2 2p3", shells: [2,5] },
  { symbol: "O", name: "Oxygen", atomicNumber: 8, atomicMass: 15.999, group: 16, period: 2, block: "p", category: "nonmetal", electronegativity: 3.44, meltingPoint: -218.79, boilingPoint: -182.96, electronConfig: "[He] 2s2 2p4", shells: [2,6] },
  { symbol: "F", name: "Fluorine", atomicNumber: 9, atomicMass: 18.9984031636, group: 17, period: 2, block: "p", category: "nonmetal", electronegativity: 3.98, meltingPoint: -219.67, boilingPoint: -188.12, electronConfig: "[He] 2s2 2p5", shells: [2,7] },
  { symbol: "Ne", name: "Neon", atomicNumber: 10, atomicMass: 20.17976, group: 18, period: 2, block: "p", category: "noble_gas", electronegativity: null, meltingPoint: -248.59, boilingPoint: -246.05, electronConfig: "[He] 2s2 2p6", shells: [2,8] },
  { symbol: "Na", name: "Sodium", atomicNumber: 11, atomicMass: 22.989769282, group: 1, period: 3, block: "s", category: "alkali_metal", electronegativity: 0.93, meltingPoint: 97.79, boilingPoint: 882.94, electronConfig: "[Ne] 3s1", shells: [2,8,1] },
  { symbol: "Mg", name: "Magnesium", atomicNumber: 12, atomicMass: 24.305, group: 2, period: 3, block: "s", category: "alkaline_earth_metal", electronegativity: 1.31, meltingPoint: 649.85, boilingPoint: 1089.85, electronConfig: "[Ne] 3s2", shells: [2,8,2] },
  { symbol: "Al", name: "Aluminium", atomicNumber: 13, atomicMass: 26.98153857, group: 13, period: 3, block: "p", category: "post_transition_metal", electronegativity: 1.61, meltingPoint: 660.32, boilingPoint: 2469.85, electronConfig: "[Ne] 3s2 3p1", shells: [2,8,3] },
  { symbol: "Si", name: "Silicon", atomicNumber: 14, atomicMass: 28.085, group: 14, period: 3, block: "p", category: "metalloid", electronegativity: 1.9, meltingPoint: 1413.85, boilingPoint: 3264.85, electronConfig: "[Ne] 3s2 3p2", shells: [2,8,4] },
  { symbol: "P", name: "Phosphorus", atomicNumber: 15, atomicMass: 30.9737619985, group: 15, period: 3, block: "p", category: "nonmetal", electronegativity: 2.19, meltingPoint: null, boilingPoint: null, electronConfig: "[Ne] 3s2 3p3", shells: [2,8,5] },
  { symbol: "S", name: "Sulfur", atomicNumber: 16, atomicMass: 32.06, group: 16, period: 3, block: "p", category: "nonmetal", electronegativity: 2.58, meltingPoint: 115.21, boilingPoint: 444.65, electronConfig: "[Ne] 3s2 3p4", shells: [2,8,6] },
  { symbol: "Cl", name: "Chlorine", atomicNumber: 17, atomicMass: 35.45, group: 17, period: 3, block: "p", category: "nonmetal", electronegativity: 3.16, meltingPoint: -101.55, boilingPoint: -34.04, electronConfig: "[Ne] 3s2 3p5", shells: [2,8,7] },
  { symbol: "Ar", name: "Argon", atomicNumber: 18, atomicMass: 39.9481, group: 18, period: 3, block: "p", category: "noble_gas", electronegativity: null, meltingPoint: -189.34, boilingPoint: -185.85, electronConfig: "[Ne] 3s2 3p6", shells: [2,8,8] },
  { symbol: "K", name: "Potassium", atomicNumber: 19, atomicMass: 39.09831, group: 1, period: 4, block: "s", category: "alkali_metal", electronegativity: 0.82, meltingPoint: 63.55, boilingPoint: 758.85, electronConfig: "[Ar] 4s1", shells: [2,8,8,1] },
  { symbol: "Ca", name: "Calcium", atomicNumber: 20, atomicMass: 40.0784, group: 2, period: 4, block: "s", category: "alkaline_earth_metal", electronegativity: 1, meltingPoint: 841.85, boilingPoint: 1483.85, electronConfig: "[Ar] 4s2", shells: [2,8,8,2] },
  { symbol: "Sc", name: "Scandium", atomicNumber: 21, atomicMass: 44.9559085, group: 3, period: 4, block: "d", category: "transition_metal", electronegativity: 1.36, meltingPoint: 1540.85, boilingPoint: 2835.85, electronConfig: "[Ar] 3d1 4s2", shells: [2,8,9,2] },
  { symbol: "Ti", name: "Titanium", atomicNumber: 22, atomicMass: 47.8671, group: 4, period: 4, block: "d", category: "transition_metal", electronegativity: 1.54, meltingPoint: 1667.85, boilingPoint: 3286.85, electronConfig: "[Ar] 3d2 4s2", shells: [2,8,10,2] },
  { symbol: "V", name: "Vanadium", atomicNumber: 23, atomicMass: 50.94151, group: 5, period: 4, block: "d", category: "transition_metal", electronegativity: 1.63, meltingPoint: 1909.85, boilingPoint: 3406.85, electronConfig: "[Ar] 3d3 4s2", shells: [2,8,11,2] },
  { symbol: "Cr", name: "Chromium", atomicNumber: 24, atomicMass: 51.99616, group: 6, period: 4, block: "d", category: "transition_metal", electronegativity: 1.66, meltingPoint: 1906.85, boilingPoint: 2670.85, electronConfig: "[Ar] 3d5 4s1", shells: [2,8,13,1] },
  { symbol: "Mn", name: "Manganese", atomicNumber: 25, atomicMass: 54.9380443, group: 7, period: 4, block: "d", category: "transition_metal", electronegativity: 1.55, meltingPoint: 1245.85, boilingPoint: 2060.85, electronConfig: "[Ar] 3d5 4s2", shells: [2,8,13,2] },
  { symbol: "Fe", name: "Iron", atomicNumber: 26, atomicMass: 55.8452, group: 8, period: 4, block: "d", category: "transition_metal", electronegativity: 1.83, meltingPoint: 1537.85, boilingPoint: 2860.85, electronConfig: "[Ar] 3d6 4s2", shells: [2,8,14,2] },
  { symbol: "Co", name: "Cobalt", atomicNumber: 27, atomicMass: 58.9331944, group: 9, period: 4, block: "d", category: "transition_metal", electronegativity: 1.88, meltingPoint: 1494.85, boilingPoint: 2926.85, electronConfig: "[Ar] 3d7 4s2", shells: [2,8,15,2] },
  { symbol: "Ni", name: "Nickel", atomicNumber: 28, atomicMass: 58.69344, group: 10, period: 4, block: "d", category: "transition_metal", electronegativity: 1.91, meltingPoint: 1454.85, boilingPoint: 2729.85, electronConfig: "[Ar] 3d8 4s2", shells: [2,8,16,2] },
  { symbol: "Cu", name: "Copper", atomicNumber: 29, atomicMass: 63.5463, group: 11, period: 4, block: "d", category: "transition_metal", electronegativity: 1.9, meltingPoint: 1084.62, boilingPoint: 2561.85, electronConfig: "[Ar] 3d10 4s1", shells: [2,8,18,1] },
  { symbol: "Zn", name: "Zinc", atomicNumber: 30, atomicMass: 65.382, group: 12, period: 4, block: "d", category: "transition_metal", electronegativity: 1.65, meltingPoint: 419.53, boilingPoint: 906.85, electronConfig: "[Ar] 3d10 4s2", shells: [2,8,18,2] },
  { symbol: "Ga", name: "Gallium", atomicNumber: 31, atomicMass: 69.7231, group: 13, period: 4, block: "p", category: "post_transition_metal", electronegativity: 1.81, meltingPoint: 29.76, boilingPoint: 2399.85, electronConfig: "[Ar] 3d10 4s2 4p1", shells: [2,8,18,3] },
  { symbol: "Ge", name: "Germanium", atomicNumber: 32, atomicMass: 72.6308, group: 14, period: 4, block: "p", category: "metalloid", electronegativity: 2.01, meltingPoint: 938.25, boilingPoint: 2832.85, electronConfig: "[Ar] 3d10 4s2 4p2", shells: [2,8,18,4] },
  { symbol: "As", name: "Arsenic", atomicNumber: 33, atomicMass: 74.9215956, group: 15, period: 4, block: "p", category: "metalloid", electronegativity: 2.18, meltingPoint: null, boilingPoint: null, electronConfig: "[Ar] 3d10 4s2 4p3", shells: [2,8,18,5] },
  { symbol: "Se", name: "Selenium", atomicNumber: 34, atomicMass: 78.9718, group: 16, period: 4, block: "p", category: "nonmetal", electronegativity: 2.55, meltingPoint: 220.85, boilingPoint: 684.85, electronConfig: "[Ar] 3d10 4s2 4p4", shells: [2,8,18,6] },
  { symbol: "Br", name: "Bromine", atomicNumber: 35, atomicMass: 79.904, group: 17, period: 4, block: "p", category: "nonmetal", electronegativity: 2.96, meltingPoint: -7.35, boilingPoint: 58.85, electronConfig: "[Ar] 3d10 4s2 4p5", shells: [2,8,18,7] },
  { symbol: "Kr", name: "Krypton", atomicNumber: 36, atomicMass: 83.7982, group: 18, period: 4, block: "p", category: "noble_gas", electronegativity: 3, meltingPoint: -157.37, boilingPoint: -153.22, electronConfig: "[Ar] 3d10 4s2 4p6", shells: [2,8,18,8] },
  { symbol: "Rb", name: "Rubidium", atomicNumber: 37, atomicMass: 85.46783, group: 1, period: 5, block: "s", category: "alkali_metal", electronegativity: 0.82, meltingPoint: 39.3, boilingPoint: 687.85, electronConfig: "[Kr] 5s1", shells: [2,8,18,8,1] },
  { symbol: "Sr", name: "Strontium", atomicNumber: 38, atomicMass: 87.621, group: 2, period: 5, block: "s", category: "alkaline_earth_metal", electronegativity: 0.95, meltingPoint: 776.85, boilingPoint: 1376.85, electronConfig: "[Kr] 5s2", shells: [2,8,18,8,2] },
  { symbol: "Y", name: "Yttrium", atomicNumber: 39, atomicMass: 88.905842, group: 3, period: 5, block: "d", category: "transition_metal", electronegativity: 1.22, meltingPoint: 1525.85, boilingPoint: 2929.85, electronConfig: "[Kr] 4d1 5s2", shells: [2,8,18,9,2] },
  { symbol: "Zr", name: "Zirconium", atomicNumber: 40, atomicMass: 91.2242, group: 4, period: 5, block: "d", category: "transition_metal", electronegativity: 1.33, meltingPoint: 1854.85, boilingPoint: 4376.85, electronConfig: "[Kr] 4d2 5s2", shells: [2,8,18,10,2] },
  { symbol: "Nb", name: "Niobium", atomicNumber: 41, atomicMass: 92.906372, group: 5, period: 5, block: "d", category: "transition_metal", electronegativity: 1.6, meltingPoint: 2476.85, boilingPoint: 4743.85, electronConfig: "[Kr] 4d4 5s1", shells: [2,8,18,12,1] },
  { symbol: "Mo", name: "Molybdenum", atomicNumber: 42, atomicMass: 95.951, group: 6, period: 5, block: "d", category: "transition_metal", electronegativity: 2.16, meltingPoint: 2622.85, boilingPoint: 4638.85, electronConfig: "[Kr] 4d5 5s1", shells: [2,8,18,13,1] },
  { symbol: "Tc", name: "Technetium", atomicNumber: 43, atomicMass: 98, group: 7, period: 5, block: "d", category: "transition_metal", electronegativity: 1.9, meltingPoint: 2156.85, boilingPoint: 4264.85, electronConfig: "[Kr] 4d5 5s2", shells: [2,8,18,13,2] },
  { symbol: "Ru", name: "Ruthenium", atomicNumber: 44, atomicMass: 101.072, group: 8, period: 5, block: "d", category: "transition_metal", electronegativity: 2.2, meltingPoint: 2333.85, boilingPoint: 4149.85, electronConfig: "[Kr] 4d7 5s1", shells: [2,8,18,15,1] },
  { symbol: "Rh", name: "Rhodium", atomicNumber: 45, atomicMass: 102.905502, group: 9, period: 5, block: "d", category: "transition_metal", electronegativity: 2.28, meltingPoint: 1963.85, boilingPoint: 3694.85, electronConfig: "[Kr] 4d8 5s1", shells: [2,8,18,16,1] },
  { symbol: "Pd", name: "Palladium", atomicNumber: 46, atomicMass: 106.421, group: 10, period: 5, block: "d", category: "transition_metal", electronegativity: 2.2, meltingPoint: 1554.9, boilingPoint: 2962.85, electronConfig: "[Kr] 4d10", shells: [2,8,18,18] },
  { symbol: "Ag", name: "Silver", atomicNumber: 47, atomicMass: 107.86822, group: 11, period: 5, block: "d", category: "transition_metal", electronegativity: 1.93, meltingPoint: 961.78, boilingPoint: 2161.85, electronConfig: "[Kr] 4d10 5s1", shells: [2,8,18,18,1] },
  { symbol: "Cd", name: "Cadmium", atomicNumber: 48, atomicMass: 112.4144, group: 12, period: 5, block: "d", category: "transition_metal", electronegativity: 1.69, meltingPoint: 321.07, boilingPoint: 766.85, electronConfig: "[Kr] 4d10 5s2", shells: [2,8,18,18,2] },
  { symbol: "In", name: "Indium", atomicNumber: 49, atomicMass: 114.8181, group: 13, period: 5, block: "p", category: "post_transition_metal", electronegativity: 1.78, meltingPoint: 156.6, boilingPoint: 2071.85, electronConfig: "[Kr] 4d10 5s2 5p1", shells: [2,8,18,18,3] },
  { symbol: "Sn", name: "Tin", atomicNumber: 50, atomicMass: 118.7107, group: 14, period: 5, block: "p", category: "post_transition_metal", electronegativity: 1.96, meltingPoint: 231.93, boilingPoint: 2601.85, electronConfig: "[Kr] 4d10 5s2 5p2", shells: [2,8,18,18,4] },
  { symbol: "Sb", name: "Antimony", atomicNumber: 51, atomicMass: 121.7601, group: 15, period: 5, block: "p", category: "metalloid", electronegativity: 2.05, meltingPoint: 630.63, boilingPoint: 1634.85, electronConfig: "[Kr] 4d10 5s2 5p3", shells: [2,8,18,18,5] },
  { symbol: "Te", name: "Tellurium", atomicNumber: 52, atomicMass: 127.603, group: 16, period: 5, block: "p", category: "metalloid", electronegativity: 2.1, meltingPoint: 449.51, boilingPoint: 987.85, electronConfig: "[Kr] 4d10 5s2 5p4", shells: [2,8,18,18,6] },
  { symbol: "I", name: "Iodine", atomicNumber: 53, atomicMass: 126.904473, group: 17, period: 5, block: "p", category: "nonmetal", electronegativity: 2.66, meltingPoint: 113.7, boilingPoint: 184.25, electronConfig: "[Kr] 4d10 5s2 5p5", shells: [2,8,18,18,7] },
  { symbol: "Xe", name: "Xenon", atomicNumber: 54, atomicMass: 131.2936, group: 18, period: 5, block: "p", category: "noble_gas", electronegativity: 2.6, meltingPoint: -111.75, boilingPoint: -108.1, electronConfig: "[Kr] 4d10 5s2 5p6", shells: [2,8,18,18,8] },
  { symbol: "Cs", name: "Cesium", atomicNumber: 55, atomicMass: 132.905451966, group: 1, period: 6, block: "s", category: "alkali_metal", electronegativity: 0.79, meltingPoint: 28.55, boilingPoint: 670.85, electronConfig: "[Xe] 6s1", shells: [2,8,18,18,8,1] },
  { symbol: "Ba", name: "Barium", atomicNumber: 56, atomicMass: 137.3277, group: 2, period: 6, block: "s", category: "alkaline_earth_metal", electronegativity: 0.89, meltingPoint: 726.85, boilingPoint: 1844.85, electronConfig: "[Xe] 6s2", shells: [2,8,18,18,8,2] },
  { symbol: "La", name: "Lanthanum", atomicNumber: 57, atomicMass: 138.905477, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.1, meltingPoint: 919.85, boilingPoint: 3463.85, electronConfig: "[Xe] 5d16s2", shells: [2,8,18,18,9,2] },
  { symbol: "Ce", name: "Cerium", atomicNumber: 58, atomicMass: 140.1161, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.12, meltingPoint: 794.85, boilingPoint: 3442.85, electronConfig: "[Xe] 4f1 5d1 6s2", shells: [2,8,18,19,9,2] },
  { symbol: "Pr", name: "Praseodymium", atomicNumber: 59, atomicMass: 140.907662, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.13, meltingPoint: 934.85, boilingPoint: 3129.85, electronConfig: "[Xe] 4f3 6s2", shells: [2,8,18,21,8,2] },
  { symbol: "Nd", name: "Neodymium", atomicNumber: 60, atomicMass: 144.2423, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.14, meltingPoint: 1023.85, boilingPoint: 3073.85, electronConfig: "[Xe] 4f4 6s2", shells: [2,8,18,22,8,2] },
  { symbol: "Pm", name: "Promethium", atomicNumber: 61, atomicMass: 145, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.13, meltingPoint: 1041.85, boilingPoint: 2999.85, electronConfig: "[Xe] 4f5 6s2", shells: [2,8,18,23,8,2] },
  { symbol: "Sm", name: "Samarium", atomicNumber: 62, atomicMass: 150.362, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.17, meltingPoint: 1071.85, boilingPoint: 1899.85, electronConfig: "[Xe] 4f6 6s2", shells: [2,8,18,24,8,2] },
  { symbol: "Eu", name: "Europium", atomicNumber: 63, atomicMass: 151.9641, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.2, meltingPoint: 825.85, boilingPoint: 1528.85, electronConfig: "[Xe] 4f7 6s2", shells: [2,8,18,25,8,2] },
  { symbol: "Gd", name: "Gadolinium", atomicNumber: 64, atomicMass: 157.253, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.2, meltingPoint: 1311.85, boilingPoint: 2999.85, electronConfig: "[Xe] 4f7 5d1 6s2", shells: [2,8,18,25,9,2] },
  { symbol: "Tb", name: "Terbium", atomicNumber: 65, atomicMass: 158.925352, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.1, meltingPoint: 1355.85, boilingPoint: 3122.85, electronConfig: "[Xe] 4f9 6s2", shells: [2,8,18,27,8,2] },
  { symbol: "Dy", name: "Dysprosium", atomicNumber: 66, atomicMass: 162.5001, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.22, meltingPoint: 1406.85, boilingPoint: 2566.85, electronConfig: "[Xe] 4f10 6s2", shells: [2,8,18,28,8,2] },
  { symbol: "Ho", name: "Holmium", atomicNumber: 67, atomicMass: 164.930332, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.23, meltingPoint: 1460.85, boilingPoint: 2599.85, electronConfig: "[Xe] 4f11 6s2", shells: [2,8,18,29,8,2] },
  { symbol: "Er", name: "Erbium", atomicNumber: 68, atomicMass: 167.2593, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.24, meltingPoint: 1528.85, boilingPoint: 2867.85, electronConfig: "[Xe] 4f12 6s2", shells: [2,8,18,30,8,2] },
  { symbol: "Tm", name: "Thulium", atomicNumber: 69, atomicMass: 168.934222, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.25, meltingPoint: 1544.85, boilingPoint: 1949.85, electronConfig: "[Xe] 4f13 6s2", shells: [2,8,18,31,8,2] },
  { symbol: "Yb", name: "Ytterbium", atomicNumber: 70, atomicMass: 173.0451, group: null, period: 6, block: "f", category: "lanthanide", electronegativity: 1.1, meltingPoint: 823.85, boilingPoint: 1195.85, electronConfig: "[Xe] 4f14 6s2", shells: [2,8,18,32,8,2] },
  { symbol: "Lu", name: "Lutetium", atomicNumber: 71, atomicMass: 174.96681, group: null, period: 6, block: "d", category: "lanthanide", electronegativity: 1.27, meltingPoint: 1651.85, boilingPoint: 3401.85, electronConfig: "[Xe] 4f14 5d1 6s2", shells: [2,8,18,32,9,2] },
  { symbol: "Hf", name: "Hafnium", atomicNumber: 72, atomicMass: 178.492, group: 4, period: 6, block: "d", category: "transition_metal", electronegativity: 1.3, meltingPoint: 2232.85, boilingPoint: 4602.85, electronConfig: "[Xe] 4f14 5d2 6s2", shells: [2,8,18,32,10,2] },
  { symbol: "Ta", name: "Tantalum", atomicNumber: 73, atomicMass: 180.947882, group: 5, period: 6, block: "d", category: "transition_metal", electronegativity: 1.5, meltingPoint: 3016.85, boilingPoint: 5457.85, electronConfig: "[Xe] 4f14 5d3 6s2", shells: [2,8,18,32,11,2] },
  { symbol: "W", name: "Tungsten", atomicNumber: 74, atomicMass: 183.841, group: 6, period: 6, block: "d", category: "transition_metal", electronegativity: 2.36, meltingPoint: 3421.85, boilingPoint: 5929.85, electronConfig: "[Xe] 4f14 5d4 6s2", shells: [2,8,18,32,12,2] },
  { symbol: "Re", name: "Rhenium", atomicNumber: 75, atomicMass: 186.2071, group: 7, period: 6, block: "d", category: "transition_metal", electronegativity: 1.9, meltingPoint: 3185.85, boilingPoint: 5595.85, electronConfig: "[Xe] 4f14 5d5 6s2", shells: [2,8,18,32,13,2] },
  { symbol: "Os", name: "Osmium", atomicNumber: 76, atomicMass: 190.233, group: 8, period: 6, block: "d", category: "transition_metal", electronegativity: 2.2, meltingPoint: 3032.85, boilingPoint: 5011.85, electronConfig: "[Xe] 4f14 5d6 6s2", shells: [2,8,18,32,14,2] },
  { symbol: "Ir", name: "Iridium", atomicNumber: 77, atomicMass: 192.2173, group: 9, period: 6, block: "d", category: "transition_metal", electronegativity: 2.2, meltingPoint: 2445.85, boilingPoint: 4129.85, electronConfig: "[Xe] 4f14 5d7 6s2", shells: [2,8,18,32,15,2] },
  { symbol: "Pt", name: "Platinum", atomicNumber: 78, atomicMass: 195.0849, group: 10, period: 6, block: "d", category: "transition_metal", electronegativity: 2.28, meltingPoint: 1768.25, boilingPoint: 3824.85, electronConfig: "[Xe] 4f14 5d9 6s1", shells: [2,8,18,32,17,1] },
  { symbol: "Au", name: "Gold", atomicNumber: 79, atomicMass: 196.9665695, group: 11, period: 6, block: "d", category: "transition_metal", electronegativity: 2.54, meltingPoint: 1064.18, boilingPoint: 2969.85, electronConfig: "[Xe] 4f14 5d10 6s1", shells: [2,8,18,32,18,1] },
  { symbol: "Hg", name: "Mercury", atomicNumber: 80, atomicMass: 200.5923, group: 12, period: 6, block: "d", category: "transition_metal", electronegativity: 2, meltingPoint: -38.83, boilingPoint: 356.73, electronConfig: "[Xe] 4f14 5d10 6s2", shells: [2,8,18,32,18,2] },
  { symbol: "Tl", name: "Thallium", atomicNumber: 81, atomicMass: 204.38, group: 13, period: 6, block: "p", category: "post_transition_metal", electronegativity: 1.62, meltingPoint: 303.85, boilingPoint: 1472.85, electronConfig: "[Xe] 4f14 5d10 6s2 6p1", shells: [2,8,18,32,18,3] },
  { symbol: "Pb", name: "Lead", atomicNumber: 82, atomicMass: 207.21, group: 14, period: 6, block: "p", category: "post_transition_metal", electronegativity: 1.87, meltingPoint: 327.46, boilingPoint: 1748.85, electronConfig: "[Xe] 4f14 5d10 6s2 6p2", shells: [2,8,18,32,18,4] },
  { symbol: "Bi", name: "Bismuth", atomicNumber: 83, atomicMass: 208.980401, group: 15, period: 6, block: "p", category: "post_transition_metal", electronegativity: 2.02, meltingPoint: 271.55, boilingPoint: 1563.85, electronConfig: "[Xe] 4f14 5d10 6s2 6p3", shells: [2,8,18,32,18,5] },
  { symbol: "Po", name: "Polonium", atomicNumber: 84, atomicMass: 209, group: 16, period: 6, block: "p", category: "post_transition_metal", electronegativity: 2, meltingPoint: 253.85, boilingPoint: 961.85, electronConfig: "[Xe] 4f14 5d10 6s2 6p4", shells: [2,8,18,32,18,6] },
  { symbol: "At", name: "Astatine", atomicNumber: 85, atomicMass: 210, group: 17, period: 6, block: "p", category: "metalloid", electronegativity: 2.2, meltingPoint: 301.85, boilingPoint: 336.85, electronConfig: "[Xe] 4f14 5d10 6s2 6p5", shells: [2,8,18,32,18,7] },
  { symbol: "Rn", name: "Radon", atomicNumber: 86, atomicMass: 222, group: 18, period: 6, block: "p", category: "noble_gas", electronegativity: 2.2, meltingPoint: -71.15, boilingPoint: -61.65, electronConfig: "[Xe] 4f14 5d10 6s2 6p6", shells: [2,8,18,32,18,8] },
  { symbol: "Fr", name: "Francium", atomicNumber: 87, atomicMass: 223, group: 1, period: 7, block: "s", category: "alkali_metal", electronegativity: 0.79, meltingPoint: 26.85, boilingPoint: 676.85, electronConfig: "[Rn] 7s1", shells: [2,8,18,32,18,8,1] },
  { symbol: "Ra", name: "Radium", atomicNumber: 88, atomicMass: 226, group: 2, period: 7, block: "s", category: "alkaline_earth_metal", electronegativity: 0.9, meltingPoint: 959.85, boilingPoint: 1736.85, electronConfig: "[Rn] 7s2", shells: [2,8,18,32,18,8,2] },
  { symbol: "Ac", name: "Actinium", atomicNumber: 89, atomicMass: 227, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.1, meltingPoint: 1226.85, boilingPoint: 3226.85, electronConfig: "[Rn] 6d1 7s2", shells: [2,8,18,32,18,9,2] },
  { symbol: "Th", name: "Thorium", atomicNumber: 90, atomicMass: 232.03774, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 1749.85, boilingPoint: 4787.85, electronConfig: "[Rn] 6d2 7s2", shells: [2,8,18,32,18,10,2] },
  { symbol: "Pa", name: "Protactinium", atomicNumber: 91, atomicMass: 231.035882, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.5, meltingPoint: 1567.85, boilingPoint: 4026.85, electronConfig: "[Rn] 5f2 6d1 7s2", shells: [2,8,18,32,20,9,2] },
  { symbol: "U", name: "Uranium", atomicNumber: 92, atomicMass: 238.028913, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.38, meltingPoint: 1132.15, boilingPoint: 4130.85, electronConfig: "[Rn] 5f3 6d1 7s2", shells: [2,8,18,32,21,9,2] },
  { symbol: "Np", name: "Neptunium", atomicNumber: 93, atomicMass: 237, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.36, meltingPoint: 638.85, boilingPoint: 4173.85, electronConfig: "[Rn] 5f4 6d1 7s2", shells: [2,8,18,32,22,9,2] },
  { symbol: "Pu", name: "Plutonium", atomicNumber: 94, atomicMass: 244, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.28, meltingPoint: 639.35, boilingPoint: 3231.85, electronConfig: "[Rn] 5f6 7s2", shells: [2,8,18,32,24,8,2] },
  { symbol: "Am", name: "Americium", atomicNumber: 95, atomicMass: 243, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.13, meltingPoint: 1175.85, boilingPoint: 2606.85, electronConfig: "[Rn] 5f7 7s2", shells: [2,8,18,32,25,8,2] },
  { symbol: "Cm", name: "Curium", atomicNumber: 96, atomicMass: 247, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.28, meltingPoint: 1339.85, boilingPoint: 3109.85, electronConfig: "[Rn] 5f7 6d1 7s2", shells: [2,8,18,32,25,9,2] },
  { symbol: "Bk", name: "Berkelium", atomicNumber: 97, atomicMass: 247, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 985.85, boilingPoint: 2626.85, electronConfig: "[Rn] 5f9 7s2", shells: [2,8,18,32,27,8,2] },
  { symbol: "Cf", name: "Californium", atomicNumber: 98, atomicMass: 251, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 899.85, boilingPoint: 1469.85, electronConfig: "[Rn] 5f10 7s2", shells: [2,8,18,32,28,8,2] },
  { symbol: "Es", name: "Einsteinium", atomicNumber: 99, atomicMass: 252, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 859.85, boilingPoint: 995.85, electronConfig: "[Rn] 5f11 7s2", shells: [2,8,18,32,29,8,2] },
  { symbol: "Fm", name: "Fermium", atomicNumber: 100, atomicMass: 257, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 1526.85, boilingPoint: null, electronConfig: "[Rn] 5f12 7s2", shells: [2,8,18,32,30,8,2] },
  { symbol: "Md", name: "Mendelevium", atomicNumber: 101, atomicMass: 258, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 826.85, boilingPoint: null, electronConfig: "[Rn] 5f13 7s2", shells: [2,8,18,32,31,8,2] },
  { symbol: "No", name: "Nobelium", atomicNumber: 102, atomicMass: 259, group: null, period: 7, block: "f", category: "actinide", electronegativity: 1.3, meltingPoint: 826.85, boilingPoint: null, electronConfig: "[Rn] 5f14 7s2", shells: [2,8,18,32,32,8,2] },
  { symbol: "Lr", name: "Lawrencium", atomicNumber: 103, atomicMass: 266, group: null, period: 7, block: "d", category: "actinide", electronegativity: 1.3, meltingPoint: 1626.85, boilingPoint: null, electronConfig: "[Rn] 5f14 7s2 7p1", shells: [2,8,18,32,32,8,3] },
  { symbol: "Rf", name: "Rutherfordium", atomicNumber: 104, atomicMass: 267, group: 4, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: 2126.85, boilingPoint: 5526.85, electronConfig: "[Rn] 5f14 6d2 7s2", shells: [2,8,18,32,32,10,2] },
  { symbol: "Db", name: "Dubnium", atomicNumber: 105, atomicMass: 268, group: 5, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d3 7s2", shells: [2,8,18,32,32,11,2] },
  { symbol: "Sg", name: "Seaborgium", atomicNumber: 106, atomicMass: 269, group: 6, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d4 7s2", shells: [2,8,18,32,32,12,2] },
  { symbol: "Bh", name: "Bohrium", atomicNumber: 107, atomicMass: 270, group: 7, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d5 7s2", shells: [2,8,18,32,32,13,2] },
  { symbol: "Hs", name: "Hassium", atomicNumber: 108, atomicMass: 269, group: 8, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: -147.15, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d6 7s2", shells: [2,8,18,32,32,14,2] },
  { symbol: "Mt", name: "Meitnerium", atomicNumber: 109, atomicMass: 278, group: 9, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d7 7s2", shells: [2,8,18,32,32,15,2] },
  { symbol: "Ds", name: "Darmstadtium", atomicNumber: 110, atomicMass: 281, group: 10, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d9 7s1", shells: [2,8,18,32,32,16,2] },
  { symbol: "Rg", name: "Roentgenium", atomicNumber: 111, atomicMass: 282, group: 11, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: null, electronConfig: "*[Rn] 5f14 6d10 7s1", shells: [2,8,18,32,32,17,2] },
  { symbol: "Cn", name: "Copernicium", atomicNumber: 112, atomicMass: 285, group: 12, period: 7, block: "d", category: "transition_metal", electronegativity: null, meltingPoint: null, boilingPoint: 3296.85, electronConfig: "*[Rn] 5f14 6d10 7s2", shells: [2,8,18,32,32,18,2] },
  { symbol: "Nh", name: "Nihonium", atomicNumber: 113, atomicMass: 286, group: 13, period: 7, block: "p", category: "transition_metal", electronegativity: null, meltingPoint: 426.85, boilingPoint: 1156.85, electronConfig: "*[Rn] 5f14 6d10 7s2 7p1", shells: [2,8,18,32,32,18,3] },
  { symbol: "Fl", name: "Flerovium", atomicNumber: 114, atomicMass: 289, group: 14, period: 7, block: "p", category: "post_transition_metal", electronegativity: null, meltingPoint: 66.85, boilingPoint: 146.85, electronConfig: "*[Rn] 5f14 6d10 7s2 7p2", shells: [2,8,18,32,32,18,4] },
  { symbol: "Mc", name: "Moscovium", atomicNumber: 115, atomicMass: 289, group: 15, period: 7, block: "p", category: "post_transition_metal", electronegativity: null, meltingPoint: 396.85, boilingPoint: 1126.85, electronConfig: "*[Rn] 5f14 6d10 7s2 7p3", shells: [2,8,18,32,32,18,5] },
  { symbol: "Lv", name: "Livermorium", atomicNumber: 116, atomicMass: 293, group: 16, period: 7, block: "p", category: "post_transition_metal", electronegativity: null, meltingPoint: 435.85, boilingPoint: 811.85, electronConfig: "*[Rn] 5f14 6d10 7s2 7p4", shells: [2,8,18,32,32,18,6] },
  { symbol: "Ts", name: "Tennessine", atomicNumber: 117, atomicMass: 294, group: 17, period: 7, block: "p", category: "halogen", electronegativity: null, meltingPoint: 449.85, boilingPoint: 609.85, electronConfig: "*[Rn] 5f14 6d10 7s2 7p5", shells: [2,8,18,32,32,18,7] },
  { symbol: "Og", name: "Oganesson", atomicNumber: 118, atomicMass: 294, group: 18, period: 7, block: "p", category: "noble_gas", electronegativity: null, meltingPoint: null, boilingPoint: 76.85, electronConfig: "*[Rn] 5f14 6d10 7s2 7p6", shells: [2,8,18,32,32,18,8] }
];

export const ELEMENTS_BY_SYMBOL = new Map(ELEMENTS.map((element) => [element.symbol, element]));
export const ELEMENTS_BY_ATOMIC_NUMBER = new Map(ELEMENTS.map((element) => [element.atomicNumber, element]));

export function getElementBySymbol(symbol: string): PeriodicElement | undefined {
  return ELEMENTS_BY_SYMBOL.get(symbol);
}

export function isElementCategory(category: string): category is ElementCategory {
  return (ELEMENT_CATEGORIES as readonly string[]).includes(category);
}
