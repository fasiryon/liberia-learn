"use client";

import { StudentJourney } from "./StudentJourney";
import { RoleTour } from "./RoleTour";

export function StudentTourMount({ showTour }: { showTour: boolean }) {
  // Always mounted so the multi-page journey can also activate on ?tour=true
  // (e.g. a replay link handed to principals). It self-gates on `active`.
  return <StudentJourney autoStart={showTour} />;
}

// Role tours are always mounted too, so ?tour=true re-triggers them even after
// the first-login auto-start has completed. Each self-gates inside RoleTour.
export function TeacherTourMount({ showTour }: { showTour: boolean }) {
  return <RoleTour role="teacher" autoStart={showTour} />;
}

export function GuardianTourMount({ showTour }: { showTour: boolean }) {
  return <RoleTour role="guardian" autoStart={showTour} />;
}

export function AdminTourMount({ showTour }: { showTour: boolean }) {
  return <RoleTour role="admin" autoStart={showTour} />;
}

export function OfficialTourMount({ showTour }: { showTour: boolean }) {
  return <RoleTour role="official" autoStart={showTour} />;
}
