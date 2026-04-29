export type Phase6BatchMetrics = {
  attempted: number;
  passed: number;
  malformedJsonAfterRepair: number;
  titleCollisionAfterRetry: number;
};

export function phase6BatchPassRate(input: Pick<Phase6BatchMetrics, "attempted" | "passed">) {
  return input.attempted > 0 ? input.passed / input.attempted : 1;
}

export function shouldStopPhase6Batch(input: Phase6BatchMetrics & { cumulativeAttempted: number; cumulativePassed: number }) {
  const batchPassRate = phase6BatchPassRate(input);
  const cumulativePassRate = phase6BatchPassRate({ attempted: input.cumulativeAttempted, passed: input.cumulativePassed });
  return (
    batchPassRate < 0.8 ||
    cumulativePassRate < 0.8 ||
    input.malformedJsonAfterRepair > 3 ||
    input.titleCollisionAfterRetry > 3
  );
}

export function isMalformedJsonError(error: unknown) {
  return error instanceof SyntaxError || /JSON|Expected|Bad control character|Unterminated/i.test(error instanceof Error ? error.message : String(error));
}

export function isGenericPhase6Title(title: string) {
  return /^(understanding|introduction to|basics of|review of)\b/i.test(title.trim());
}

export function shouldRetryTitleCollision(message: string) {
  return /Title similarity guard blocked/i.test(message) || isGenericPhase6Title(message);
}

export type Grade5EnglishTopicBucket =
  | "reading_comprehension"
  | "writing"
  | "grammar"
  | "vocabulary"
  | "speaking_listening";

export const GRADE5_ENGLISH_TOPIC_BUCKETS: Grade5EnglishTopicBucket[] = [
  "reading_comprehension",
  "writing",
  "grammar",
  "vocabulary",
  "speaking_listening",
];

const bucketLabels: Record<Grade5EnglishTopicBucket, string> = {
  reading_comprehension: "Reading comprehension",
  writing: "Writing",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  speaking_listening: "Speaking/listening",
};

const bucketTopics: Record<Grade5EnglishTopicBucket, string[]> = {
  reading_comprehension: [
    "Finding main idea and supporting details in a short passage",
    "Making inferences from a story",
    "Comparing characters and settings in a passage",
    "Summarizing an informational text",
  ],
  writing: [
    "Writing a clear paragraph with a topic sentence",
    "Planning a story with beginning, middle, and ending",
    "Adding details to improve descriptive writing",
    "Revising sentences for clarity",
  ],
  grammar: [
    "Using verbs to show action and tense",
    "Using punctuation in dialogue",
    "Choosing adjectives and adverbs precisely",
    "Combining simple sentences correctly",
  ],
  vocabulary: [
    "Using context clues to understand new words",
    "Choosing precise words for meaning",
    "Learning synonyms and antonyms in context",
    "Using word parts to understand meaning",
  ],
  speaking_listening: [
    "Listening for key details in a class discussion",
    "Giving a short oral explanation with supporting details",
    "Asking and answering questions in a respectful discussion",
    "Sharing an opinion with clear reasons",
  ],
};

export function classifyGrade5EnglishTopic(input: string): Grade5EnglishTopicBucket {
  const text = input.toLowerCase();
  if (/\b(main idea|supporting detail|infer|inference|summar|passage|character|setting|comprehension|read)\b/.test(text)) {
    return "reading_comprehension";
  }
  if (/\b(paragraph|story|stories|writing|write|sentence|sentences|revise|revision|draft|narrative|descriptive)\b/.test(text)) {
    return "writing";
  }
  if (/\b(adjective|adjectives|verb|verbs|noun|nouns|punctuation|quotation|grammar|adverb|tense|comma)\b/.test(text)) {
    return "grammar";
  }
  if (/\b(vocabulary|context clue|context clues|synonym|antonym|word meaning|word parts|prefix|suffix|root word)\b/.test(text)) {
    return "vocabulary";
  }
  if (/\b(speaking|listening|discussion|oral|present|presentation|conversation|feedback|share ideas|sharing ideas)\b/.test(text)) {
    return "speaking_listening";
  }
  return "writing";
}

export function topicDistribution(items: Array<{ title?: string | null; content?: string | null }>) {
  const counts = Object.fromEntries(GRADE5_ENGLISH_TOPIC_BUCKETS.map((bucket) => [bucket, 0])) as Record<Grade5EnglishTopicBucket, number>;
  for (const item of items) {
    const bucket = classifyGrade5EnglishTopic(`${item.title ?? ""} ${item.content ?? ""}`);
    counts[bucket] += 1;
  }
  return counts;
}

export function selectBalancedGrade5EnglishTopic(input: {
  distribution: Record<Grade5EnglishTopicBucket, number>;
  recentBuckets?: Grade5EnglishTopicBucket[];
  weekNumber: number;
  dayNumber: number;
}) {
  const total = GRADE5_ENGLISH_TOPIC_BUCKETS.reduce((sum, bucket) => sum + input.distribution[bucket], 0);
  const maxAllowed = Math.max(1, Math.floor(Math.max(total, 1) * 0.25));
  const overLimit = new Set(GRADE5_ENGLISH_TOPIC_BUCKETS.filter((bucket) => input.distribution[bucket] >= maxAllowed));
  const consecutiveBucket =
    input.recentBuckets && input.recentBuckets.length >= 3 && input.recentBuckets.slice(-3).every((bucket) => bucket === input.recentBuckets?.at(-1))
      ? input.recentBuckets.at(-1)
      : null;
  const candidates = GRADE5_ENGLISH_TOPIC_BUCKETS
    .filter((bucket) => !overLimit.has(bucket))
    .filter((bucket) => bucket !== consecutiveBucket);
  const fallback = GRADE5_ENGLISH_TOPIC_BUCKETS.filter((bucket) => bucket !== consecutiveBucket);
  const pool = candidates.length > 0 ? candidates : fallback;
  const bucket = [...pool].sort((a, b) => input.distribution[a] - input.distribution[b] || GRADE5_ENGLISH_TOPIC_BUCKETS.indexOf(a) - GRADE5_ENGLISH_TOPIC_BUCKETS.indexOf(b))[0];
  const topics = bucketTopics[bucket];
  const topic = topics[(input.weekNumber + input.dayNumber) % topics.length];
  return {
    bucket,
    topic: `${bucketLabels[bucket]}: ${topic}`,
  };
}

export function phase6ValidationFailures(input: { title: string; content: string; topicBucket: Grade5EnglishTopicBucket; distribution: Record<Grade5EnglishTopicBucket, number> }) {
  const failures: string[] = [];
  const total = GRADE5_ENGLISH_TOPIC_BUCKETS.reduce((sum, bucket) => sum + input.distribution[bucket], 0);
  const projectedTotal = total + 1;
  if ((input.distribution[input.topicBucket] + 1) / projectedTotal > 0.25) {
    failures.push("topic_overrepresentation");
  }
  if (/^(using adjectives to|understanding adjectives)\b/i.test(input.title.trim())) {
    failures.push("repetitive_title_pattern");
  }
  if (/\b(river congo|congo river|nile river)\b/i.test(input.content)) {
    failures.push("invalid_context_reference");
  }
  return failures;
}
