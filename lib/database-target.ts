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
  const separator = decoded.lastIndexOf(".");
  if (separator < 1 || separator === decoded.length - 1) return null;
  return decoded.slice(separator + 1).toLowerCase();
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
      throw new Error(`${label} pooler username does not contain a project identifier`);
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
  const directUrl = env.DIRECT_URL?.trim();
  if (!runtimeUrl || !directUrl) {
    throw new Error("[Startup] DATABASE_URL and DIRECT_URL are required in staging");
  }

  const runtime = parseSupabaseDatabaseTarget(runtimeUrl, "DATABASE_URL");
  const direct = parseSupabaseDatabaseTarget(directUrl, "DIRECT_URL");

  if (runtime.mode !== "transaction-pooler" || runtime.port !== 6543) {
    throw new Error("[Startup] staging DATABASE_URL must use the transaction pooler on port 6543");
  }
  if (direct.mode !== "direct" || direct.port !== 5432) {
    throw new Error("[Startup] staging DIRECT_URL must use the direct endpoint on port 5432");
  }
  if (runtime.projectRef !== expectedRef || direct.projectRef !== expectedRef) {
    throw new Error("[Startup] staging database target does not match STAGING_SUPABASE_PROJECT_REF");
  }
  if (
    runtime.projectRef === PRODUCTION_SUPABASE_PROJECT_REF ||
    direct.projectRef === PRODUCTION_SUPABASE_PROJECT_REF
  ) {
    throw new Error("[Startup] staging database target matches production");
  }
  if (runtime.database !== direct.database) {
    throw new Error("[Startup] staging runtime and direct URLs select different databases");
  }
  if (new URL(runtimeUrl).searchParams.get("pgbouncer") !== "true") {
    throw new Error("[Startup] staging DATABASE_URL must include pgbouncer=true");
  }
  if (
    new URL(runtimeUrl).searchParams.get("sslmode") !== "require" ||
    new URL(directUrl).searchParams.get("sslmode") !== "require"
  ) {
    throw new Error("[Startup] staging database URLs must include sslmode=require");
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
