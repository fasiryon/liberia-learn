"use client";

import { useState } from "react";
import { PrivacyGate } from "./PrivacyGate";

export function PrivacyGateMount({ showGate }: { showGate: boolean }) {
  const [show, setShow] = useState(showGate);
  if (!show) return null;
  return <PrivacyGate onAccepted={() => setShow(false)} />;
}
