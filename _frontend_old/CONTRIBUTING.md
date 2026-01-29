# Contributing to LiberiaLearn

> **Version:** 1.0  
> **Maintainer:** LiberiaLearn Core Team  
> **Last Updated:** 2025-10-24  
> **Applies To:** All developers, educators, and content contributors  

---

## 1. Core Principles

- **Teacher-first:** Always prioritize the educator experience before adding new student-facing features.  
- **Low-bandwidth:** Code, images, and data should perform well on 3G Android devices.  
- **Mastery-based:** Every module must support ≥ 85 % mastery before progression.  
- **Cursor alignment:** Cursor AI must follow `/rules.md` for stack, folder layout, and pedagogy.

---

## 2. Branch Naming

| Purpose | Pattern | Example |
|----------|----------|---------|
| Feature  | `feature/<area>-<short-description>` | `feature/g7-math-quiz` |
| Fix      | `fix/<area>-<issue>` | `fix/auth-token-expiry` |
| Docs     | `docs/<section>` | `docs/api-guide` |
| Refactor | `refactor/<module>` | `refactor/ui-components` |

> 🧠 *Tip:* Branch names are lowercase with hyphens — no spaces, no underscores.

---

## 3. Commit Messages

Follow **Conventional Commits** for clarity:

feat: add G7 algebra quiz module
fix: correct login redirect for NextAuth
docs: update setup instructions for Supabase
refactor: simplify curriculum schema
chore: update dependencies


Each commit should represent **one logical change**.

---

## 4. Pull Request (PR) Workflow

1. **Sync main**
   ```bash
   git checkout main
   git pull origin main
