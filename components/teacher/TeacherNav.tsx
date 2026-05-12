"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/teacher", label: "Overview" },
  { href: "/teacher/homework", label: "Homework" },
  { href: "/teacher/curriculum", label: "Curriculum" },
  { href: "/teacher/messages", label: "Messages", badgeKey: "messages" },
  { href: "/teacher/delivery-report", label: "Delivery Report" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/schedule", label: "Schedule" },
  { href: "/teacher/labs", label: "Labs" },
  { href: "/teacher/events", label: "Events" },
  { href: "/teacher/exams", label: "Exams" },
  { href: "/teacher/assignments", label: "Assignments" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/intelligence", label: "Intelligence" },
  { href: "/teacher/placements", label: "Placements" },
];

type MessageSummary = { read: boolean; fromRole: "guardian" | "teacher" };

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-[var(--ll-yellow)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ll-text-faint)]">
      {count}
    </span>
  );
}

export function TeacherNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/guardian/messages", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((messages: MessageSummary[]) => {
        if (!active || !Array.isArray(messages)) return;
        setUnreadCount(
          messages.filter((message) => !message.read && message.fromRole === "guardian").length
        );
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-[var(--ll-border)] pb-4">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || (link.href !== "/teacher" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]"
                : "border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            }`}
          >
            <span>{link.label}</span>
            {link.badgeKey === "messages" ? <Badge count={unreadCount} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
