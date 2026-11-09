// Only workstation variables survive. No production credentials, provider keys or remote URLs are inherited.
const cp = require("node:child_process"), fs = require("node:fs"), path = require("node:path");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SystemRoot|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramFiles|ProgramFiles\(x86\)|ProgramData|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key)));
Object.assign(env, { DATABASE_URL: "postgresql://preview_test:preview_local_only@127.0.0.1:55447/draft6_preview_validation",
  DIRECT_URL: "postgresql://preview_test:preview_local_only@127.0.0.1:55447/draft6_preview_validation",
  SHADOW_DATABASE_URL: "postgresql://preview_test:preview_local_only@127.0.0.1:55447/draft6_preview_validation",
  NEXTAUTH_SECRET: "draft6-isolated-test-only-secret-2026", NEXTAUTH_URL: "http://127.0.0.1:3046",
  NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--max-old-space-size=8192", LL_PREVIEW_DB_TEST: "1",
  V4_LEARNING_PREVIEW_ENABLED: "0", LIBERIALEARN_BUILD_CPUS: "1" });
Object.assign(env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: process.cwd(),
  GIT_CONFIG_KEY_1: "safe.directory", GIT_CONFIG_VALUE_1: `${process.cwd()}/*` });
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (fs.existsSync(name)) throw Error(`isolated_validation_refuses_environment_file:${name}`);
}
const modes = {
  tests: ["node_modules/vitest/vitest.mjs", "run", "--reporter=dot"],
  focused: ["node_modules/vitest/vitest.mjs", "run", "__tests__/content-factory-v4", "--reporter=verbose"],
  scheduled: ["node_modules/vitest/vitest.mjs", "run", "__tests__/content-factory-v4/pilot-preview-db.test.ts", "__tests__/content-factory-v4/pilot-day.test.ts", "--maxWorkers=1", "--no-file-parallelism"],
  recovery: ["node_modules/vitest/vitest.mjs", "run", "__tests__/audit-immutability.test.ts", "__tests__/pre-p2a.canonical-baseline.test.ts",
    "__tests__/interactive-labs/determinism.test.ts", "__tests__/interactive-labs/renderer-chunks.test.ts", "__tests__/content-factory-v4/pilot-preview-route.test.ts"],
  types: ["node_modules/typescript/bin/tsc", "--noEmit"],
  generate: ["node_modules/prisma/build/index.js", "generate"],
  build: ["node_modules/next/dist/bin/next", "build"],
  changed: ["scripts/validate-changed.mjs", ...process.argv.slice(3)],
  security: ["scripts/audit-api-route-policies.mjs"],
  vault: ["--test", "os-vault/daemon/context.node-test.mjs"],
  renderer: ["node_modules/tsx/dist/cli.mjs", "scripts/labs/check-next-renderer-chunk.ts"],
  pwa: ["node_modules/@playwright/test/cli.js", "test", "e2e/p5c-pwa-lifecycle.spec.ts", "e2e/p5e-offline-hardening.spec.ts"],
  fixtures: ["e2e/product-design-v2/run.mjs"],
  dev: ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3046"],
  start: ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3046"],
};
const mode = process.argv[2], args = modes[mode];
if (!args) throw Error("unknown_validation_mode");
if (mode === "tests") env.LL_PREVIEW_DB_TEST = "0"; // Real DB suite runs separately to avoid shared-fixture races.
if (mode === "pwa") env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3046";
if (mode === "dev" || mode === "start") env.V4_LEARNING_PREVIEW_ENABLED = "1"; // Synthetic local test server only.
const directory = path.join("artifacts", "draft6-pilot-validation");
fs.mkdirSync(directory, { recursive: true });
const stream = fs.createWriteStream(path.join(directory, `${mode}.log`));
const child = cp.spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", data => { process.stdout.write(data); stream.write(data); });
child.stderr.on("data", data => { process.stderr.write(data); stream.write(data); });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { stream.end(); process.exitCode = code ?? 1; });
