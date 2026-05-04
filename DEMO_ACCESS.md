# LiberiaLearn Demo Access

Use these accounts for review walkthroughs on `https://liberia-learn.vercel.app`.

| Role | Email | Password | Landing page | First click | Available walkthrough data |
|---|---|---|---|---|---|
| Student | `<E2E_DEMO_STUDENT_EMAIL>` | `<DEMO_PASSWORD>` | `/dashboard` | Open `/student/today`, then `Ratios in Market Prices` | Seeded lesson at `/student/lessons/cha-demo-student1-multimedia-lesson`, Read/Slides/Listen modes, exams, certificates, textbooks hub, labs, progress |
| Teacher | `<E2E_DEMO_TEACHER_EMAIL>` | `<DEMO_PASSWORD>` | `/teacher` | Open Curriculum, then `Ratios in Market Prices` | CHA Grade 9A class, seeded lesson management, lesson planning, assignments, video upload and active toggle |
| Guardian | `<E2E_DEMO_GUARDIAN_EMAIL>` | `<DEMO_PASSWORD>` | `/guardian` | Open the linked student card | Linked to Fatu Kollie, progress summaries, placement and activity data |
| School Admin | `<E2E_DEMO_ADMIN_EMAIL>` | `<DEMO_PASSWORD>` | `/admin` | Open Curriculum, then Analytics | CHA school dashboard, curriculum library, audio generation tools, school-scoped multimedia analytics |
| Platform Admin | `platform.admin@liberialearn.org` | `<DEMO_PASSWORD>` | `/platform` | Open Schools or Demo | Cross-school platform console and operational review surfaces |
| MOE Official | `<E2E_DEMO_MOE_EMAIL>` | `<DEMO_MOE_PASSWORD>` | `/moe/dashboard` | Review Lesson Mode Usage | National aggregate dashboard, delivery compliance, exam statistics, multimedia analytics, exports |

## Stable Seeded Lesson

- Student: `<E2E_DEMO_STUDENT_EMAIL>`
- Lesson title: `Ratios in Market Prices`
- Content ID: `cha-g9-math-multimedia-demo`
- Scheduled work ID: `cha-demo-student1-multimedia-lesson`
- Direct path: `/student/lessons/cha-demo-student1-multimedia-lesson`
- Recreate: `npm run seed:cha`

The CHA seed also creates a published Grade 9 ratios exam, a lesson certificate for the student, and seeded multimedia learning events so admin and MOE analytics are populated for a first review.
