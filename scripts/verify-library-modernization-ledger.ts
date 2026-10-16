/**
 * Verifies the committed modernization ledger without the extract or a database: replays every event,
 * checking the hash chain, sequence and every authority rule, then confirms that the committed state and
 * tracker answers equal the replay.
 *
 *   npx tsx scripts/verify-library-modernization-ledger.ts
 */
import fs from "fs";
import { LEDGER_FILE, MODERNIZATION_DIR } from "@/lib/curriculum/modernization/build";
import { answerLedgerQuestions, readLedgerFile } from "@/lib/curriculum/modernization/ledger";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";

const ledger = readLedgerFile(LEDGER_FILE);
const answers = answerLedgerQuestions(ledger);
const state = JSON.parse(fs.readFileSync(`${MODERNIZATION_DIR}/ledger/state.json`, "utf8")) as { head: string; events: number; answers: unknown };
const problems: string[] = [];
if (state.head !== ledger.head) problems.push(`state.json head ${state.head} != replay ${ledger.head}`);
if (state.events !== ledger.events.length) problems.push(`state.json events ${state.events} != replay ${ledger.events.length}`);
if (canonicalizeJson(state.answers) !== canonicalizeJson(answers)) problems.push("state.json answers differ from replay");
console.log(JSON.stringify({ events: ledger.events.length, head: ledger.head, answers, problems }, null, 2));
if (problems.length) process.exitCode = 1;
