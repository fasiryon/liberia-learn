"use client";

import { AccessibilityToggle } from "@/components/AccessibilityToggle";

export function StudentAccessibilityControl() {
  return (
    <div
      className="fixed bottom-24 right-3 z-40 sm:bottom-5 sm:right-5"
      aria-label="Student accessibility controls"
    >
      <AccessibilityToggle />
    </div>
  );
}
