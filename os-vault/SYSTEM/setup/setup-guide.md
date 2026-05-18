# Operating System Setup Guide

## What You Need
1. **Obsidian** — open `os-vault/` as a vault
2. **N8N** — self-hosted on any always-on server ($5/mo DigitalOcean droplet works)
3. **Anthropic API key** — for automated workflow API calls (already in your .env.local)
4. **Obsidian Smart Connections plugin** — for semantic search within Obsidian

## Step 1 — Obsidian Setup
1. Install Obsidian from obsidian.md
2. Open Obsidian → "Open folder as vault" → select the `os-vault/` folder inside `liberia-learn/`
3. Install plugins: Smart Connections, Dataview, Calendar
4. In Smart Connections settings, set to use Claude API (your ANTHROPIC_API_KEY)

## Step 2 — N8N Setup

**Option A: Local Docker**
```bash
docker run -d -p 5678:5678 --name n8n \
  -e N8N_HOST=localhost \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

**Option B: N8N Cloud** — n8n.io (managed, no server needed)

Add credentials in N8N:
- `ANTHROPIC_API_KEY` — from your .env.local
- `VAULT_PATH` — absolute path to the `os-vault/` folder on your machine

## Step 3 — Wire the Workflows

Import each workflow stub from `SYSTEM/setup/n8n-workflows/`.
For each workflow, update:
- `VAULT_PATH` → absolute path on your machine (e.g., `C:\Users\fasir\liberia-learn\os-vault`)
- `ANTHROPIC_API_KEY` → your key from .env.local
- `ANTHROPIC_MODEL` → `claude-sonnet-4-20250514` (set in ANTHROPIC_CANVA_MODEL env)
- Cron schedule → adjust timezone to **WAT (West Africa Time, UTC+1)**

## Step 4 — Schedules

| Workflow | Schedule | Timezone |
|---|---|---|
| Daily Project Pulse | 6:00 AM daily | WAT (UTC+1) |
| Weekly OS Review | Sunday 8:00 PM | WAT |
| Queue Processor | Every 15 minutes | WAT |

## Step 5 — First Run
1. Update `SYSTEM/CLAUDE.md` → Weekly Focus section (2 minutes)
2. Fill in `01-CLIENTS/MOE/overview.md` with MOE contact details
3. Fill in financial targets in `SYSTEM/CLAUDE.md` → Financial Framework section
4. Drop a test file in QUEUE/ → `RESEARCH-liberia-edtech-landscape.md`
5. Run workflow 06 manually — confirm output appears in `GENERATED/briefings/`

## How to Use QUEUE/

Drop a file in `QUEUE/` with the right naming pattern. N8N watches the folder (every 15 min) and processes it.

| File name | What it triggers |
|---|---|
| `RESEARCH-[topic].md` | Workflow 06: Deep research |
| `DRAFT-[type]-[topic].md` | Draft generation |
| `AUDIT-[scope].md` | Workflow 03: Security audit |
| `SPRINT-REVIEW-[N].md` | Workflow 04: Sprint close |
| `BRIEF-MOE-[date].md` | Workflow 02: MOE meeting brief |

## Maintenance Rhythm
- **Every Monday morning (2 min):** Update Weekly Focus in `SYSTEM/CLAUDE.md`
- **Every sprint close:** Drop `SPRINT-REVIEW-[N].md` in QUEUE/
- **Before MOE meetings:** Drop `BRIEF-MOE-[date].md` in QUEUE/ (2 days before)
- **Monthly:** Read `05-REVIEWS/monthly/` — copy insights to `04-RESEARCH/` if useful

## Paste-at-Session-Start Pattern

Instead of re-explaining the project each Claude session, paste this at the top:

```
Context: Read os-vault/SYSTEM/CLAUDE.md for full project context.
Today's pulse: [paste latest GENERATED/briefings/YYYY-MM-DD-project-pulse.md]
```

This gives Claude full context in ~300 tokens instead of re-deriving it from scratch.
