# Screenshot Placeholders

This folder is intentionally documentation-only. Do not add generated or fake screenshots here.

Planned real screenshots to capture later:
- `teacher-dashboard.png`
- `student-tutor.png`
- `guardian-progress.png`
- `pilot-readiness.png`

Capture instructions:
1. Run the app with production-like flags enabled for the relevant surface.
2. Seed or prepare demo-safe data with `npm run seed:demo` only in a non-production environment.
3. Log in with a demo-safe role.
4. Capture the UI at desktop width first, then verify mobile behavior separately.
5. Redact or avoid any PII before storing the image in this folder.
6. Name the file exactly as listed above so README links remain stable.

Suggested source screens:
- teacher dashboard: [app/teacher/intelligence/page.tsx](C:\Users\fasir\liberia-learn\app\teacher\intelligence\page.tsx)
- student tutor: [app/api/student/tutor/route.ts](C:\Users\fasir\liberia-learn\app\api\student\tutor\route.ts) plus the student-facing tutor UI that consumes it
- guardian progress: [app/guardian/progress/page.tsx](C:\Users\fasir\liberia-learn\app\guardian\progress\page.tsx)
- pilot readiness: [app/admin/pilot-readiness/page.tsx](C:\Users\fasir\liberia-learn\app\admin\pilot-readiness\page.tsx)
