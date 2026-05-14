"use client";

import Link from "next/link";

const BASE_NAV_LINKS = [
  { label: "Curriculum / AI Factory", href: "/admin/curriculum" },
  { label: "Curriculum Units", href: "/admin/curriculum/units" },
  { label: "Homework", href: "/admin/homework" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Product Metrics", href: "/admin/metrics" },
  { label: "AI Costs", href: "/admin/ai-costs" },
  { label: "Guardian Links", href: "/admin/guardian-link" },
  { label: "Classes", href: "/admin/classes" },
  { label: "Students", href: "/admin/students" },
  { label: "Academic Years", href: "/admin/academic-year" },
  { label: "Enrollments", href: "/admin/enrollment" },
  { label: "Exams", href: "/admin/exams" },
  { label: "Timetable", href: "/admin/timetable" },
  { label: "Teacher Assignments", href: "/admin/assignments" },
  { label: "Teachers", href: "/admin/teachers" },
  { label: "Placements", href: "/admin/placements" },
  { label: "School Branding", href: "/admin/school-branding" },
  { label: "School Settings", href: "/admin/school-settings" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Pilot Score", href: "/admin/pilot-score" },
  { label: "Onboarding", href: "/admin/onboarding" },
  { label: "Audit Log", href: "/admin/audit" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "Data Downloads", href: "/admin/governance/exports" },
  { label: "Communications", href: "/admin/communications" },
  { label: "Seed Demo Data", href: "/admin/seed" },
  { label: "Schools", href: "/admin/schools" },
];

export function AdminNav() {
  const trainingEnabled = process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER === "true";
  const navLinks = trainingEnabled
    ? [...BASE_NAV_LINKS, { label: "Training Adoption", href: "/admin/training/adoption" }]
    : BASE_NAV_LINKS;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-[var(--ll-border)] pb-3">
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-1.5 text-xs font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)] hover:bg-[var(--ll-surface)]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
