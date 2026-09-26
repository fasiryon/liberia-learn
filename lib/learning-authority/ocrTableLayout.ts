/**
 * Rebuilds column-ordered page text from OCR line geometry so scanned MOE
 * topic tables can go through the same parser as decoded PDF text.
 *
 * Windows OCR returns lines in visual blocks: header labels ("GRADE:") and
 * their values ("7") come out separately, and list numbers ("1.", read as
 * "l.") sit in a narrow column left of their text. The table itself is a set
 * of x-bands (outcomes | objectives | contents | activities | materials |
 * assessment). This module:
 *   1. pairs header labels with values on the same row;
 *   2. clusters body lines into column bands by x position;
 *   3. attaches list markers to the text line on the same row;
 *   4. marks paragraph gaps (vertical gap well above line spacing) as item
 *      boundaries with a bullet;
 *   5. emits the header, then each column top-to-bottom, left-to-right.
 */
export type OcrLine = Readonly<{ text: string; x: number; y: number }>;

const HEADER_LABEL = /^(SEMESTER|GRADE|PERIOD|SUBJECT|TOPICS?|UNIT)\s*:?\s*$/i;
const COLUMN_HEADING = /^(LEARNING|OUTCOMES?:?|OBJECTIVES?:?|CONTENTS?:?|ACTIVITIES:?|MATERIALS\/?|RESOURCES:?|MATERIALS\/\s*RESOURCES:?|COMPETENC\w*\/?|ASSESSMENTS?:?|COMPETENCIES\/\s*ASSESSMENTS?:?)$/i;
const PAGE_FOOTER = /^Page\s*\d+$/i;
const MARKER = /^([lI1]|\d{1,2})\s?\.$/;

function markerNumber(text: string): string {
  const token = text.replace(/\s|\./g, "");
  return /^[lI]$/.test(token) ? "1" : token;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export function ocrPageToText(lines: readonly OcrLine[], options: { rowTolerance?: number; columnGap?: number } = {}): string {
  const rowTolerance = options.rowTolerance ?? 30;
  const columnGap = options.columnGap ?? 180;
  const usable = lines.filter((line) => line.text.trim() && !PAGE_FOOTER.test(line.text.trim()));
  if (!usable.length) return "";

  // 1. Header: label lines and the values printed on the same row.
  const labels = usable.filter((line) => HEADER_LABEL.test(line.text.trim()));
  const headerCut = labels.length >= 2 ? Math.max(...labels.map((line) => line.y)) + rowTolerance : -1;
  const headerLines = usable.filter((line) => line.y <= headerCut);
  const headerOut: string[] = [];
  const consumed = new Set<OcrLine>();
  for (const label of [...labels].sort((a, b) => a.y - b.y)) {
    const values = headerLines
      .filter((line) => line !== label && !HEADER_LABEL.test(line.text.trim()) && Math.abs(line.y - label.y) <= rowTolerance)
      .sort((a, b) => a.x - b.x);
    values.forEach((value) => consumed.add(value));
    consumed.add(label);
    headerOut.push(`${label.text.replace(/\s*:?\s*$/, "").toUpperCase()}: ${values.map((value) => value.text.trim()).join(" ")}`);
  }
  for (const line of headerLines) if (!consumed.has(line)) headerOut.push(line.text.trim());
  // The decoded-text parser expects the column heading row after the header.
  if (headerOut.length) headerOut.push("OUTCOMES OBJECTIVES CONTENTS ACTIVITIES MATERIALS/RESOURCES ASSESSMENTS");

  // 2. Body columns by x band.
  const body = usable.filter((line) => line.y > headerCut && !COLUMN_HEADING.test(line.text.trim()));
  const byX = [...body].sort((a, b) => a.x - b.x);
  const columns: OcrLine[][] = [];
  for (const line of byX) {
    const current = columns[columns.length - 1];
    if (current && line.x - current[current.length - 1]!.x <= columnGap) current.push(line);
    else columns.push([line]);
  }

  // 3-4. Within a column, attach markers and mark paragraph gaps.
  const out: string[] = [...headerOut];
  for (const column of columns) {
    const markers = column.filter((line) => MARKER.test(line.text.trim()));
    const texts = column.filter((line) => !MARKER.test(line.text.trim())).sort((a, b) => a.y - b.y);
    const prefix = new Map<OcrLine, string>();
    for (const marker of markers) {
      const target = texts
        .filter((line) => line.x > marker.x && Math.abs(line.y - marker.y) <= rowTolerance)
        .sort((a, b) => Math.abs(a.y - marker.y) - Math.abs(b.y - marker.y))[0];
      if (target && !prefix.has(target)) prefix.set(target, `${markerNumber(marker.text)}. `);
    }
    const gaps = texts.slice(1).map((line, index) => line.y - texts[index]!.y);
    const spacing = median(gaps);
    texts.forEach((line, index) => {
      const gap = index ? line.y - texts[index - 1]!.y : 0;
      const marked = prefix.get(line);
      if (index && !marked && spacing && gap > spacing * 1.45) out.push("•");
      out.push(`${marked ?? ""}${line.text.trim()}`);
    });
  }
  return out.join("\n");
}
