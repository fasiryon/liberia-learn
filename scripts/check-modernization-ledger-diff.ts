/**
 * Reports what the working tree does to the modernization ledger relative to a base ref, for MergeOps
 * and human reviewers. Exit 0: no change or automated append-only. Exit 2: escalate (human or authority
 * events). Exit 1: reject (history rewritten or deleted, or replay fails).
 *
 *   npx tsx scripts/check-modernization-ledger-diff.ts [baseRef=origin/main]
 *
 * Needs the base ref's ledger file in git history; a base without the ledger counts as empty.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import { LEDGER_FILE } from "@/lib/curriculum/modernization/build";
import { diffLedger } from "@/lib/curriculum/modernization/ledgerDiffGuard";
import type { LedgerEvent } from "@/lib/curriculum/modernization/ledger";

const baseRef = process.argv[2] ?? "origin/main";
const parse = (text: string) => text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as LedgerEvent);
let baseText = "";
try { baseText = execFileSync("git", ["show", `${baseRef}:${LEDGER_FILE}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { baseText = ""; }
const head = fs.existsSync(LEDGER_FILE) ? parse(fs.readFileSync(LEDGER_FILE, "utf8")) : [];
const report = diffLedger(parse(baseText), head);
console.log(JSON.stringify({ baseRef, ...report }, null, 2));
process.exitCode = report.verdict === "REJECT" ? 1 : report.verdict === "ESCALATE_HUMAN_AUTHORITY_EVENTS" ? 2 : 0;
