function normalizeWhitespace(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function splitOversizedSentence(sentence: string, maxChars: number) {
  const words = sentence.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = word;
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitParagraph(paragraph: string, maxChars: number) {
  if (paragraph.length <= maxChars) return [paragraph];

  const sentences = paragraph
    .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? [paragraph];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const sentenceParts = sentence.length > maxChars ? splitOversizedSentence(sentence, maxChars) : [sentence];
    for (const part of sentenceParts) {
      const next = current ? `${current} ${part}` : part;
      if (next.length > maxChars) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current = next;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function chunkTextForTTS(text: string, maxChars = 3500): string[] {
  const limit = Math.max(1, Math.floor(maxChars));
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const paragraphParts = splitParagraph(paragraph, limit);
    for (const part of paragraphParts) {
      const next = current ? `${current}\n\n${part}` : part;
      if (next.length > limit) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current = next;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
