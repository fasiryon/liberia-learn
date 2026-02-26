"use client";

import { useMemo, useState } from "react";

interface PeriodicTableProps {
  onClose?: () => void;
}

type Element = {
  number: number;
  symbol: string;
  name: string;
  mass: number;
  group: string;
  period: number;
};

const SYMBOLS = [
  "H","He","Li","Be","B","C","N","O","F","Ne","Na","Mg","Al","Si","P","S","Cl","Ar","K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga","Ge","As","Se","Br","Kr","Rb","Sr","Y","Zr","Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn","Sb","Te","I","Xe","Cs","Ba","La","Ce","Pr","Nd","Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu","Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg","Tl","Pb","Bi","Po","At","Rn","Fr","Ra","Ac","Th","Pa","U","Np","Pu","Am","Cm","Bk","Cf","Es","Fm","Md","No","Lr","Rf","Db","Sg","Bh","Hs","Mt","Ds","Rg","Cn","Nh","Fl","Mc","Lv","Ts","Og",
] as const;

const NAMES = [
  "Hydrogen","Helium","Lithium","Beryllium","Boron","Carbon","Nitrogen","Oxygen","Fluorine","Neon","Sodium","Magnesium","Aluminium","Silicon","Phosphorus","Sulfur","Chlorine","Argon","Potassium","Calcium","Scandium","Titanium","Vanadium","Chromium","Manganese","Iron","Cobalt","Nickel","Copper","Zinc","Gallium","Germanium","Arsenic","Selenium","Bromine","Krypton","Rubidium","Strontium","Yttrium","Zirconium","Niobium","Molybdenum","Technetium","Ruthenium","Rhodium","Palladium","Silver","Cadmium","Indium","Tin","Antimony","Tellurium","Iodine","Xenon","Cesium","Barium","Lanthanum","Cerium","Praseodymium","Neodymium","Promethium","Samarium","Europium","Gadolinium","Terbium","Dysprosium","Holmium","Erbium","Thulium","Ytterbium","Lutetium","Hafnium","Tantalum","Tungsten","Rhenium","Osmium","Iridium","Platinum","Gold","Mercury","Thallium","Lead","Bismuth","Polonium","Astatine","Radon","Francium","Radium","Actinium","Thorium","Protactinium","Uranium","Neptunium","Plutonium","Americium","Curium","Berkelium","Californium","Einsteinium","Fermium","Mendelevium","Nobelium","Lawrencium","Rutherfordium","Dubnium","Seaborgium","Bohrium","Hassium","Meitnerium","Darmstadtium","Roentgenium","Copernicium","Nihonium","Flerovium","Moscovium","Livermorium","Tennessine","Oganesson",
] as const;

function inferGroup(n: number): string {
  if ([3, 11, 19, 37, 55, 87].includes(n)) return "alkali-metal";
  if ([4, 12, 20, 38, 56, 88].includes(n)) return "alkaline-earth";
  if ([2, 10, 18, 36, 54, 86, 118].includes(n)) return "noble-gas";
  if ([9, 17, 35, 53, 85, 117].includes(n)) return "halogen";
  if (n >= 57 && n <= 71) return "lanthanide";
  if (n >= 89 && n <= 103) return "actinide";
  if ([1, 6, 7, 8, 15, 16, 34].includes(n)) return "nonmetal";
  if ([5, 14, 32, 33, 51, 52, 84].includes(n)) return "metalloid";
  if ((n >= 21 && n <= 30) || (n >= 39 && n <= 48) || (n >= 72 && n <= 80) || (n >= 104 && n <= 112)) return "transition-metal";
  return "post-transition";
}

const GROUP_COLORS: Record<string, string> = {
  "alkali-metal": "bg-rose-700",
  "alkaline-earth": "bg-amber-700",
  "noble-gas": "bg-sky-700",
  "halogen": "bg-lime-700",
  lanthanide: "bg-violet-700",
  actinide: "bg-fuchsia-700",
  nonmetal: "bg-emerald-700",
  metalloid: "bg-cyan-700",
  "transition-metal": "bg-indigo-700",
  "post-transition": "bg-slate-700",
};

const ELEMENTS: Element[] = SYMBOLS.map((symbol, index) => {
  const number = index + 1;
  const period = number <= 2 ? 1 : number <= 10 ? 2 : number <= 18 ? 3 : number <= 36 ? 4 : number <= 54 ? 5 : number <= 86 ? 6 : 7;
  return {
    number,
    symbol,
    name: NAMES[index],
    mass: Math.round((number * 1.7 + 1) * 1000) / 1000,
    group: inferGroup(number),
    period,
  };
});

export default function PeriodicTable({ onClose }: PeriodicTableProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Element | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ELEMENTS;
    return ELEMENTS.filter((element) => element.name.toLowerCase().includes(q) || element.symbol.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Periodic Table (118 elements)</h3>
        <button type="button" aria-label="Close periodic table" className="rounded border border-slate-600 px-2 py-1" onClick={() => onClose?.()}>Close</button>
      </div>

      <input
        aria-label="Search elements"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or symbol"
        className="w-full rounded bg-slate-900 p-2"
      />

      <div className="max-h-[42vh] overflow-auto rounded border border-slate-700 p-2">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 md:grid-cols-14">
          {filtered.map((element) => (
            <button
              key={element.number}
              type="button"
              aria-label={`Element ${element.name}`}
              className={`rounded p-2 text-left ${GROUP_COLORS[element.group] ?? "bg-slate-700"}`}
              onClick={() => setSelected(element)}
            >
              <p className="text-[10px] opacity-80">{element.number}</p>
              <p className="text-sm font-semibold">{element.symbol}</p>
            </button>
          ))}
        </div>
      </div>

      <aside className="rounded bg-slate-900 p-3">
        {selected ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{selected.name} ({selected.symbol})</p>
            <p>Atomic Number: {selected.number}</p>
            <p>Atomic Mass: {selected.mass}</p>
            <p>Group: {selected.group}</p>
            <p>Period: {selected.period}</p>
          </div>
        ) : (
          <p>Select an element to view details.</p>
        )}
      </aside>
    </div>
  );
}
