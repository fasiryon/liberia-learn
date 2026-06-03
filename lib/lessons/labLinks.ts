import type { LabId } from "@/lib/labs/types";

export type LessonLabLink = {
  labId: LabId;
  label: string;
};

export function getLessonLabLinks(input: {
  subject: string;
  grade: number;
}): LessonLabLink[] {
  const subject = input.subject.toLowerCase();
  const labs: LessonLabLink[] = [];

  if (input.grade >= 7 && input.grade <= 9 && subject.includes("physics")) {
    labs.push(
      { labId: "gravity-explorer", label: "Open Gravity Lab" },
      { labId: "pendulum-lab", label: "Open Pendulum Lab" }
    );
  }
  if (input.grade >= 9 && input.grade <= 11 && subject.includes("physics")) {
    labs.push({ labId: "electric-circuit", label: "Open Circuit Lab" });
  }
  if (input.grade >= 10 && input.grade <= 12 && subject.includes("physics")) {
    labs.push({ labId: "wave-motion", label: "Open Wave Lab" });
  }
  if (input.grade >= 9 && input.grade <= 11 && subject.includes("chemistry")) {
    labs.push({ labId: "molecule-motion", label: "Open Molecule Lab" });
  }
  if (input.grade >= 10 && input.grade <= 12 && subject.includes("chemistry")) {
    labs.push({ labId: "chemical-reaction", label: "Open Reaction Lab" });
  }
  if (input.grade >= 9 && input.grade <= 12 && subject.includes("chemistry")) {
    labs.push({ labId: "periodic-table", label: "Open Periodic Table Lab" });
  }
  if (input.grade >= 8 && input.grade <= 10 && subject.includes("biology")) {
    labs.push({ labId: "human-heart", label: "Open Heart Lab" });
  }
  if (input.grade >= 9 && input.grade <= 11 && subject.includes("biology")) {
    labs.push({ labId: "cell-division", label: "Open Cell Division Lab" });
  }
  if (input.grade >= 7 && input.grade <= 9 && subject.includes("biology")) {
    labs.push({ labId: "ecosystem-balance", label: "Open Ecosystem Lab" });
  }
  if (input.grade >= 7 && input.grade <= 9 && subject.includes("earth science")) {
    labs.push({ labId: "weather-system", label: "Open Weather Lab" });
  }
  if (input.grade >= 8 && input.grade <= 10 && subject.includes("earth science")) {
    labs.push({ labId: "tectonic-plates", label: "Open Tectonic Plates Lab" });
  }

  // General "SCIENCE" subject (used by hero lessons and bulk generation):
  // Route to the most relevant lab by grade band.
  if (subject === "science") {
    if (input.grade >= 5 && input.grade <= 7) {
      labs.push({ labId: "ecosystem-balance", label: "Open Ecosystem Lab" });
    }
    if (input.grade >= 7 && input.grade <= 9) {
      labs.push({ labId: "weather-system", label: "Open Weather Lab" });
    }
    if (input.grade >= 8 && input.grade <= 10) {
      labs.push({ labId: "human-heart", label: "Open Biology Lab" });
      labs.push({ labId: "cell-division", label: "Open Cell Division Lab" });
    }
    if (input.grade >= 9 && input.grade <= 12) {
      labs.push({ labId: "molecule-motion", label: "Open Chemistry Lab" });
      labs.push({ labId: "periodic-table", label: "Open Periodic Table Lab" });
    }
  }

  return labs;
}
