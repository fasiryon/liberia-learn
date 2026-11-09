"use client";

/**
 * MEASUREMENT_TABLE (teaching-blocks/1.2.0), grades 3-12. A real table of repeated trials with units; the learner types
 * each measurement and each entry is checked against its column (number, range, precision) as they go. The origin
 * (measured by the learner, or illustrative) is always stated above the table. Derived values update from the valid
 * entries only. With a linked DESIGN_CYCLE (teaching-blocks/1.3.0 candidate) in the same ActivityScope, the linked
 * columns show each tested design's results (row N = design N) and are not typed here: one source per value.
 * Formative only: entries stay in memory and are not scored, saved or recorded.
 */
import "./stem.css";
import { useEffect, useMemo, useState } from "react";
import { useDesignFeed, usePublishSnapshot } from "./ActivityScope";
import { cellKey, cellValue, checkValue, columnValues, fedValue, isFed, deriveColumn, DERIVED_LABEL, isEditable, isEntryProblem, originText, readEntry, tableComplete, validateMeasurementTable, type MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";

type Props = { block: MeasurementTableData; onDone?: (blockId: string, done: boolean) => void };

export function MeasurementTableBlock({ block, onDone }: Props) {
  const table = useMemo(() => validateMeasurementTable(block), [block]);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const id = `mt-${table.id}`;
  const feed = useDesignFeed(table.id);
  const complete = tableComplete(table, entries, feed);
  useEffect(() => { onDone?.(table.id, complete); }, [table.id, complete, onDone]);
  // Shared only inside the mounted activity (ActivityScope), e.g. with a GRAPH_BUILDER whose sourceBlockId is this table.
  usePublishSnapshot(table.id, { kind: "MEASUREMENT_TABLE", title: table.title, origin: table.origin, columns: table.columns,
    rows: table.trials.map((_, t) => Object.fromEntries(table.columns.map((c) => [c.id, cellValue(table, t, c, entries, feed)]))) });
  const editableCount = table.trials.reduce((n, row, t) => n + table.columns.filter((c) => isEditable(table, t, c.id, feed)).length, 0);
  const filled = table.trials.reduce((n, row, t) => n + table.columns.filter((c) => isEditable(table, t, c.id, feed) && readEntry(entries[cellKey(t, c.id)] ?? "", c).ok).length, 0);

  return (
    <section className="ll8-block ll8-measure" aria-labelledby={`${id}-title`} data-block-type="MEASUREMENT_TABLE" data-origin={table.origin}>
      <h3 id={`${id}-title`} className="ll8-title">{table.title}</h3>
      <p className="ll8-origin" data-origin={table.origin}>{originText(table)}</p>
      {feed && <p className="ll8-muted" data-table-fed="">Your design tests fill {table.columns.filter((c) => isFed(feed, c.id)).map((c) => c.label).join(" and ")}: row 1 is design 1, row 2 is design 2.</p>}
      <div className="ll8-tablewrap" role="region" aria-label={`${table.title} table`} tabIndex={0}>
        <table className="ll8-mtable">
          <caption className="ll8-sr">{table.title}. {table.trials.length} trials. {originText(table)}</caption>
          <thead><tr><th scope="col">{feed ? "Design" : "Trial"}</th>{table.columns.map((c) => <th key={c.id} scope="col">{c.label}{c.unit ? <span className="ll8-unit"> ({c.unit})</span> : null}</th>)}</tr></thead>
          <tbody>{table.trials.map((row, t) => <tr key={t}>
            <th scope="row">{t + 1}</th>
            {table.columns.map((c) => {
              const key = cellKey(t, c.id), given = row[c.id];
              if (isFed(feed, c.id)) { const fed = fedValue(feed, t, c.id);
                if (fed === null) return <td key={c.id} data-fed=""><span className="ll8-muted">Design {t + 1} not tested yet</span></td>;
                // A tested design whose result breaks this column's rules is shown as a count to check, never as a value.
                const checked = checkValue(fed, c);
                if (isEntryProblem(checked)) return <td key={c.id} data-fed="" data-fed-invalid="">{fed} <span className="ll8-cellerror">Design {t + 1}: {checked.message}</span></td>;
                return <td key={c.id} data-fed="">{checked.value}</td>; }
              if (!isEditable(table, t, c.id, feed)) return <td key={c.id} data-given="">{given}</td>;
              const raw = entries[key] ?? "", read = readEntry(raw, c), show = touched[key] && isEntryProblem(read) && read.problem !== "EMPTY";
              return <td key={c.id}>
                <input className="ll8-cellinput" inputMode="decimal" autoComplete="off" value={raw} aria-label={`Trial ${t + 1}, ${c.label}${c.unit ? ` in ${c.unit}` : ""}`}
                  aria-invalid={show || undefined} aria-describedby={show ? `${id}-${key}-err` : undefined}
                  onChange={(e) => setEntries((v) => ({ ...v, [key]: e.target.value }))} onBlur={() => setTouched((v) => ({ ...v, [key]: true }))} />
                {show && isEntryProblem(read) && <span id={`${id}-${key}-err`} className="ll8-cellerror">{read.message}</span>}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      {table.derived.length > 0 && <dl className="ll8-derived" aria-label="Worked out from the table">
        {table.columns.map((c) => {
          const values = columnValues(table, c, entries, feed), rows = deriveColumn(values, c, table.derived);
          return <div key={c.id} data-derived-column={c.id}>
            <dt>{c.label}{values.length ? <span className="ll8-muted"> · from {values.length} trial{values.length === 1 ? "" : "s"}</span> : null}</dt>
            {rows.length ? rows.map((r) => <dd key={r.kind} data-derived={r.kind}>{DERIVED_LABEL[r.kind]}: <strong>{r.text}</strong></dd>)
              : <dd className="ll8-muted">Appears when you enter a measurement.</dd>}
          </div>;
        })}
      </dl>}
      {editableCount > 0 && <p role="status" className="ll8-feedback" data-table-complete={complete ? "" : undefined}>
        {complete ? "Every measurement is entered. Look at the results: which trials agree, and which one is different?" : `${filled} of ${editableCount} measurements entered.`}
      </p>}
      <p className="ll8-muted">Your entries stay on this screen only. They are not saved or sent.</p>
    </section>
  );
}
