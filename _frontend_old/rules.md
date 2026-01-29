# LiberiaLearn Global Rules

> **Version:** 1.0  
> **Maintainer:** LiberiaLearn Core Team  
> **Last Updated:** 2025-10-24  
> **Applies To:** All developers, educators, designers, and contributors  

---

## 1. Mission & Vision

- **Mission:** Build Liberia’s national K-12 learning platform — teacher-first, mastery-based, and low-bandwidth (English-LR & Koloqua).  
- **Vision:** Produce Africa’s best STEM-driven workforce, matching Japan, Korea, and China in academic rigor and results.

---

## 2. Tech Stack

- **Frontend:** Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui  
- **Backend:** Postgres (Supabase or Neon) + Prisma ORM  
- **Auth:** NextAuth (email + password) with upgrade path to national Edu-ID  
- **Locale:** Africa/Monrovia (default). Text in en-LR; optional Koloqua translation file.  
- **PWA:** Offline shell, data-saver toggle, minimal images — optimized for low-end Android devices.

---

## 3. Directory Layout
/app
/components
/lib
/prisma
/curriculum
/locales
/scripts


**Purpose guide**

| Folder | Purpose |
|---------|----------|
| `/app` | Main Next.js routes & pages |
| `/components` | Reusable UI (PascalCase) |
| `/lib` | Utilities, configs |
| `/prisma` | Schema & migrations |
| `/curriculum` | Structured lessons by grade |
| `/locales` | Language files (en-LR, Koloqua) |
| `/scripts` | Seeds, setup automation |

---

## 4. Naming Conventions

- Files/folders → **kebab-case** (`lesson-card.tsx`)  
- Components/classes → **PascalCase** (`StudentProfile.tsx`)  
- Variables → **camelCase** (`studentScore`)  
- Database → **snake_case** (`student_assignments`)

---

## 5. Testing & Security

- **Testing:** Playwright smoke tests → login → attendance → assignment → quiz → mastery report  
- **Security:**  
  - Zod validation on all API routes  
  - Rate-limit auth endpoints  
  - Never log/store PII  

---

## 6. Curriculum Focus (Grades 1-12)

- **Core:** STEM (Math, Science, Technology, Engineering)  
- **Foundational:** Literacy + Civics + Arts + Career Skills  
- **Integration:** Cross-grade progression & mastery tracking  

---

## 7. Pedagogy Guidelines

- Mastery learning ≥ 85 % to advance  
- High practice density  
- Spaced review & retention loops  
- Step-by-step problem-solving  
- Offline readiness (cached PWA)  

---

## 8. Deliverables

- `README.md` – setup guide  
- `.env.example` – environment template  
- `seed scripts` – for curriculum/users  
- **Sample curriculum:**  
  - G1 → Math & Reading  
  - G7 → Algebra  
  - G10 → Physics  
- **Mastery Report Prototype** – teacher dashboard data viz  

---

## 9. Code Quality & Review

- All PRs must pass lint, type, & test checks  
- Use semantic commits (`feat:`, `fix:`, `refactor:`)  
- Document APIs in `/docs` when added  

---

## 10. Future Upgrade Paths

- National **Edu-ID** integration  
- AI-powered **learning recommendations** (AWS Bedrock / Vertex AI)  
- Open-curriculum API for regional developers  



