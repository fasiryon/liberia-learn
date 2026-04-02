"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const TEACHER_WELCOME_KEY = "teacher_has_seen_welcome";

export function TeacherWelcomeGate({
  needsWelcome,
}: {
  needsWelcome: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!needsWelcome || pathname === "/teacher/welcome") return;
    if (typeof window === "undefined") return;
    const hasSeenWelcome = window.localStorage.getItem(TEACHER_WELCOME_KEY);
    if (!hasSeenWelcome) {
      router.replace("/teacher/welcome");
    }
  }, [needsWelcome, pathname, router]);

  return null;
}

export const teacherWelcomeStorageKey = TEACHER_WELCOME_KEY;
