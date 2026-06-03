export type LessonSlide = {
  index: number;
  title: string;
  content: string;
  isFirst: boolean;
  isLast: boolean;
};

function normalizeLines(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function paragraphGroups(markdown: string, maxParagraphs = 3) {
  const paragraphs = normalizeLines(markdown)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const groups: string[] = [];
  for (let index = 0; index < paragraphs.length; index += maxParagraphs) {
    groups.push(paragraphs.slice(index, index + maxParagraphs).join("\n\n"));
  }
  return groups;
}

function headingSlides(markdown: string) {
  const lines = normalizeLines(markdown).split("\n");
  const sections: Array<{ title: string; content: string[] }> = [];
  let current: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[2].trim(), content: [] };
      continue;
    }
    if (!current) {
      current = { title: "Lesson", content: [] };
    }
    current.content.push(line);
  }

  if (current) sections.push(current);
  return sections.filter((section) => section.title !== "Lesson" || section.content.join("\n").trim());
}

function firstParagraph(markdown: string) {
  return paragraphGroups(markdown, 1)[0] ?? "";
}

function isTakeawayTitle(title: string) {
  return /(takeaway|conclusion|summary|remember|review|key point)/i.test(title);
}

function extractTakeawaysFromSection(content: string): string {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => /key takeaways?:/i.test(l));
  if (startIdx !== -1) {
    // skip the "Key Takeaways:" header line itself — slide title already says "Key Takeaways"
    return lines.slice(startIdx + 1).join('\n').trim();
  }
  return content;
}

function fallbackTakeaways(markdown: string) {
  // Extract any existing bullet/numbered list items from the body as summary
  const bullets = normalizeLines(markdown)
    .split('\n')
    .filter(line => /^[-*]\s+.{20,}/.test(line))
    .slice(-5);
  if (bullets.length >= 2) return bullets.join('\n');
  // Last resort: last 2-3 paragraphs condensed
  const paragraphs = paragraphGroups(markdown, 1).slice(-3)
    .map(p => p.replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 30);
  if (paragraphs.length > 0) return paragraphs.map(p => `- ${p.slice(0, 120)}`).join('\n');
  return '- Review this lesson and complete the exit ticket.';
}

export function parseToSlides(input: {
  title: string;
  content: string;
  takeawaySummary?: string | null;
}): LessonSlide[] {
  const title = input.title.trim() || "Lesson";
  const content = normalizeLines(input.content || "");
  if (!content) {
    return [{ index: 1, title, content: "No lesson text is available.", isFirst: true, isLast: true }];
  }

  const hasHeadings = /^#{2,3}\s+/m.test(content);
  const baseSections = hasHeadings
    ? headingSlides(content)
    : paragraphGroups(content, 3).map((group, index) => ({
        title: index === 0 ? title : `Part ${index + 1}`,
        content: [group],
      }));

  const intro = firstParagraph(content);
  const slides: Array<Omit<LessonSlide, "index" | "isFirst" | "isLast">> = [
    {
      title,
      content: intro ? `# ${title}\n\n${intro}` : `# ${title}`,
    },
  ];

  for (const section of baseSections) {
    const sectionContent = section.content.join("\n").trim();
    if (!sectionContent) continue;
    if (section.title === "Lesson" && sectionContent === intro) continue;
    slides.push({ title: section.title, content: sectionContent });
  }

  const existingFinal = baseSections[baseSections.length - 1];
  if (existingFinal && isTakeawayTitle(existingFinal.title)) {
    const sectionContent = existingFinal.content.join("\n").trim();
    const extracted = extractTakeawaysFromSection(sectionContent);
    // If we successfully extracted a takeaway sub-section (different from the raw content),
    // or the section already contains bullet points, replace the last slide with a clean
    // "Key Takeaways" slide so the mixed assessment/exit-ticket content is stripped.
    if (extracted !== sectionContent || /^[-*]\s+/m.test(extracted)) {
      // Remove the already-pushed version of this section (added in the loop above)
      const existingIdx = slides.findIndex((slide) => slide.title === existingFinal.title);
      if (existingIdx !== -1) {
        slides.splice(existingIdx, 1);
      }
      slides.push({ title: "Key Takeaways", content: extracted });
      return slides.map((slide, zeroIndex) => ({
        ...slide,
        index: zeroIndex + 1,
        isFirst: zeroIndex === 0,
        isLast: zeroIndex === slides.length - 1,
      }));
    }
  }
  slides.push({
    title: "Key Takeaways",
    content: input.takeawaySummary?.trim() || fallbackTakeaways(content),
  });

  return slides.map((slide, zeroIndex) => ({
    ...slide,
    index: zeroIndex + 1,
    isFirst: zeroIndex === 0,
    isLast: zeroIndex === slides.length - 1,
  }));
}
