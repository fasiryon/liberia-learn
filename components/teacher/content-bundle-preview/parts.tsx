import type { KeyboardEvent, ReactNode } from "react";
import type { GovernedItemKind } from "@/lib/content-bundle/v1/types";
import { humanize, type ItemLink, type NavGroup, type ResourceRow, type SequencePlacement } from "@/lib/content-bundle/preview/viewModel";

export type ChipTone = "neutral" | "gold" | "green" | "warn" | "danger";

/** Static status label. Text always carries the meaning; tone is supplementary. */
export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`cbp-chip cbp-chip-${tone}`}>{children}</span>;
}

export function kindLabel(kind: GovernedItemKind): string {
  return kind === "QUIZ" ? "Quiz" : humanize(kind);
}

export function Section({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="cbp-section" aria-labelledby={id}>
      <h3 id={id} className="cbp-h3">{title}</h3>
      {note ? <p className="cbp-note">{note}</p> : null}
      {children}
    </section>
  );
}

export function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="cbp-facts">
      {rows.map(([term, value]) => (
        <div key={term} className="cbp-fact">
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="cbp-empty">{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="cbp-code">{children}</code>;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ItemLinks({ links, onSelect, empty = "None" }: { links: readonly ItemLink[]; onSelect: (itemId: string) => void; empty?: string }) {
  if (links.length === 0) return <>{empty}</>;
  return (
    <ul className="cbp-inline-list">
      {links.map((link) => (
        <li key={link.itemId}>
          <button type="button" className="cbp-link" onClick={() => onSelect(link.itemId)}>
            {link.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SequenceFacts({ sequence, onSelect }: { sequence: SequencePlacement | null; onSelect: (itemId: string) => void }) {
  if (!sequence) return <Empty>This item is not placed in the bundle sequence.</Empty>;
  return (
    <Facts
      rows={[
        ["Unit", sequence.unitTitle],
        ["Sequence position", `Step ${sequence.order + 1}`],
        ["Requirement", sequence.requirement === "REQUIRED" ? <Chip tone="gold">Required</Chip> : <Chip>Optional</Chip>],
        ["Comes after", <ItemLinks key="pre" links={sequence.prerequisites} onSelect={onSelect} empty="Nothing (can start here)" />],
        ["Unlocks", <ItemLinks key="unl" links={sequence.unlocks} onSelect={onSelect} empty="Nothing" />],
      ]}
    />
  );
}

export function ResourceList({ resources, showAudience }: { resources: readonly ResourceRow[]; showAudience: boolean }) {
  if (resources.length === 0) return <Empty>No resources.</Empty>;
  return (
    <ul className="cbp-list">
      {resources.map((r) => (
        <li key={r.resourceId}>
          <span className="cbp-strong">{r.title}</span> <Chip>{r.kind}</Chip>
          {showAudience && r.audience ? <> <Chip tone={r.audience === "Learner" ? "green" : "warn"}>{r.audience === "Learner" ? "Students see this" : `${r.audience} only`}</Chip></> : null}
          {r.offline ? <> <Chip tone="green">Available offline</Chip></> : null}
        </li>
      ))}
    </ul>
  );
}

const OVERVIEW_ID = "__overview";
export { OVERVIEW_ID };

/**
 * Sequence navigation. Native buttons (Tab, Enter, Space) plus Arrow/Home/End to move focus
 * through the list; the selected entry carries aria-current.
 */
export function SequenceNav({ groups, selectedId, onSelect, label }: { groups: readonly NavGroup[]; selectedId: string; onSelect: (itemId: string) => void; label: string }) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-nav-item]")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? Math.min(index + 1, buttons.length - 1) : Math.max(index - 1, 0);
    buttons[next].focus();
  };
  return (
    <nav aria-label={label} className="cbp-nav" onKeyDown={onKeyDown}>
      <button type="button" data-nav-item="" className="cbp-nav-item" aria-current={selectedId === OVERVIEW_ID ? "true" : undefined} onClick={() => onSelect(OVERVIEW_ID)}>
        <span className="cbp-nav-title">Bundle overview</span>
      </button>
      {groups.map((group) => (
        <div key={group.groupId} className="cbp-nav-group">
          <h2 className="cbp-nav-heading">{group.title}</h2>
          <ol className="cbp-nav-list">
            {group.items.map((item, index) => (
              <li key={item.itemId}>
                <button type="button" data-nav-item="" data-item-id={item.itemId} className="cbp-nav-item" aria-current={selectedId === item.itemId ? "true" : undefined} onClick={() => onSelect(item.itemId)}>
                  <span className="cbp-nav-step" aria-hidden="true">{group.groupId === "__unsequenced" ? "•" : index + 1}</span>
                  <span className="cbp-nav-body">
                    <span className="cbp-nav-title">{item.title}</span>
                    <span className="cbp-nav-meta">
                      {kindLabel(item.itemKind)}
                      {item.requirement === "OPTIONAL" ? " · Optional" : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </nav>
  );
}
