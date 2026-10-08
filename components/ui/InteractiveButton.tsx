import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Common = { children: ReactNode; primary?: boolean; className?: string };
type Props = Common & (ButtonHTMLAttributes<HTMLButtonElement> & { href?: never } | { href: string; "aria-label"?: string });

/** Native link/button semantics and the shared scoped tactile state grammar. */
export function InteractiveButton({ children, primary = false, className = "", ...props }: Props) {
  const classes = `pdv2-action ${primary ? "pdv2-action-primary" : ""} ${className}`;
  if (typeof props.href === "string") return <Link href={props.href} aria-label={props["aria-label"]} className={classes}>{children}</Link>;
  return <button type="button" {...props} className={classes}>{children}</button>;
}
