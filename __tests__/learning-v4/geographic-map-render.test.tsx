// The county map renders the real outlines with attribution and a text alternative; the key-free outline never exposes names.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeographicCountyMap } from "@/components/experience/geography/GeographicCountyMap";
import { DRAFT6_CIVICS_GEOGRAPHY, geographicAttachments } from "@/lib/learner-experience/geography/draft6Binding";

const attachments = geographicAttachments({ selection: DRAFT6_CIVICS_GEOGRAPHY.selection, packageHash: DRAFT6_CIVICS_GEOGRAPHY.packageHash, candidateSha256: DRAFT6_CIVICS_GEOGRAPHY.candidateSha256 }, ["generated-1", "generated-3"]);
const keyed = renderToStaticMarkup(<GeographicCountyMap attachment={attachments["generated-1"][0]} />);
const outline = renderToStaticMarkup(<GeographicCountyMap attachment={attachments["generated-3"][0]} />);

describe("GeographicCountyMap", () => {
  it("draws fifteen focusable county areas with one tab stop", () => {
    expect(keyed.match(/data-county="/g)).toHaveLength(15);
    expect(keyed.match(/tabindex="0"/g)).toHaveLength(1);
    expect(keyed).toContain('aria-label="Lofa, area 8"');
  });
  it("keeps attribution, licence and the text alternative", () => {
    for (const html of [keyed, outline]) {
      expect(html).toContain("CC BY 3.0 IGO");
      expect(html).toContain("UNMIL / OCHA ROWCA");
      expect(html).toMatch(/Map as text/);
      expect(html).toMatch(/no roads, distances or capital points/i);
    }
  });
  it("the outline task hides county names and capitals from labels, list and text", () => {
    expect(outline).toContain('aria-label="Area 8"');
    const exposed = outline.replace(/<p class="ll6-geo-credit"[\s\S]*?<\/p>/, "").replace(/<p class="font-semibold">[\s\S]*?<\/p>/, "");
    for (const name of ["Gbarpolu", "Grand Gedeh", "Voinjama", "Harper", "Kakata"]) expect(exposed).not.toContain(name);
  });
});
