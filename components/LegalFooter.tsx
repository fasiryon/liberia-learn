import Link from "next/link";

export const legalFooterLinks = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Data Policy for Minors", href: "/legal/data-for-minors" },
  { label: "Contact", href: "/contact" },
];

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-white/5 bg-slate-950/80 py-5 ${className}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} LiberiaLearn - Republic of Liberia
        </p>
        <nav aria-label="Legal links" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {legalFooterLinks.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-xs leading-5 text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
