National browser certification checks for LiberiaLearn.

What to verify manually:

1. Student lessons
Open a student lesson page.
Scroll into the lesson body, then refresh.
Confirm the page restores near the previous scroll position or saved section.
Complete the exit ticket.
Confirm the saved lesson-progress session state is cleared after successful completion.

2. Student exams
Open a student exam.
Answer at least one question and move forward.
Refresh the page.
Confirm answers, current question, and timer start state are restored.
Submit the exam.
Confirm the saved exam session is cleared after submission.

3. Offline lesson support
Load a student lesson while online.
Disconnect the browser network.
Refresh the lesson route.
Confirm the lesson shell still loads from cache or the offline fallback page appears cleanly.
Confirm `/api/*` requests are not intercepted by the service worker.

4. Assignment workflow
Teacher creates an assignment from `/teacher/assignments/new`.
Student opens the assignment and submits work from the assignment page.
Teacher grades the submission.
If guardian notification delivery fails, confirm the grading flow still succeeds.

5. Global assistant
Open the assistant on a supported page.
Set subject and grade context.
Refresh the page.
Confirm the assistant restores the saved subject and grade context without crashing.

Known limits:

- This certification does not prove real-device push sync.
- Offline replay still depends on browser support for Service Worker, Cache Storage, and IndexedDB.
- Sentry/browser observability depends on DSN configuration from the observability wave.
