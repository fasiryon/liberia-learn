import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { z } from "zod";
import { getWaecSubject, type WaecSubjectId } from "@/lib/waec/syllabus";

export const WAEC_PRACTICE_COOKIE = "waec_practice_attempt";
export const WAEC_PRACTICE_TTL_SECONDS = 2 * 60 * 60;
const MAX_QUESTIONS = 12;
const MAX_TOKEN_LENGTH = 4096;

export type PracticeContext = {
  userId: string;
  studentId: string;
  schoolId: string;
  subjectId: WaecSubjectId;
  grade: number;
};

const itemSchema = z.object({
  id: z.string().min(1).max(200), subjectId: z.string().min(1).max(100),
  topicId: z.string().min(1).max(200), grade: z.number().int().min(9).max(12),
  prompt: z.string().min(1).max(4000), options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3), explanation: z.string().nullable(),
});
export type PracticeGradingItem = z.infer<typeof itemSchema>;

const claimsSchema = z.object({
  purpose: z.literal("waec.practice.v1"), attemptId: z.string().uuid(),
  userId: z.string().min(1).max(200), studentId: z.string().min(1).max(200),
  schoolId: z.string().min(1).max(200), subjectId: z.string().min(1).max(100),
  grade: z.number().int().min(9).max(12), issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  items: z.array(z.object({ id: z.string().min(1).max(200), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(MAX_QUESTIONS),
}).strict();
export type PracticeClaims = z.infer<typeof claimsSchema>;

const answersSchema = z.array(z.object({
  id: z.string().min(1).max(200), chosen: z.number().int().min(0).max(3).nullable(),
}).strict()).min(1).max(MAX_QUESTIONS);

export function practiceError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function signingSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret?.trim()) throw practiceError(503, "Practice is temporarily unavailable. Please try again later.");
  return secret;
}
export function assertPracticeSigningAvailable() { signingSecret(); }

function mac(domain: string, value: string) {
  return createHmac("sha256", signingSecret()).update(domain).update("\0").update(value).digest();
}

function fingerprint(item: PracticeGradingItem) {
  // A keyed digest cannot be brute-forced from the four possible answer keys.
  return mac("liberialearn.waec.item.v1", JSON.stringify([
    item.id, item.subjectId, item.topicId, item.grade, item.prompt,
    item.options, item.correctIndex, item.explanation,
  ])).toString("hex");
}

export function validatePracticeItems(values: unknown[], context: PracticeContext, ids: string[]) {
  const parsed = z.array(itemSchema).min(1).max(MAX_QUESTIONS).safeParse(values);
  const subject = getWaecSubject(context.subjectId);
  const allowedTopics = new Set(subject?.topics.filter(topic => topic.strands.length > 0).map(topic => topic.id));
  if (!parsed.success || !subject || !context.schoolId || new Set(ids).size !== ids.length || parsed.data.length !== ids.length) {
    throw practiceError(409, "Practice questions changed. Reload to start a new attempt.");
  }
  const byId = new Map(parsed.data.map(item => [item.id, item]));
  if (byId.size !== ids.length || !ids.every(id => byId.has(id)) || parsed.data.some(item =>
    item.subjectId !== context.subjectId || item.grade !== context.grade || !allowedTopics.has(item.topicId))) {
    throw practiceError(409, "Practice questions changed. Reload to start a new attempt.");
  }
  return parsed.data;
}

export function issuePracticeSession(context: PracticeContext, items: PracticeGradingItem[]) {
  const now = Date.now();
  const claims = claimsSchema.parse({
    purpose: "waec.practice.v1", attemptId: randomUUID(), ...context,
    issuedAt: now, expiresAt: now + WAEC_PRACTICE_TTL_SECONDS * 1000,
    items: items.map(item => ({ id: item.id, fingerprint: fingerprint(item) })),
  });
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const token = `${payload}.${mac("liberialearn.waec.attempt.v1", payload).toString("base64url")}`;
  if (token.length > MAX_TOKEN_LENGTH) throw practiceError(503, "Practice is temporarily unavailable. Please try again later.");
  return token;
}

export function openPracticeSession(token: string, context: PracticeContext): PracticeClaims {
  const invalid = () => practiceError(400, "This practice attempt expired or is invalid. Reload to start a new attempt.");
  if (!token || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw invalid();
  const [payload, signature] = token.split(".");
  const expected = mac("liberialearn.waec.attempt.v1", payload);
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalid();
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw invalid(); }
  const parsed = claimsSchema.safeParse(decoded);
  if (!parsed.success) throw invalid();
  const claims = parsed.data;
  const now = Date.now();
  if (claims.expiresAt <= now || claims.issuedAt > now + 5000 || claims.expiresAt - claims.issuedAt > WAEC_PRACTICE_TTL_SECONDS * 1000 ||
    claims.userId !== context.userId || claims.studentId !== context.studentId || claims.schoolId !== context.schoolId ||
    claims.subjectId !== context.subjectId || claims.grade !== context.grade || new Set(claims.items.map(item => item.id)).size !== claims.items.length) throw invalid();
  return claims;
}

export function validatePracticeAnswers(value: unknown, claims: PracticeClaims) {
  const parsed = answersSchema.safeParse(value);
  if (!parsed.success) throw practiceError(400, "Invalid practice answers.");
  const ids = new Set(parsed.data.map(answer => answer.id));
  if (ids.size !== parsed.data.length || ids.size !== claims.items.length || !claims.items.every(item => ids.has(item.id))) {
    throw practiceError(400, "Answers must match the issued practice questions exactly.");
  }
  return parsed.data;
}

export function verifyPracticeRevisions(items: PracticeGradingItem[], claims: PracticeClaims) {
  const byId = new Map(items.map(item => [item.id, item]));
  for (const binding of claims.items) {
    const item = byId.get(binding.id);
    if (!item || !timingSafeEqual(Buffer.from(binding.fingerprint, "hex"), Buffer.from(fingerprint(item), "hex"))) {
      throw practiceError(409, "Practice questions changed. Reload to start a new attempt.");
    }
  }
}

export function practiceReceiptId(claims: PracticeClaims) {
  return "waec.practice.v1:" + createHash("sha256").update("waec.practice.receipt.v1\0").update(claims.attemptId).digest("hex");
}
