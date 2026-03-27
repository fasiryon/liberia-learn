const MAX_CHUNK_CHARS = 1200;
const TARGET_CHUNK_CHARS = 900;

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function splitParagraphs(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= MAX_CHUNK_CHARS) {
    return [paragraph];
  }

  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return paragraph.match(new RegExp(`.{1,${TARGET_CHUNK_CHARS}}`, "g")) ?? [paragraph];
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = sentence;
      continue;
    }
    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function chunkText(text: string): string[] {
  const paragraphs = splitParagraphs(text);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.flatMap(splitLongParagraph)) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > TARGET_CHUNK_CHARS && current) {
      chunks.push(current);
      current = paragraph;
      continue;
    }
    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
