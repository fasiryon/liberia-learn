import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { query } from "@anthropic-ai/claude-agent-sdk";

// ----- CONFIG -----
const REPO_ROOT = path.resolve(process.cwd(), "..", ".."); // back to repo root
const OUT_DIR = path.join(REPO_ROOT, "ScanOut", "reports");
fs.mkdirSync(OUT_DIR, { recursive: true });

const write = (name, text) => {
  fs.writeFileSync(path.join(OUT_DIR, name), text, "utf8");
};

const MASTER_PROMPT = `
You are running a READ-ONLY repo scan for a Next.js + NextAuth + Prisma app called LiberiaLearn.

GOAL:
Produce a Phase-1 demo readiness report for a student-first AI-powered learning platform.

NON-NEGOTIABLES:
- Offline-first mindset
- Low-bandwidth friendliness
- Governance + AJV schema validation must remain
- Student-first UX
- No risky automation; do not modify files

SCOPE:
Scan the entire repository excluding: node_modules, .next, .git, ScanOut.

PRIORITIES:
1) Demo blockers (anything that prevents a clean demo run locally and on Vercel)
   - 404 API routes / route wiring (App Router vs pages/api mismatches)
   - Prisma client initialization/generate issues
   - NextAuth route correctness
   - Build/deploy failures
2) Security & secrets hygiene (verify no hardcoded secrets, dangerous logs, insecure configs)
3) Governance integrity (AJV schema validation correctness, strict mode issues, schema keywords, CI scripts)
4) Student-first UX readiness (is the path Login -> Dashboard -> Lesson Content coherent)
5) Offline/low-bandwidth posture (service worker, caching strategy, minimal payload checks)

OUTPUT REQUIREMENTS:
Create these files in ScanOut/reports:
A) 00-exec-summary.md (top 10 issues, ordered by severity)
B) 01-demo-blockers.md (exact steps to reproduce + likely fix location)
C) 02-route-map.md (table of API routes discovered + expected URL paths)
D) 03-security-review.md (secrets checks + auth/session risks + dependency risks)
E) 04-governance-review.md (AJV schema health + strict-mode compatibility)
F) 05-action-plan.md (fix order, with “do this first” steps)

When you identify an issue, include:
- file path(s)
- why it matters
- how to reproduce
- minimal fix recommendation (no refactors unless required)
`;

async function main() {
  // READ-ONLY: allow only reading + searching + running safe commands.
  // No "Edit" tool permitted.
  const allowed_tools = ["Read", "Glob", "Bash"];

  let transcript = "";
  const log = (chunk) => {
    transcript += chunk;
    process.stdout.write(chunk);
  };

  log(`\n=== LiberiaLearn Read-Only Master Scan ===\nRepo: ${REPO_ROOT}\nOut:  ${OUT_DIR}\n\n`);

  // Important: run from repo root so the agent sees the full project.
  process.chdir(REPO_ROOT);

  for await (const message of query({
    prompt: MASTER_PROMPT,
    options: {
      allowed_tools,
      // Use project settings if you later add CLAUDE.md or .claude/ skills/commands
      settingSources: ["project"],
    },
  })) {
    // message may contain different shapes; stringify defensively
    log(JSON.stringify(message, null, 2) + "\n");
  }

  // Save full transcript for traceability / audit
  write("99-agent-transcript.jsonl", transcript);
  log(`\nSaved transcript: ScanOut/reports/99-agent-transcript.jsonl\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
