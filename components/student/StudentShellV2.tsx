"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudentPrimaryNav } from "@/components/learner-experience/StudentPrimaryNav";
import { activeDestination, type PrimaryDestination } from "@/lib/learner-experience/studentNavigation";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";

export type StudentIdentity = { name: string; grade: number | null; userId: string; schoolId: string | null };
const Identity = createContext<StudentIdentity>({ name: "Learner", grade: null, userId: "", schoolId: null });
export const useStudentIdentity = () => useContext(Identity);
export function StudentOptionalPrompts({ children }: { children: ReactNode }) {
  const path = usePathname();
  return path === "/student/today" || path === "/student/learn" ? null : <>{children}</>;
}

const LINKS: Record<PrimaryDestination, Array<[string, string]>> = {
  TODAY: [["Assignments", "/student/assignments"], ["Homework", "/student/homework"], ["Calendar", "/student/events"]],
  LEARN: [["Assignments", "/student/assignments"], ["Lessons", "/student/lessons"], ["Practice", "/student/adaptive"], ["Exams", "/student/exams"], ["Textbooks", "/student/textbooks"], ["Projects", "/student/capstone"]],
  LABS: [],
  PROGRESS: [["Portfolio", "/student/portfolio"], ["Passport", "/student/passport"], ["Certificates", "/student/certificates"], ["Certifications", "/student/certifications"], ["Report cards", "/student/report-cards"], ["Transcript", "/student/transcript"], ["Leaderboard", "/student/leaderboard"]],
  HELP: [["Messages", "/student/messages"], ["Discussion", "/student/discussion"], ["Student guide", "/help/student"], ["Offline lessons", "/student/offline-lessons"], ["Downloads", "/student/packs"], ["Sync status", "/student/offline-status"]],
};

/** Existing safe-logout page: syncs or warns about unsynced work before NextAuth sign-out. */
export const SIGN_OUT_HREF = "/signout";

export function isFocusedStudentRoute(path: string) {
  return /^\/student\/(?:lesson|lessons|labs|interactive-labs)\/[^/]+/.test(path);
}

export function StudentShellV2({ identity, children, utilities }: { identity: StudentIdentity; children: ReactNode; utilities?: ReactNode }) {
  const path = usePathname() ?? "";
  const active = activeDestination(path);
  const focused = isFocusedStudentRoute(path);
  const age = identity.grade != null && identity.grade >= 1 && identity.grade <= 3 ? "young" : "middle";
  return <Identity.Provider value={identity}>
    <div className={`pdv2 ${focused ? "pdv2-focused" : "pdv2-shell"}`} data-age-band={age}>
      {!focused && <>
        <a className="pdv2-skip" href="#student-content">Skip to learning</a>
        <aside className="pdv2-rail">
          <Link className="pdv2-brand" href="/student/today"><span aria-hidden="true" />LiberiaLearn</Link>
          <p className="pdv2-eyebrow">Student{identity.grade != null ? ` · Grade ${identity.grade}` : ""}</p>
          <p className="pdv2-name">{identity.name}</p>
          <StudentPrimaryNav active={active} variant="rail" />
          <details className="pdv2-account-menu"><summary>Account</summary><div>
            <a className="pdv2-action pdv2-action-quiet" href={SIGN_OUT_HREF}>Sign out</a>
            <InteractiveButton href="/student/change-pin">Change PIN →</InteractiveButton>
          </div></details>
          <div className="pdv2-rail-support"><InteractiveButton href="/student/offline-lessons">Offline content →</InteractiveButton><LanguageSelector compact />
            <div className="pdv2-rail-account"><a className="pdv2-action pdv2-action-quiet" href={SIGN_OUT_HREF}>Sign out</a></div>
          </div>
        </aside>
      </>}
      <div className="pdv2-body" id="student-content" tabIndex={-1}>
        {children}
        {!focused && active && LINKS[active].length > 0 && path !== "/student/learn" && <nav className="pdv2-secondary" aria-label={`${active.toLowerCase()} resources`}>
          <h2>{active === "TODAY" ? "Dates and assigned work" : active === "HELP" ? "Support and communication" : active === "PROGRESS" ? "Your records" : "Learning resources"}</h2>
          <div>{LINKS[active].map(([label, href]) => <InteractiveButton key={href} href={href}>{label} →</InteractiveButton>)}
            {active === "LEARN" && identity.grade != null && identity.grade >= WAEC_MIN_GRADE && <InteractiveButton href="/student/waec">WAEC Prep →</InteractiveButton>}
          </div>
        </nav>}
        {!focused && <details className="pdv2-secondary"><summary>Account and preferences</summary><div>
          <LanguageSelector compact />
          <InteractiveButton href="/student/change-pin">Change PIN →</InteractiveButton>
          <InteractiveButton href="/student/placement">Placement →</InteractiveButton>
          <InteractiveButton href="/student/onboarding">Getting started →</InteractiveButton>
          <a className="pdv2-action pdv2-action-quiet" href={SIGN_OUT_HREF}>Sign out</a>
        </div></details>}
        {utilities}
      </div>
    </div>
  </Identity.Provider>;
}
