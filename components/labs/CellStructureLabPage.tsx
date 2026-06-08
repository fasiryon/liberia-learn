"use client";

import { useState } from "react";

type Organelle = {
  id: string;
  label: string;
  color: string;
  x: number; // % of svg
  y: number;
  rx: number;
  ry: number;
  description: string;
};

const ORGANELLES: Organelle[] = [
  { id: "nucleus",       label: "Nucleus",          color: "#4f46e5", x: 50, y: 48, rx: 10, ry: 9,  description: "The control centre of the cell. Contains DNA (chromosomes) that carry genetic instructions for all cell functions and heredity." },
  { id: "nucleolus",     label: "Nucleolus",         color: "#7c3aed", x: 50, y: 47, rx: 4,  ry: 3.5, description: "Found inside the nucleus. Makes ribosomes and is involved in producing proteins for the cell." },
  { id: "mitochondria",  label: "Mitochondria",      color: "#ea580c", x: 72, y: 38, rx: 7,  ry: 4,  description: "The powerhouse of the cell. Produces ATP (adenosine triphosphate) energy through cellular respiration: glucose + oxygen → energy + CO₂ + H₂O." },
  { id: "er-rough",      label: "Rough ER",          color: "#0891b2", x: 36, y: 35, rx: 8,  ry: 4,  description: "Endoplasmic reticulum studded with ribosomes. Makes and transports proteins destined for secretion or use in the cell membrane." },
  { id: "er-smooth",     label: "Smooth ER",         color: "#0e7490", x: 28, y: 48, rx: 7,  ry: 3,  description: "Endoplasmic reticulum without ribosomes. Synthesises lipids and detoxifies chemicals. Important in liver and muscle cells." },
  { id: "golgi",         label: "Golgi Apparatus",   color: "#d97706", x: 65, y: 60, rx: 9,  ry: 4,  description: "The postal system of the cell. Packages and modifies proteins from the ER, then ships them to their destinations inside or outside the cell." },
  { id: "lysosome",      label: "Lysosome",          color: "#dc2626", x: 78, y: 60, rx: 4,  ry: 4,  description: "Contains digestive enzymes. Breaks down waste materials, cellular debris, and foreign invaders (bacteria). Crucial for cell recycling." },
  { id: "vacuole",       label: "Vacuole",           color: "#16a34a", x: 42, y: 65, rx: 7,  ry: 6,  description: "Stores water, nutrients, and waste. In plant cells this is very large and maintains cell pressure (turgor). In animal cells it is smaller." },
  { id: "ribosome",      label: "Ribosome",          color: "#92400e", x: 58, y: 35, rx: 2,  ry: 2,  description: "Tiny machines that read mRNA and assemble amino acids into proteins. Found free in cytoplasm or attached to rough ER. Every living cell has them." },
  { id: "centriole",     label: "Centriole",         color: "#9333ea", x: 25, y: 62, rx: 3,  ry: 5,  description: "Organises the cell's spindle fibres during division. Present in animal cells; helps chromosomes separate correctly during mitosis/meiosis." },
  { id: "membrane",      label: "Cell Membrane",     color: "#15803d", x: 50, y: 50, rx: 43, ry: 38, description: "A selectively permeable phospholipid bilayer surrounding the cell. Controls what enters and exits: nutrients in, waste out. Maintains cell shape." },
];

export default function CellStructureLabPage() {
  const [active, setActive] = useState<Organelle | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showPlant, setShowPlant] = useState(false);

  return (
    <section className="space-y-4 p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-[var(--ll-text)]">Animal Cell</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showPlant} onChange={(e) => setShowPlant(e.target.checked)}
            className="h-4 w-4 accent-green-500" />
          <span className="text-sm text-[var(--ll-text)]">Show plant cell features</span>
        </label>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[#08111f]">
        <svg viewBox="0 0 100 100" className="h-auto w-full" style={{ maxHeight: 320 }}>
          {/* Cytoplasm */}
          <ellipse cx="50" cy="50" rx="43" ry="38" fill="rgba(14,116,144,0.08)" />

          {/* Plant cell wall */}
          {showPlant && (
            <ellipse cx="50" cy="50" rx="46" ry="41"
              fill="none" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="2,1.5" opacity={0.6} />
          )}

          {/* Plant chloroplast */}
          {showPlant && (
            <ellipse cx="22" cy="36" rx="6" ry="3.5" fill="#15803d" opacity={0.8}
              className="cursor-pointer" onClick={() => setActive({ id: "chloroplast", label: "Chloroplast", color: "#15803d", x: 22, y: 36, rx: 6, ry: 3.5, description: "Found only in plant cells. Contains chlorophyll (green pigment) and performs photosynthesis: CO₂ + H₂O + light energy → glucose + oxygen. Turns sunlight into food." })} />
          )}

          {ORGANELLES.map((o) => {
            const isActive = active?.id === o.id;
            const isHovered = hovered === o.id;
            if (o.id === "membrane") return (
              <ellipse key={o.id} cx={o.x} cy={o.y} rx={o.rx} ry={o.ry}
                fill="none" stroke={isActive || isHovered ? "#22d3ee" : o.color}
                strokeWidth={isActive ? 1.5 : 0.8} opacity={0.6}
                className="cursor-pointer"
                onClick={() => setActive(active?.id === o.id ? null : o)}
                onMouseEnter={() => setHovered(o.id)} onMouseLeave={() => setHovered(null)} />
            );
            return (
              <ellipse key={o.id} cx={o.x} cy={o.y} rx={o.rx} ry={o.ry}
                fill={o.color}
                fillOpacity={isActive ? 1 : isHovered ? 0.85 : 0.7}
                stroke={isActive || isHovered ? "#fff" : "transparent"}
                strokeWidth={isActive ? 0.8 : 0.4}
                className="cursor-pointer transition-opacity"
                onClick={() => setActive(active?.id === o.id ? null : o)}
                onMouseEnter={() => setHovered(o.id)} onMouseLeave={() => setHovered(null)} />
            );
          })}

          {/* Labels on hover */}
          {hovered && (() => {
            const o = ORGANELLES.find((x) => x.id === hovered);
            if (!o || o.id === "membrane") return null;
            return (
              <text x={o.x} y={o.y - o.ry - 1.5} textAnchor="middle"
                fill="white" fontSize="3" fontWeight="600" pointerEvents="none">
                {o.label}
              </text>
            );
          })()}
        </svg>
      </div>

      {active ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full" style={{ background: active.color }} />
            <div>
              <p className="font-semibold text-[var(--ll-text)]">{active.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ll-text-muted)]">{active.description}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--ll-text-faint)]">
          Click any organelle to learn about its function. Hover to see labels.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {ORGANELLES.filter((o) => o.id !== "membrane").map((o) => (
          <button key={o.id} type="button"
            onClick={() => setActive(active?.id === o.id ? null : o)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${active?.id === o.id ? "text-white" : "text-[var(--ll-text-faint)] opacity-70 hover:opacity-100"}`}
            style={{ background: active?.id === o.id ? o.color : `${o.color}33` }}>
            {o.label}
          </button>
        ))}
        {showPlant && (
          <button type="button"
            onClick={() => setActive({ id: "chloroplast", label: "Chloroplast", color: "#15803d", x: 22, y: 36, rx: 6, ry: 3.5, description: "Found only in plant cells. Contains chlorophyll and performs photosynthesis." })}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ background: "#15803d" }}>
            Chloroplast
          </button>
        )}
      </div>
    </section>
  );
}
