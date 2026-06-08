"use client";

import { useEffect } from "react";
import CellDivisionLabPage from "@/components/labs/CellDivisionLabPage";
import CellStructureLabPage from "@/components/labs/CellStructureLabPage";
import ChemicalReactionLabPage from "@/components/labs/ChemicalReactionLabPage";
import EarthquakeWavesLabPage from "@/components/labs/EarthquakeWavesLabPage";
import EcosystemBalanceLabPage from "@/components/labs/EcosystemBalanceLabPage";
import GravityLabPage from "@/components/labs/GravityLabPage";
import ElectricCircuitLabPage from "@/components/labs/ElectricCircuitLabPage";
import HumanHeartLabPage from "@/components/labs/HumanHeartLabPage";
import LightAndShadowLabPage from "@/components/labs/LightAndShadowLabPage";
import MoleculeMotionLabPage from "@/components/labs/MoleculeMotionLabPage";
import PendulumLabPage from "@/components/labs/PendulumLabPage";
import PeriodicTableLabPage from "@/components/labs/PeriodicTableLabPage";
import SimpleMachinesLabPage from "@/components/labs/SimpleMachinesLabPage";
import TectonicPlatesLabPage from "@/components/labs/TectonicPlatesLabPage";
import WaterCycleLabPage from "@/components/labs/WaterCycleLabPage";
import WeatherSystemLabPage from "@/components/labs/WeatherSystemLabPage";
import WaveMotionLabPage from "@/components/labs/WaveMotionLabPage";
import type { LabId } from "@/lib/labs/types";

const LAB_META: Partial<Record<LabId, { title: string; subject: string }>> = {
  "gravity-explorer":  { title: "Gravity Explorer",         subject: "Physics Lab" },
  "pendulum-lab":      { title: "Pendulum Lab",              subject: "Physics Lab" },
  "electric-circuit":  { title: "Electric Circuit Builder",  subject: "Physics Lab" },
  "electric-circuits": { title: "Electric Circuits Lab",     subject: "Physics Lab" },
  "wave-motion":       { title: "Wave Motion Lab",           subject: "Physics Lab" },
  "molecule-motion":   { title: "Molecule Motion Lab",       subject: "Chemistry Lab" },
  "chemical-reaction": { title: "Chemical Reaction Lab",     subject: "Chemistry Lab" },
  "chemical-reactions":{ title: "Chemical Reactions Lab",    subject: "Chemistry Lab" },
  "periodic-table":    { title: "Periodic Table Explorer",   subject: "Chemistry Lab" },
  "weather-system":    { title: "Weather System Lab",        subject: "Earth Science Lab" },
  "tectonic-plates":   { title: "Tectonic Plates Lab",       subject: "Earth Science Lab" },
  "earthquake-waves":  { title: "Earthquake Waves Lab",      subject: "Earth Science Lab" },
  "human-heart":       { title: "Human Heart Simulator",     subject: "Biology Lab" },
  "cell-division":     { title: "Cell Division Explorer",    subject: "Biology Lab" },
  "cell-structure":    { title: "Cell Structure Lab",        subject: "Biology Lab" },
  "ecosystem-balance": { title: "Ecosystem Balance Lab",     subject: "Biology Lab" },
  "water-cycle":       { title: "Water Cycle Lab",           subject: "Earth Science Lab" },
  "light-and-shadow":  { title: "Light & Shadow Lab",        subject: "Physics Lab" },
  "simple-machines":   { title: "Simple Machines Lab",       subject: "Physics Lab" },
};

function LabContent({ labId, lessonId }: { labId: LabId; lessonId: string }) {
  if (labId === "gravity-explorer")   return <GravityLabPage lessonId={lessonId} />;
  if (labId === "pendulum-lab")       return <PendulumLabPage lessonId={lessonId} />;
  if (labId === "electric-circuit")   return <ElectricCircuitLabPage lessonId={lessonId} />;
  if (labId === "electric-circuits")  return <ElectricCircuitLabPage lessonId={lessonId} />;
  if (labId === "wave-motion")        return <WaveMotionLabPage lessonId={lessonId} />;
  if (labId === "molecule-motion")    return <MoleculeMotionLabPage lessonId={lessonId} />;
  if (labId === "chemical-reaction")  return <ChemicalReactionLabPage lessonId={lessonId} />;
  if (labId === "chemical-reactions") return <ChemicalReactionLabPage lessonId={lessonId} />;
  if (labId === "periodic-table")     return <PeriodicTableLabPage lessonId={lessonId} />;
  if (labId === "weather-system")     return <WeatherSystemLabPage lessonId={lessonId} />;
  if (labId === "tectonic-plates")    return <TectonicPlatesLabPage lessonId={lessonId} />;
  if (labId === "human-heart")        return <HumanHeartLabPage lessonId={lessonId} />;
  if (labId === "cell-division")      return <CellDivisionLabPage lessonId={lessonId} />;
  if (labId === "cell-structure")     return <CellStructureLabPage />;
  if (labId === "ecosystem-balance")  return <EcosystemBalanceLabPage lessonId={lessonId} />;
  if (labId === "water-cycle")        return <WaterCycleLabPage />;
  if (labId === "light-and-shadow")   return <LightAndShadowLabPage />;
  if (labId === "simple-machines")    return <SimpleMachinesLabPage />;
  if (labId === "earthquake-waves")   return <EarthquakeWavesLabPage />;
  return null;
}

export default function LessonLabPanel({
  open,
  onClose,
  labId,
  lessonId,
}: {
  open: boolean;
  onClose: () => void;
  labId: LabId | null;
  lessonId: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !labId) return null;

  const meta = LAB_META[labId] ?? { title: "Lab", subject: "Learning Lab" };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ll-bg)]/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close ${meta.title}`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[2rem] border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] shadow-none shadow-black/50 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[min(58rem,92vw)] sm:rounded-none sm:rounded-l-[2rem]">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--ll-border)] px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-silver)]">
              {meta.subject}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ll-text)]">{meta.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] transition-colors hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          <LabContent labId={labId} lessonId={lessonId} />
        </div>
      </section>
    </div>
  );
}
