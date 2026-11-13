/** Source contract + real local BuildKit secret transport and PostgreSQL runtime injection.
 * Uses only the already-cached pgvector image, a random synthetic canary, and the
 * existing loopback database. This is NOT a full application-image build.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_27_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec27_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_27_DB_TEST === "1" && !admitted) throw Error("SEC-27 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-27 native build secret and runtime database contract", () => {
  const source = readFileSync("Dockerfile", "utf8");
  const ignore = readFileSync(".dockerignore", "utf8").split(/\r?\n/).map(line => line.trim());
  const keys = ["DATABASE_URL", "DIRECT_URL", "NEXTAUTH_SECRET", "SENTRY_AUTH_TOKEN"];
  const docker = "C:/Program Files/Docker/Docker/resources/bin/docker.exe";
  const canary = randomUUID();
  let db: PrismaClient; let probe: { image: string; context: string } | undefined; let dockerContext: string | undefined;
  const run = (args: string[], extraEnv: Record<string, string> = {}) => execFileSync(docker, dockerContext ? ["--context", dockerContext, ...args] : args, { encoding: "utf8", windowsHide: true, timeout: 60000, env: { ...process.env, ...extraEnv } }).trim();
  const buildRun = () => source.replace(/\\\r?\n[ \t]*/g, " ").split(/\r?\n/).map(line => line.trim()).find(line => /^RUN\s/.test(line) && line.endsWith("npm run build"))!;
  const getProbe = () => {
    if (probe) return probe;
    const command = buildRun();
    if (!command?.includes("--mount=type=secret,id=SENTRY_AUTH_TOKEN")) throw Error("Build step lacks the transient Sentry secret contract");
    const localContext = run(["context", "show"]);
    const metadata = JSON.parse(run(["context", "inspect", localContext]))[0];
    if (!/^(npipe|unix):/.test(metadata.Endpoints?.docker?.Host ?? "")) throw Error("Only a local Docker socket is admitted");
    dockerContext = localContext;
    if (!/^Driver:\s+docker\s*$/m.test(run(["buildx", "inspect", localContext]))) throw Error("Only the local Docker builder is admitted");
    // Verify the approved cached base exists; never pull an image or use Build Cloud.
    run(["image", "inspect", "pgvector/pgvector:0.8.0-pg17", "--format", "{{.Id}}"]);
    const root = "C:/liberia-learn/artifacts/v4-coordination";
    mkdirSync(root, { recursive: true }); const context = mkdtempSync(join(root, "sec27-docker-probe-"));
    // Execute the exact mount/export prefix from the actual build RUN; only the
    // expensive npm command becomes a presence assertion in this offline probe.
    const prefix = command.slice(0, -"npm run build".length);
    const fixture = `FROM pgvector/pgvector:0.8.0-pg17\nCOPY . /probe-context/\n${prefix}test -n "$SENTRY_AUTH_TOKEN"\n`;
    writeFileSync(join(context, "Dockerfile"), fixture);
    writeFileSync(join(context, ".dockerignore"), readFileSync(".dockerignore"));
    writeFileSync(join(context, "safe.marker"), "synthetic public context control");
    for (const path of [".aws/credentials", ".agents/private", ".codex/auth.json", ".task-worktrees/task/private", "nested/.envfixture", ".envfixture"]) {
      const target = join(context, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, canary);
    }
    const image = `ll-sec27-probe:${Date.now()}`;
    run(["build", "--builder", localContext, "--pull=false", "--network=none", "--no-cache", "--secret", "id=SENTRY_AUTH_TOKEN,env=T2_SEC27_CANARY", "-t", image, context], { T2_SEC27_CANARY: canary });
    probe = { image, context }; return probe;
  };
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); await db.school.create({ data: { id: "sec27-runtime-proof", name: "Synthetic runtime proof" } });
  });
  afterAll(async () => { await db?.$disconnect(); });
  it.each(keys)("%s is never an ARG or persisted ENV", key => {
    expect(source).not.toMatch(new RegExp(`^(?:ARG|ENV)\\s+${key}(?:[=\\s]|$)`, "m"));
  });
  it("Sentry remains available through an optional build secret mount", () => {
    expect(buildRun()).toContain("--mount=type=secret,id=SENTRY_AUTH_TOKEN"); expect(buildRun()).not.toContain("required=true");
  });
  it("private workspace credentials and nested env files stay out of build context", () => {
    for (const path of [".aws", ".agents", ".codex", ".task-worktrees", "**/.env*"]) expect(ignore).toContain(path);
  });
  it("worker stages remain byte-identical to the bound base", () => {
    const baseline = execFileSync("git", ["show", "4662b14ac47e561ec628ec327499fd1a87eef5ef:Dockerfile"], { encoding: "utf8" });
    expect(source.slice(source.indexOf("FROM node:20-alpine AS worker-builder"))).toBe(baseline.slice(baseline.indexOf("FROM node:20-alpine AS worker-builder")));
  });
  it("real secret mount is consumed but absent from image config, history and filesystem", () => {
    const { image, context } = getProbe(); const config = JSON.parse(run(["image", "inspect", image]))[0];
    const history = run(["history", "--no-trunc", image]); expect(JSON.stringify(config)).not.toContain(canary); expect(history).not.toContain(canary);
    for (const key of keys) expect((config.Config.Env ?? []).some((entry: string) => entry.startsWith(key + "="))).toBe(false);
    run(["run", "--rm", "--network=none", "--memory=128m", "--entrypoint=sh", image, "-c", "test ! -e /run/secrets/SENTRY_AUTH_TOKEN && test -f /probe-context/safe.marker && test ! -e /probe-context/.aws && test ! -e /probe-context/.agents && test ! -e /probe-context/.codex && test ! -e /probe-context/.task-worktrees && test ! -e /probe-context/nested/.envfixture && test ! -e /probe-context/.envfixture"]);
    writeFileSync(join(context, "proof.json"), JSON.stringify({ image, candidate: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), dockerfileSha256: createHash("sha256").update(source).digest("hex"), transport: "local active-context Docker builder; cached image; network none; synthetic canary only", secretRetained: false }, null, 2));
  }, 90000);
  it("runtime-only database injection reaches the own disposable database", () => {
    const { image, context } = getProbe(); const url = new URL(process.env.DATABASE_URL!); const database = url.pathname.slice(1);
    // As in the approved psql shim, enter the verified PG container network and
    // translate only the host's loopback port to the container's loopback port.
    url.port = "5432"; url.search = "";
    const result = run(["run", "--rm", "--network=container:ll-native-test-pg", "--memory=128m", "--entrypoint=sh", "-e", `DATABASE_URL=${url.href}`, image, "-c", `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc 'select current_database(); select count(*) from "School";'`]);
    expect(result.split(/\r?\n/)).toEqual([database, "1"]);
    writeFileSync(join(context, "runtime-proof.json"), JSON.stringify({ database, host: "127.0.0.1:55432", internalLoopbackPort: 5432, schoolRows: 1, runtimeInjection: true }, null, 2));
  }, 90000);
});
