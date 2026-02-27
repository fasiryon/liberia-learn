import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAIClientOrNull(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!_openai) _openai = new OpenAI({ apiKey });
  return _openai;
}

export function getOpenAIClientOrThrow(): OpenAI {
  const client = getOpenAIClientOrNull();
  if (!client) throw Object.assign(new Error("OpenAI unavailable"), { status: 503 });
  return client;
}
