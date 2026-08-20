export const PRODUCTION_SUPABASE_PROJECT_REF = "bnphuinpvgpmebcsvmsp";

export type SupabaseDatabaseMode =
  | "direct"
  | "session-pooler"
  | "transaction-pooler";

export type SanitizedDatabaseTarget = {
  host: string;
  port: number;
  database: string;
  projectRef: string;
  mode: SupabaseDatabaseMode;
};

function parsePort(url: URL): number {
  if (url.port) return Number.parseInt(url.port, 10);
  return 5432;
}

function projectRefFromPoolerUsername(username: string): string | null {
  const decoded = decodeURIComponent(username);
  const match = decoded.toLowerCase().match(/^postgres\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

export function parseSupabaseDatabaseTarget(
  rawUrl: string,
  label = "database URL"
): SanitizedDatabaseTarget {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${label} must use the postgresql protocol`);
  }

  const host = url.hostname.toLowerCase();
  const port = parsePort(url);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const directMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  const isSharedPooler = /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host);

  if (directMatch) {
    if (port !== 5432) {
      throw new Error(`${label} direct endpoint must use port 5432`);
    }
    return {
      host,
      port,
      database,
      projectRef: directMatch[1],
      mode: "direct",
    };
  }

  if (isSharedPooler) {
    const projectRef = projectRefFromPoolerUsername(url.username);
    if (!projectRef) {
      throw new Error(`${label} pooler username must route as postgres.<project-ref>`);
    }
    if (port !== 5432 && port !== 6543) {
      throw new Error(`${label} pooler endpoint must use port 5432 or 6543`);
    }
    return {
      host,
      port,
      database,
      projectRef,
      mode: port === 6543 ? "transaction-pooler" : "session-pooler",
    };
  }

  throw new Error(`${label} is not a recognized Supabase direct or shared-pooler endpoint`);
}

export function assertSupabaseMigrationTransport(
  rawUrl: string,
  expectedProjectRef: string,
  label = "migration database URL"
): SanitizedDatabaseTarget {
  const normalizedExpectedRef = expectedProjectRef.trim().toLowerCase();
  if (normalizedExpectedRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(`${label} expected project matches production`);
  }

  const target = parseSupabaseDatabaseTarget(rawUrl, label);
  if (target.projectRef !== normalizedExpectedRef) {
    throw new Error(`${label} project does not match the approved staging project`);
  }
  if (target.projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(`${label} targets production`);
  }
  if (target.port !== 5432 || (target.mode !== "direct" && target.mode !== "session-pooler")) {
    throw new Error(
      `${label} must use the direct endpoint or Supavisor session mode on port 5432; transaction mode is prohibited`
    );
  }
  const parsed = new URL(rawUrl);
  if (parsed.searchParams.get("sslmode") !== "require") {
    throw new Error(`${label} must include sslmode=require`);
  }
  if (target.mode === "session-pooler" && parsed.searchParams.get("pgbouncer") === "true") {
    throw new Error(`${label} session mode must not be marked as transaction pooling`);
  }
  return target;
}

export function parseSupabaseProjectUrl(rawUrl: string, label = "Supabase URL"): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  const match = url.hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/);
  if (url.protocol !== "https:" || !match) {
    throw new Error(`${label} must use https://<project-ref>.supabase.co`);
  }
  return match[1];
}

export function assertStagingDatabaseIsolation(
  env: NodeJS.ProcessEnv = process.env
): void {
  const vercelEnvironment = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnvironment !== "preview" && vercelEnvironment !== "staging") return;

  const expectedRef = env.STAGING_SUPABASE_PROJECT_REF?.trim().toLowerCase();
  if (!expectedRef) {
    throw new Error("[Startup] STAGING_SUPABASE_PROJECT_REF is required in staging");
  }
  if (expectedRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("[Startup] staging project identifier matches production");
  }

  const runtimeUrl = env.DATABASE_URL?.trim();
  const migrationUrl = env.DIRECT_URL?.trim();
  if (!runtimeUrl) {
    throw new Error("[Startup] DATABASE_URL is required in staging");
  }

  const runtime = parseSupabaseDatabaseTarget(runtimeUrl, "DATABASE_URL");

  if (runtime.mode !== "transaction-pooler" || runtime.port !== 6543) {
    throw new Error("[Startup] staging DATABASE_URL must use the transaction pooler on port 6543");
  }
  if (runtime.projectRef !== expectedRef) {
    throw new Error("[Startup] staging database target does not match STAGING_SUPABASE_PROJECT_REF");
  }
  if (runtime.projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("[Startup] staging database target matches production");
  }
  if (new URL(runtimeUrl).searchParams.get("pgbouncer") !== "true") {
    throw new Error("[Startup] staging DATABASE_URL must include pgbouncer=true");
  }
  if (new URL(runtimeUrl).searchParams.get("sslmode") !== "require") {
    throw new Error("[Startup] staging DATABASE_URL must include sslmode=require");
  }

  if (migrationUrl) {
    const migration = assertSupabaseMigrationTransport(migrationUrl, expectedRef, "DIRECT_URL");
    if (migration.database !== runtime.database) {
      throw new Error("[Startup] staging runtime and migration URLs select different databases");
    }
  }

  if (env.SUPABASE_URL?.trim()) {
    const storageRef = parseSupabaseProjectUrl(env.SUPABASE_URL, "SUPABASE_URL");
    if (storageRef !== expectedRef) {
      throw new Error("[Startup] staging SUPABASE_URL does not match the staging database project");
    }
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const publicRef = parseSupabaseProjectUrl(
      env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL"
    );
    if (publicRef !== expectedRef) {
      throw new Error(
        "[Startup] staging NEXT_PUBLIC_SUPABASE_URL does not match the staging database project"
      );
    }
  }
}
