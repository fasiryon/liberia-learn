// app/api/placement/generate-question/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { logAudit } from "@/lib/audit";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const WINDOW_MS  = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}


const difficultyDescriptions: Record<number, string> = {
  1: "very basic, elementary level",
  2: "simple, early middle school level",
  3: "moderate, middle school level",
  4: "challenging, high school level",
  5: "advanced, college prep level",
};

type PlacementQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: number;
  subject: string;
  strand: string;
  moeStandard: string | null;
  whyThisQuestion: string;
  commonMistake: string;
  hint: string;
};

function parsePlacementQuestion(content: string, expectedDifficulty: number): PlacementQuestion {
  let parsed: unknown;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw Object.assign(new Error("Failed to parse question data from AI"), { status: 502 });
  }

  const candidate = parsed as Partial<PlacementQuestion>;
  if (
    typeof candidate.question !== "string" ||
    !Array.isArray(candidate.options) ||
    candidate.options.length !== 4 ||
    candidate.options.some((option) => typeof option !== "string") ||
    typeof candidate.correctAnswer !== "number" ||
    candidate.correctAnswer < 0 ||
    candidate.correctAnswer > 3 ||
    typeof candidate.explanation !== "string" ||
    typeof candidate.subject !== "string" ||
    typeof candidate.strand !== "string" ||
    (candidate.moeStandard !== null && typeof candidate.moeStandard !== "string") ||
    typeof candidate.whyThisQuestion !== "string" ||
    typeof candidate.commonMistake !== "string" ||
    typeof candidate.hint !== "string"
  ) {
    throw Object.assign(new Error("AI returned an invalid placement question payload"), { status: 502 });
  }

  return {
    question: candidate.question.trim(),
    options: candidate.options.map((option) => option.trim()),
    correctAnswer: candidate.correctAnswer,
    explanation: candidate.explanation.trim(),
    difficulty: expectedDifficulty,
    subject: candidate.subject.trim().toLowerCase(),
    strand: candidate.strand.trim(),
    moeStandard: candidate.moeStandard ? candidate.moeStandard.trim() : null,
    whyThisQuestion: candidate.whyThisQuestion.trim(),
    commonMistake: candidate.commonMistake.trim(),
    hint: candidate.hint.trim(),
  };
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429 }
      );
    }

    const { difficulty, subject, previousAnswers } = await req.json();

    const safeDifficulty =
      typeof difficulty === "number" && difficulty >= 1 && difficulty <= 5
        ? difficulty
        : 3;

    const subjectText = subject || "mathematics";

    const prompt = `
Generate a single ${subjectText} placement-test multiple-choice question at ${
      difficultyDescriptions[safeDifficulty]
    }.

Previous performance: ${
      previousAnswers ? JSON.stringify(previousAnswers) : "No previous answers"
    }

Return ONLY a JSON object with this exact structure (no backticks, no extra text):

{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "explanation": "Brief explanation of the answer",
  "difficulty": ${safeDifficulty},
  "subject": "${subjectText.toLowerCase()}",
  "strand": "Number sense",
  "moeStandard": "MATH-G5-NS-01",
  "whyThisQuestion": "This tests whether the student understands place value at difficulty ${safeDifficulty}",
  "commonMistake": "Students often confuse tens and hundreds place",
  "hint": "Think about the position of each digit"
}

Rules:
- Question must be clear and age-appropriate.
- All 4 options must be plausible.
- correctAnswer is the index (0-3) of the correct option.
- Explanation must be 1-3 short sentences.
- subject must match the requested subject.
- strand must name the MOE strand or sub-skill being tested.
- moeStandard should be an MOE code when you can infer one, otherwise null.
- whyThisQuestion must explain the concept and difficulty being assessed.
- commonMistake must describe a realistic learner misconception.
- hint must help the learner think without revealing the answer.
`;

    const completion = await routedCompletion({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 600,
      forceSmartTier: true,
    });

    const content = completion.content;
    if (!content) {
      throw new Error("No content returned from AI");
    }

    const questionData = parsePlacementQuestion(content, safeDifficulty);

    await logAudit({
      userId: user.id,
      action: "placement.question.generated",
      resourceType: "placement_question",
      schoolId: user.schoolId,
      details: {
        subject: questionData.subject,
        strand: questionData.strand,
        moeStandard: questionData.moeStandard,
        difficulty: questionData.difficulty,
      },
    });

    return NextResponse.json(questionData);
  } catch (error: any) {
    console.error("Generate question error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate question" },
      { status: error?.status ?? 500 }
    );
  }
}
