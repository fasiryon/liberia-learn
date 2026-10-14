import type { ReactNode } from "react";

/**
 * Student Experience V3 page primitives (app/learning-v3.css). Presentation only: they take display
 * models and permitted actions, never query data, compute grades or decide release. Role-neutral so
 * Teacher, Guardian, School, Ministry and Author workspaces can adopt them (docs/product-design-v3).
 */
export function PageFrame({ children, width = "dashboard", labelledBy, className = "", as: Tag = "main" }: {
  children: ReactNode;
  /** dashboard: 1280px content; wide: 1440px working stage. */
  width?: "dashboard" | "wide";
  labelledBy?: string;
  className?: string;
  as?: "main" | "div";
}) {
  return <Tag className={`ll3-page ${className}`.trim()} data-width={width} aria-labelledby={labelledBy}>{children}</Tag>;
}

export function PageHeader({ eyebrow, title, titleId, lede, actions }: { eyebrow?: ReactNode; title: ReactNode; titleId: string; lede?: ReactNode; actions?: ReactNode }) {
  return <header className="ll3-header">
    <div>
      {eyebrow && <p className="ll3-eyebrow">{eyebrow}</p>}
      <h1 id={titleId} className="ll3-title">{title}</h1>
      {lede && <p className="ll3-lede">{lede}</p>}
    </div>
    {actions && <div className="ll3-actions">{actions}</div>}
  </header>;
}

export function Panel({ eyebrow, title, titleId, note, actions, children, className = "" }: { eyebrow?: ReactNode; title: ReactNode; titleId: string; note?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`ll3-panel ${className}`.trim()} aria-labelledby={titleId}>
    <div className="ll3-panel-head">
      <div>{eyebrow && <p className="ll3-eyebrow">{eyebrow}</p>}<h2 id={titleId} className="ll3-panel-title">{title}</h2></div>
      {actions && <div className="ll3-actions">{actions}</div>}
    </div>
    {note && <p className="ll3-panel-note">{note}</p>}
    {children}
  </section>;
}

export function Chip({ children, tone }: { children: ReactNode; tone?: "accent" | "success" | "demo" }) {
  return <span className="ll3-chip" data-tone={tone}>{children}</span>;
}

/** A labelled proportion. The label carries the meaning; the bar is decoration for sighted users. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return <div className="ll3-meter" role="img" aria-label={label}><span style={{ width: `${percent}%` }} /></div>;
}
