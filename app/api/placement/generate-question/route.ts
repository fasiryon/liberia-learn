// app/api/placement/generate-question/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const difficultyDescriptions: Record<number, string> = {
  1: "very basic, elementary level",
  2: "simple, early middle school level",
  3: "moderate, middle school level",
  4: "challenging, high school level",
  5: "advanced, college prep level",
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }

    const { difficulty, subject, previousAnswers } = await req.json();

    const safeDifficulty =
      typeof difficulty === "number" && difficulty >= 1 && difficulty <= 5
        ? difficulty
        : 3;

    const subjectText = subject || "mathematics";

    const prompt = `
Generate a single ${subjectText} question at ${
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
  "difficulty": ${safeDifficulty}
}

Rules:
- Question must be clear and age-appropriate.
- All 4 options must be plausible.
- correctAnswer is the index (0-3) of the correct option.
- Explanation must be 1-3 short sentences.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    // Extract JSON from the response
    let questionData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }
      questionData = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse question data from AI");
    }

    return NextResponse.json(questionData);
  } catch (error: any) {
    console.error("Generate question error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate question" },
      { status: 500 }
    );
  }
}
