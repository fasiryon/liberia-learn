import Link from "next/link";
import { BookOpen, CalendarCheck, FlaskConical, LifeBuoy, TrendingUp } from "lucide-react";
import { STUDENT_PRIMARY_NAV, type PrimaryDestination } from "@/lib/learner-experience/studentNavigation";

const ICONS: Record<PrimaryDestination, typeof BookOpen> = { TODAY: CalendarCheck, LEARN: BookOpen, LABS: FlaskConical, PROGRESS: TrendingUp, HELP: LifeBuoy };

/**
 * Product Redesign V1 primary navigation: Today | Learn | Labs | Progress | Help.
 * A bottom bar on phones, a top bar on wider screens. Focused lesson and lab
 * players hide it and keep their own way back.
 */
export function StudentPrimaryNav({ active }: { active: PrimaryDestination | null }) {
  return (
    <>
      <nav aria-label="Student" className="hidden border-b border-[var(--ll-border)] sm:block">
        <ul className="mx-auto flex max-w-6xl gap-1 px-4">
          {STUDENT_PRIMARY_NAV.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <li key={item.id}>
                <Link href={item.href} aria-current={active === item.id ? "page" : undefined} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active === item.id ? "border-[var(--ll-accent)] text-[var(--ll-text)]" : "border-transparent text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"}`}>
                  <Icon size={16} aria-hidden="true" />{item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label="Student" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ll-border)] bg-[var(--ll-bg)] sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <ul className="grid grid-cols-5">
          {STUDENT_PRIMARY_NAV.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <li key={item.id}>
                <Link href={item.href} aria-current={active === item.id ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active === item.id ? "text-[var(--ll-accent)]" : "text-[var(--ll-text-muted)]"}`}>
                  <Icon size={20} aria-hidden="true" />{item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
