import OpenAI from "openai";

export type LessonAudioProvider = {
  generateMp3(input: { text: string; voice: string }): Promise<Buffer>;
};

/** Vendor-specific adapter; the lesson pipeline depends only on this contract. */
export function createOpenAiLessonAudioProvider(apiKey = process.env.OPENAI_API_KEY): LessonAudioProvider {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for lesson audio generation.");
  const client = new OpenAI({ apiKey });
  return {
    async generateMp3(input) {
      const response = await client.audio.speech.create({
        model: "tts-1",
        voice: input.voice as "alloy",
        input: input.text,
        response_format: "mp3",
      });
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
