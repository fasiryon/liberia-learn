import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const skipTypes = args.includes("--no-types");
const explicitBaseIndex = args.findIndex((arg) => arg === "--base");
const inlineBase = args.find((arg) => arg.startsWith("--base="))?.slice("--base=".length);
const explicitBase = inlineBase || (explicitBaseIndex >= 0 ? args[explicitBaseIndex + 1] : undefined);

function run(command, commandArgs, options = {}) {
  const localToolEntries = {
    prisma: "node_modules/prisma/build/index.js",
    vitest: "node_modules/vitest/vitest.mjs",
    tsc: "node_modules/typescript/bin/tsc",
  };
  const localTool = command === "npx" ? commandArgs[0] : undefined;
  const localEntry = localTool ? localToolEntries[localTool] : undefined;
  if (command === "npx" && (!localEntry || !existsSync(localEntry))) {
    throw new Error(`validate:changed requires installed local tool: ${localTool ?? "unknown"}`);
  }
  const executable = localEntry ? process.execPath : command;
  const finalArgs = localEntry ? [localEntry, ...commandArgs.slice(1)] : commandArgs;
  const result = spawnSync(executable, finalArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: localTool === "tsc"
      ? { ...process.env, NODE_OPTIONS: process.env.VALIDATE_CHANGED_NODE_OPTIONS ?? "--max-old-space-size=8192" }
      : process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr || result.stdout || "");
    }
    process.exit(result.status ?? 1);
  }
  return options.capture ? result.stdout.trim() : "";
}

function git(commandArgs) {
  return run("git", commandArgs, { capture: true });
}

function lines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function collectChangedFiles() {
  if (explicitBase) {
    const mergeBase = git(["merge-base", explicitBase, "HEAD"]);
    return {
      source: `${explicitBase}...HEAD`,
      files: lines(git(["diff", "--name-only", "--diff-filter=ACMR", `${mergeBase}...HEAD`])),
      diffCheck: [`${mergeBase}...HEAD`],
    };
  }

  const worktree = lines(git(["diff", "--name-only", "--diff-filter=ACMR"]));
  const staged = lines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]));
  const untracked = lines(git(["ls-files", "--others", "--exclude-standard"]));
  const local = unique([...worktree, ...staged, ...untracked]);
  if (local.length > 0) {
    return { source: "working tree and index", files: local, diffCheck: null };
  }

  const hasParent = spawnSync("git", ["rev-parse", "--verify", "HEAD^"], {
    cwd: process.cwd(),
    stdio: "ignore",
  }).status === 0;
  if (!hasParent) return { source: "HEAD", files: [], diffCheck: null };
  return {
    source: "HEAD^...HEAD",
    files: lines(git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD^", "HEAD"])),
    diffCheck: ["HEAD^", "HEAD"],
  };
}

const changed = collectChangedFiles();
const files = changed.files.filter((file) => existsSync(file));
const schemaChanged = files.some((file) =>
  file === "prisma/schema.prisma" ||
  file === "prisma/canonical/schema.prisma" ||
  file.startsWith("prisma/migrations/") ||
  file.startsWith("prisma/canonical/migrations/")
);
const typeScriptChanged = files.some((file) => /\.[cm]?tsx?$/.test(file));
const changedJavaScript = files.filter((file) => /\.[cm]?js$/.test(file));
const changedTests = files.filter((file) =>
  /^(?:__tests__|tests|e2e)\//.test(file.replaceAll("\\", "/")) && /\.[cm]?[jt]sx?$/.test(file)
);
const relatedSources = files.filter((file) =>
  /\.[cm]?[jt]sx?$/.test(file) &&
  !/^(?:__tests__|tests|e2e|scripts)\//.test(file.replaceAll("\\", "/"))
);

console.log(`validate:changed source: ${changed.source}`);
console.log(`validate:changed files: ${files.length}`);
for (const file of files) console.log(`  ${file}`);

if (listOnly) process.exit(0);

if (changed.diffCheck) run("git", ["diff", "--check", ...changed.diffCheck]);
else {
  run("git", ["diff", "--check"]);
  run("git", ["diff", "--cached", "--check"]);
}

if (schemaChanged) {
  run("npx", ["prisma", "validate"]);
  run("npx", ["prisma", "generate"]);
}

if (changedTests.length > 0) {
  run("npx", ["vitest", "run", ...changedTests]);
}
if (relatedSources.length > 0) {
  run("npx", ["vitest", "related", "--run", "--passWithNoTests", ...relatedSources]);
}

for (const file of changedJavaScript) {
  run(process.execPath, ["--check", file]);
}

if (typeScriptChanged && !skipTypes) {
  run("npx", [
    "tsc",
    "--noEmit",
    "--incremental",
    "--tsBuildInfoFile",
    ".next/cache/validate-changed.tsbuildinfo",
  ]);
}

console.log("validate:changed PASS");
