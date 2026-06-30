"use client";

import { useState } from "react";
import { TeacherTour } from "./TeacherTour";
import { StudentJourney } from "./StudentJourney";
import { GuardianTour } from "./GuardianTour";

async function markTourComplete() {
  await fetch("/api/user/tour-complete", { method: "PATCH" });
}

export function TeacherTourMount({ showTour }: { showTour: boolean }) {
  const [show, setShow] = useState(showTour);
  if (!show) return null;
  return <TeacherTour onComplete={() => { setShow(false); void markTourComplete(); }} />;
}

export function StudentTourMount({ showTour }: { showTour: boolean }) {
  // Always mounted so the multi-page journey can also activate on ?tour=true
  // (e.g. a replay link handed to principals). It self-gates on `active`.
  return <StudentJourney autoStart={showTour} />;
}

export function GuardianTourMount({ showTour }: { showTour: boolean }) {
  const [show, setShow] = useState(showTour);
  if (!show) return null;
  return <GuardianTour onComplete={() => { setShow(false); void markTourComplete(); }} />;
}
