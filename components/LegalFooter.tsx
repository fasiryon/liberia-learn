import Link from "next/link";

export const legalFooterLinks = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Data Policy for Minors", href: "/legal/data-for-minors" },
  { label: "Data Retention", href: "/legal/data-retention" },
  { label: "Procurement Packet", href: "/legal/procurement-security-packet" },
  { label: "Contact", href: "/contact" },
];

export function LegalFooter({
  className = "",
  variant = "public",
}: {
  className?: string;
  variant?: "public" | "portal";
}) {
  const isPortal = variant === "portal";
  return (
    <footer
      className={`py-5 ${
        isPortal
          ? "mt-8 bg-transparent"
          : "mt-0 border-t border-[var(--ll-border)] bg-[var(--ll-bg)]"
      } ${className}`}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className={`text-xs ${isPortal ? "text-[var(--ll-text-faint)]" : "text-[var(--ll-text-muted)]"}`}>
          &copy; {new Date().getFullYear()} LiberiaLearn - Republic of Liberia
        </p>
        <nav aria-label="Legal links" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {legalFooterLinks.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`text-xs leading-5 underline-offset-2 hover:underline ${
                isPortal
                  ? "text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                  : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
