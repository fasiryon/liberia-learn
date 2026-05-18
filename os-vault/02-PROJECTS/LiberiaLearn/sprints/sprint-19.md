# Sprint 19 — AI Conversational Tutor

**Status:** Planned
**Priority:** High — major competitive differentiator; closes the "student gets stuck" gap

---

## Goals

1. Per-student AI tutor that can answer questions about any lesson in-context
2. Conversation history stored in DB (last 10 turns for context window management)
3. Content safety filter to keep tutor on-topic
4. Graceful offline fallback message when connectivity is unavailable

---

## Scope

### 1. DB Schema — `TutorConversation` Model

```prisma
model TutorConversation {
  id         String   @id @default(cuid())
  studentId  String
  lessonId   String?  // null = general subject tutor
  subject    String
  grade      Int
  messages   Json     // last 10 turns stored as {role, content, timestamp}[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  student    User     @relation(fields: [studentId], references: [id])

  @@index([studentId, lessonId])
  @@index([studentId, subject])
}
```

**Migration:** `prisma/migrations/20260519_000001_tutor_conversation/migration.sql`

---

### 2. Tutor Engine (`lib/ai/tutor/conversationalTutor.ts`)

```typescript
sendTutorMessage(params: {
  studentId: string;
  schoolId: string;
  lessonId?: string;
  subject: string;
  grade: number;
  userMessage: string;
}): Promise<{ reply: string; conversationId: string; flagged: boolean }>
```

**Context window management:**
- Load existing `TutorConversation` for student+lesson (or create new)
- Keep last 10 turns in `messages` — trim oldest on overflow
- Pass lesson `body_standard` (first 2000 chars) as system context when `lessonId` provided
- Total system prompt budget: 3000 tokens max (lesson context + instructions)

**System prompt structure:**
```
You are a friendly AI tutor for a Grade {grade} student in Liberia.
Subject: {subject}. Lesson: {lessonTitle}.
Lesson context (refer to this to answer questions):
{lessonBodyFirst2000Chars}

Rules:
- Only answer questions related to this lesson and subject.
- If asked about unrelated topics, redirect politely.
- Use simple English appropriate for Grade {grade}.
- Never give direct exam answers — guide the student to think.
- Keep responses under 150 words.
```

**Content safety filter:**
- Block messages containing: profanity list, prompt injection attempts (`ignore previous`, `system:`, `you are now`)
- Flagged messages: return `flagged: true` + canned response ("I can only help with your lesson.")
- Log flagged attempts via `logAudit` (action: "tutor_message_flagged")

**AI routing:**
- Model: Claude Haiku 4.5 (fast, cheap) via `routedCompletion`
- Max tokens: 300 (tutor replies must be concise)
- Feature: "ai_tutor", route: "tutor", requestType: "student_tutor_message"
- Daily budget cap: 500 tutor messages per school per day (configurable via `TUTOR_DAILY_LIMIT` env)

---

### 3. API Routes

**POST `/api/student/tutor/message`**
- Auth: `requireRole("STUDENT")`
- Rate limit: 20 messages per student per hour (protect AI budget)
- Body: `{ lessonId?, subject, grade, message }`
- Returns: `{ reply, conversationId, flagged }`

**GET `/api/student/tutor/history`**
- Auth: student own data only
- Query: `?lessonId=` or `?subject=`
- Returns last 10 turns for the conversation

**DELETE `/api/student/tutor/history`**
- Clears conversation history (student can "start fresh")

---

### 4. UI — Tutor Chat Widget

**Component:** `components/student/TutorChatWidget.tsx`
- Floating button in bottom-right of lesson delivery page
- Opens slide-up panel with chat history
- Shows lesson title as context header
- Input field + send button
- Typing indicator during AI response
- Flag indicator if message was blocked

**Lesson delivery integration:**
- Add `TutorChatWidget` to `components/LessonDeliveryClient.tsx`
- Pass `lessonId`, `subject`, `grade` as props

---

### 5. Offline Fallback

When `navigator.onLine === false` or fetch fails:
- Show: "Your AI tutor is not available offline. Review your lesson notes or ask your teacher when back online."
- No message sent to server
- Cached last 5 messages shown for reference

---

### 6. Teacher Oversight

- Tutor message logs visible to teachers (aggregated — no individual PII in summary)
- `/api/teacher/dashboard` response adds `tutorUsageThisWeek: number` (count of messages in their class)
- No individual message content exposed to teachers (student privacy)

---

## Files Touched

- `prisma/schema.prisma` — add `TutorConversation` model
- `prisma/migrations/20260519_000001_tutor_conversation/migration.sql` — NEW
- `lib/ai/tutor/conversationalTutor.ts` — NEW
- `app/api/student/tutor/message/route.ts` — NEW
- `app/api/student/tutor/history/route.ts` — NEW
- `components/student/TutorChatWidget.tsx` — NEW
- `components/LessonDeliveryClient.tsx` — add TutorChatWidget

## Tests Required

- `__tests__/sprint19.tutor.test.ts` — context window trim, safety filter, budget cap, flagging
- `__tests__/sprint19.tutorApi.test.ts` — rate limit, auth, tenant scoping
