import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSupabaseDatabaseTarget } from "../lib/database-target";

const BRANCH = "codex/p2b-qualified-review-operations";
const STAGING_REF: string = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF: string = "bnphuinpvgpmebcsvmsp";
const ALLOWED = new Set([
  "DATABASE_URL",
  "ENABLE_MOE_LOGIN_PORTAL",
  "ENABLE_MOE_PORTAL",
  "GROQ_API_KEY",
  "NEXTAUTH_SECRET",
  "NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "OPENAI_API_KEY",
  "SENTRY_AUTH_TOKEN",
  "STAGING_SUPABASE_PROJECT_REF",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
]);

function parse(path: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values.set(match[1], value);
  }
  return values;
}

function add(key: string, value: string): void {
  if (!value) return;
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  const result = spawnSync(command, ["env", "add", key, "preview", BRANCH, "--yes"], { input: `${value}\n`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
  if (result.status !== 0 && !/already exists/i.test(`${result.stdout}\n${result.stderr}`)) {
    throw new Error(`Unable to configure ${key}: ${result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? `exit ${String(result.status)}`}`);
  }
  console.log(`${key}: ${result.status === 0 ? "configured" : "already configured"}`);
}

const envFile = resolve(process.env.P2A_STAGING_DEPLOYMENT_ENV_FILE ?? "");
if (!envFile) throw new Error("P2A_STAGING_DEPLOYMENT_ENV_FILE is required");
const values = parse(envFile);
const databaseUrl = values.get("DATABASE_URL");
if (!databaseUrl) throw new Error("Staging deployment DATABASE_URL is missing");
const target = parseSupabaseDatabaseTarget(databaseUrl, "staging deployment DATABASE_URL");
if (target.projectRef !== STAGING_REF || target.projectRef === PRODUCTION_REF || target.mode !== "transaction-pooler") throw new Error("Deployment database is not approved staging");
if (values.get("STAGING_SUPABASE_PROJECT_REF") !== STAGING_REF) throw new Error("Deployment project ref is not approved staging");

for (const key of ALLOWED) add(key, values.get(key) ?? "");
add("P2B_REVIEW_OPERATIONS_ENABLED", "false");
add("P2B_REVIEW_SHADOW_ENABLED", "false");
console.log(`P2-B Vercel preview environment configured for ${BRANCH}`);
