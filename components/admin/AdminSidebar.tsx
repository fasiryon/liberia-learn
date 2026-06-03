"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";

const IS_DEV = process.env.NODE_ENV !== "production";

type NavItem = { label: string; href: string };
type NavSection = {
  section: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  items: NavItem[];
};

const NAV: NavSection[] = [
  {
    section: "SCHOOL",
    items: [
      { label: "Students", href: "/admin/students" },
      { label: "Teachers", href: "/admin/teachers" },
      { label: "Classes", href: "/admin/classes" },
      { label: "Enrollments", href: "/admin/enrollment" },
      { label: "Timetable", href: "/admin/timetable" },
      { label: "Events", href: "/admin/events" },
    ],
  },
  {
    section: "CURRICULUM",
    items: [
      { label: "Curriculum Factory", href: "/admin/curriculum" },
      { label: "Content Review", href: "/admin/content-review" },
      { label: "Homework", href: "/admin/homework" },
      { label: "Exams", href: "/admin/exams" },
    ],
  },
  {
    section: "COMMUNICATIONS",
    items: [
      { label: "Notifications", href: "/admin/notifications" },
      { label: "Guardian Links", href: "/admin/guardian-link" },
      { label: "Onboarding", href: "/admin/onboarding" },
      { label: "MOE Submissions", href: "/admin/moe-submissions" },
    ],
  },
  {
    section: "ANALYTICS",
    items: [
      { label: "Analytics", href: "/admin/analytics" },
      { label: "AI Costs", href: "/admin/ai-costs" },
      { label: "Reports", href: "/admin/reports" },
      { label: "Audit Log", href: "/admin/audit" },
      { label: "Compliance", href: "/admin/compliance" },
      { label: "Pilot Score", href: "/admin/pilot-score" },
    ],
  },
  {
    section: "SETTINGS",
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { label: "School Settings", href: "/admin/school-settings" },
      { label: "School Branding", href: "/admin/school-branding" },
      { label: "Schools", href: "/admin/schools" },
      { label: "Canva", href: "/admin/settings/canva" },
      ...(IS_DEV ? [{ label: "Seed Demo Data", href: "/admin/seed" }] : []),
    ],
  },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of NAV) {
      if (s.collapsible && s.defaultCollapsed) init[s.section] = true;
    }
    return init;
  });

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--ll-border)]">
        <Link
          href="/admin"
          onClick={onClose}
          className={`text-sm font-bold rounded-md px-2 py-1 transition-colors ${
            pathname === "/admin"
              ? "text-[var(--ll-yellow)]"
              : "text-[var(--ll-text)] hover:text-[var(--ll-yellow)]"
          }`}
        >
          Dashboard
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV.map((section) => {
          const isCollapsed = !!collapsed[section.section];
          const visibleItems = section.collapsible && isCollapsed ? [] : section.items;

          return (
            <div key={section.section}>
              <button
                className="w-full flex items-center justify-between px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)] transition-colors"
                onClick={() =>
                  section.collapsible &&
                  setCollapsed((prev) => ({
                    ...prev,
                    [section.section]: !prev[section.section],
                  }))
                }
                style={{ cursor: section.collapsible ? "pointer" : "default" }}
              >
                <span>{section.section}</span>
                {section.collapsible &&
                  (isCollapsed ? (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ))}
              </button>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                        isActive(item.href)
                          ? "bg-[var(--ll-yellow)] text-[#1a1200] font-semibold"
                          : "text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface)] hover:text-[var(--ll-text)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger — top-right to avoid clashing with DashboardTopBar branding */}
      <button
        className="fixed top-3 right-3 z-50 md:hidden p-2 rounded-md bg-[var(--ll-surface)] border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 z-50 bg-[var(--ll-bg)] border-r border-[var(--ll-border)] transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar — sticky, 240px wide */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 sticky top-0 h-screen border-r border-[var(--ll-border)] bg-[var(--ll-bg)]">
        <SidebarContent />
      </aside>
    </>
  );
}
