# LiberiaLearn — VSL Script
## Duration: 2 minutes 30 seconds (13 acts)
## Format: Playwright screen recording + ElevenLabs voiceover + CapCut edit
## Last updated: 2026-05-07

---

### ACT 1 — Homepage (0:00 – 0:10)
VISUAL: liberia-learn.vercel.app homepage. Slow scroll to reveal feature cards, then return to top.

VOICEOVER:
"In Liberia, 1.5 million students go to school every day.
Most of their teachers have no way to know who is struggling
until it's too late. LiberiaLearn changes that."

---

### ACT 2 — Student Login (0:10 – 0:20)
VISUAL: Login page. Type email, type password, click Sign In. Dashboard loads.

VOICEOVER:
"A student opens LiberiaLearn.
One login. Everything they need is waiting."

---

### ACT 3 — Today Page (0:20 – 0:32)
VISUAL: Student Today page. Personalised greeting visible. Scroll through scheduled lessons and KPI cards.

VOICEOVER:
"Their day is already planned — lessons scheduled,
progress tracked, nothing to configure.
The platform meets them where they are."

---

### ACT 4 — Open a Lesson (0:32 – 0:47)
VISUAL: Click the first Open button. Lesson page loads with Liberian-contextualised content visible.

VOICEOVER:
"Every lesson is built for Liberia.
Real examples. Local context. Curriculum-aligned."

---

### ACT 5 — Lesson Content & Slides (0:47 – 1:02)
VISUAL: Slow scroll through lesson body — worked examples, illustrations. Switch to Slides tab.

VOICEOVER:
"Students can read the lesson, view it as slides,
or have it read aloud. Multiple learning modes,
one platform."

---

### ACT 6 — AI Tutor (1:02 – 1:12)
VISUAL: Click AI Tutor button. Type a question. Response loads with trust badge visible.

VOICEOVER:
"When they're stuck, the AI tutor steps in.
Not a generic chatbot — grounded in their actual
curriculum, grade, and subject."

---

### ACT 7 — Student Certificates (1:12 – 1:22)
VISUAL: Navigate to /student/certificates. Certificate cards visible. View Certificate link highlighted.

VOICEOVER:
"Complete eighty percent of a subject
and a certificate is awarded automatically.
No button, no waiting — earned and ready to share."

---

### ACT 8 — Teacher Login & Dashboard (1:22 – 1:35)
VISUAL: Sign out. Log in as teacher. Teacher dashboard loads. Alert bell with count visible. Scroll to show class overview.

VOICEOVER:
"Before the first class starts,
the teacher already knows who needs help.
Every student, every subject — one view."

---

### ACT 9 — Student Detail (1:35 – 1:47)
VISUAL: Click My Students. Click a student row. Progress bars, quiz scores, lesson history scroll into view.

VOICEOVER:
"Click any student and see exactly where they are.
Completion rates, quiz scores, lesson history —
not summaries. The actual data."

---

### ACT 10 — Teacher Alerts & Class Intelligence (1:47 – 1:57)
VISUAL: Return to teacher dashboard. Immediate Attention panel visible — flagged students. Class intelligence insights.

VOICEOVER:
"The platform flags students who are at risk
before the teacher has to ask.
Actionable alerts. No spreadsheets."

---

### ACT 11 — MOE Login & National Dashboard (1:57 – 2:08)
VISUAL: Sign out. Log in as MOE Official. National dashboard loads. KPI cards: active students, completion rate, county breakdown.

VOICEOVER:
"At the Ministry of Education, officials see
the whole picture —
across every county, every grade, every subject."

---

### ACT 12 — District Data & Curriculum Intelligence (2:08 – 2:22)
VISUAL: Scroll through Montserrado data, school comparison table. Navigate to curriculum health page — alignment coverage, weak subjects flagged.

VOICEOVER:
"No individual student data.
Just the signals that matter for national decisions —
where the curriculum is working, where it isn't."

---

### ACT 13 — Homepage CTA (2:22 – 2:30)
VISUAL: Return to homepage. CTA button visible. Slow pull back. Platform name holds on screen.

VOICEOVER:
"LiberiaLearn. Built for Liberia.
Ready for real schools.
Access the platform today."

---

## Recording Instructions
- Run: `npx playwright test e2e/vsl-recording.spec.ts --headed --video=on --timeout=300000`
- Video saved to: `playwright-report/videos/`
- Convert webm to mp4: `ffmpeg -i video.webm -c:v libx264 output.mp4`
- Upload to YouTube as unlisted
- Replace VIDEO_ID in `app/page.tsx` with video ID

## Voiceover Instructions
- Go to elevenlabs.io
- Paste each act's VOICEOVER block above
- Recommended voice: Rachel or Adam
- Export per act as MP3
- Sync with screen recording in CapCut — cut to act timestamps
