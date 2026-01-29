# 🇱🇷 LiberiaLearn

> **A national K-12 learning platform for Liberia — teacher-first, mastery-based, and low-bandwidth.**

---

## 🌍 Vision

LiberiaLearn is a **Grade 1–12 national education system** built to elevate Liberia’s academic standards to match those of Japan, Korea, and China.  
It emphasizes **STEM mastery** while maintaining full coverage of literacy, civics, arts, and career readiness.

---

## 🎯 Mission

To produce **Africa’s most STEM-driven workforce** through technology, local language inclusion, and world-class pedagogy — ensuring every Liberian student can learn, even on low-cost Android devices or offline.

---

## 📘 Core Principles

- **Teacher-first design** – educators lead, AI assists  
- **Mastery-based progression** – ≥ 85 % required to advance  
- **Localized bilingual content** – English-LR + Koloqua  
- **Low-bandwidth & offline-first** – works in rural areas  
- **Data-driven improvement** – adaptive lessons & analytics  

---

## ⚙️ Tech Stack

| Layer | Tools / Frameworks |
|-------|--------------------|
| **Frontend** | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| **Backend** | Postgres (Supabase / Neon) + Prisma ORM |
| **Auth** | NextAuth (email + password) → upgrade path to National Edu-ID |
| **Testing** | Playwright + Vitest / Jest |
| **Validation & Security** | Zod schema validation + rate-limited auth |
| **Locale & PWA** | Africa/Monrovia timezone · Offline shell · Data-Saver mode |

---

## 🧱 Repository Structure

/app → Next.js routes & pages
/components → Reusable UI blocks (PascalCase)
/lib → Utilities & configs
/prisma → Schema & migrations
/curriculum → Lesson modules by grade
/locales → en-LR and Koloqua files
/scripts → Seeds & setup automation
/docs → Specifications and educator resources


---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/<your-username>/LiberiaLearn.git
cd LiberiaLearn

# 2. Install
npm install

# 3. Configure Environment
cp .env.example .env.local

# 4. Migrate Database
npx prisma migrate dev

# 5. Run Dev Server
npm run dev
