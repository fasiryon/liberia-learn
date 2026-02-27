import { z } from "zod";
import { routedCompletion } from "@/lib/ai/router";
import { isCurriculumOptimizationAiEnabled } from "@/lib/serverFlags";
import type { NationalCurriculumSignals, WeakStrand } from "@/lib/reporting/curriculum/nationalCurriculumSignals";

export type CurriculumOptimizerOutput = {
  weakStrands: Array<{
    gradeBand: string;
    strands: WeakStrand[];
  }>;
  recommendedEmphasisChanges: string[];
  aiSummary?: {
    advisoryText: string;
    hadFallback: boolean;
  };
};

const AiOutputSchema = z.object({
  advisoryText: z.string().min(1),
  emphasisChanges: z.array(z.string().min(1)).max(8).optional(),
});

function deterministicSuggestions(signal: NationalCurriculumSignals): string[] {
  const suggestions: string[] = [];
  const topBands = Object.entries(signal.weakByGradeBand)
    .filter(([, strands]) => strands.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [gradeBand, strands] of topBands) {
    const focus = strands.slice(0, 2);
    if (focus.length === 0) continue;
    const strandList = focus.map((s) => `${s.subject}:${s.strandKey}`).join(", ");
    suggestions.push(
      `Advisory only: prioritize reteach cycles in ${gradeBand} for ${strandList}, then reassess within one cycle.`
    );

    if (focus.some((s) => s.trendDirection === "declining")) {
      suggestions.push(
        `Advisory only: in ${gradeBand}, allocate additional guided practice where mastery trend is declining before introducing new strands.`
      );
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Advisory only: no weak strands met the configured criteria; continue routine monitoring and periodic reassessment."
    );
  }

  return suggestions.slice(0, 8);
}

function buildAiPrompt(signal: NationalCurriculumSignals): string {
  const payload = {
    summary: signal.summary,
    weakByGradeBand: signal.weakByGradeBand,
  };

  return [
    "You are an advisory-only curriculum analyst for a national education platform.",
    "Return only valid JSON.",
    "Do not include school-level, district-level, student, teacher, or person identifiers.",
    "Do not produce rankings for public release.",
    "Produce concise ministry-facing advisory language only.",
    "Schema:",
    "{",
    '  "advisoryText": "string",',
    '  "emphasisChanges": ["string"]',
    "}",
    "Input:",
    JSON.stringify(payload),
  ].join("\n");
}

async function getAiAugmentation(signal: NationalCurriculumSignals): Promise<{
  advisoryText: string;
  emphasisChanges: string[];
  hadFallback: boolean;
}> {
  try {
    const aiResult = await routedCompletion({
      messages: [
        { role: "system", content: "Return only valid JSON." },
        { role: "user", content: buildAiPrompt(signal) },
      ],
      maxTokens: 500,
      forceSmartTier: true,
    });

    const cleaned = aiResult.content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const validated = AiOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error("invalid_ai_json");
    }

    return {
      advisoryText: validated.data.advisoryText.trim(),
      emphasisChanges: (validated.data.emphasisChanges ?? []).map((line) => line.trim()).filter(Boolean),
      hadFallback: false,
    };
  } catch {
    return {
      advisoryText:
        "AI advisory unavailable; deterministic curriculum emphasis guidance is provided instead.",
      emphasisChanges: [],
      hadFallback: true,
    };
  }
}

export async function optimizeCurriculumSignals(
  signal: NationalCurriculumSignals
): Promise<CurriculumOptimizerOutput> {
  const weakStrands = Object.entries(signal.weakByGradeBand)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gradeBand, strands]) => ({
      gradeBand,
      strands: [...strands],
    }));

  const deterministic = deterministicSuggestions(signal);

  if (!isCurriculumOptimizationAiEnabled()) {
    return {
      weakStrands,
      recommendedEmphasisChanges: deterministic,
    };
  }

  const ai = await getAiAugmentation(signal);
  const merged = Array.from(new Set([...deterministic, ...ai.emphasisChanges])).slice(0, 8);

  return {
    weakStrands,
    recommendedEmphasisChanges: merged,
    aiSummary: {
      advisoryText: ai.advisoryText,
      hadFallback: ai.hadFallback,
    },
  };
}

