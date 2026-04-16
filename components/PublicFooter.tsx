/**
 * components/PublicFooter.tsx
 *
 * Shared footer for all public-facing pages (homepage, login).
 * Shows legal links at a minimum.
 * Mobile-safe at 375 px — uses flex-wrap so links stack cleanly.
 */
import Link from "next/link";

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Data Policy for Minors", href: "/data-policy" },
  { label: "Contact", href: "/contact" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950/80 py-6">
      <div className="ll-shell flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} LiberiaLearn &mdash; Ministry of Education, Republic of Liberia
        </p>

        <nav aria-label="Legal links" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {legalLinks.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-xs text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
