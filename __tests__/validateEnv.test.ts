import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mutableEnv() {
  return process.env as Record<string, string | undefined>;
}

function resetRelevantEnv() {
  const env = mutableEnv();
  delete env.DATABASE_URL;
  delete env.DIRECT_URL;
  delete env.NEXTAUTH_SECRET;
  delete env.NEXTAUTH_URL;
  delete env.OPENAI_API_KEY;
  delete env.AI_TUTOR_ENABLED;
  delete env.AI_TEACHER_ASSIST_ENABLED;
  delete env.ENABLE_RAG_TUTOR;
  delete env.NEXT_PUBLIC_ENABLE_RAG_TUTOR;
  delete env.ENABLE_TEACHER_GENERATION;
  delete env.ENABLE_ASSIGNMENT_TUTOR;
  delete env.ENABLE_AI_GRADING_ASSIST;
  delete env.AI_INTERVENTIONS_AI_ENHANCED;
  delete env.AI_DROPOUT_RISK_ENABLED;
  delete env.ENABLE_CURRICULUM_OPTIMIZATION_AI;
  delete env.ENABLE_DELIVERY_PROFILE;
  delete env.ANTHROPIC_API_KEY;
  delete env.ENABLE_CANVA_CERTIFICATES;
  delete env.ENABLE_CANVA_MOE_REPORTS;
  delete env.ENABLE_CANVA_COURSE_THUMBNAILS;
  delete env.ENABLE_SCHOOL_ONBOARDING_KITS;
  delete env.ENABLE_CERTIFICATION_ASSET_GENERATION;
  delete env.ENABLE_HIGGSFIELD_VIDEO_GENERATION;
  delete env.ENABLE_CURRICULUM_REGEN_QUEUE;
  delete env.SQS_QUEUE_URL;
  delete env.AWS_REGION;
  delete env.AWS_ACCESS_KEY_ID;
  delete env.AWS_SECRET_ACCESS_KEY;
  delete env.AWS_SESSION_TOKEN;
  delete env.AWS_PROFILE;
  delete env.NEXT_PUBLIC_SENTRY_DSN;
  delete env.SENTRY_DSN;
  delete env.SENTRY_AUTH_TOKEN;
  delete env.SENTRY_ORG;
  delete env.SENTRY_PROJECT;
  delete env.RESEND_API_KEY;
  delete env.EMAIL_FROM;
  delete env.AT_API_KEY;
  delete env.AT_USERNAME;
  delete env.CI;
  delete env.NODE_ENV;
  delete env.NEXT_PHASE;
}

async function importValidateEnvModule() {
  vi.resetModules();
  return await import("@/lib/validateEnv");
}

describe("validateEnv", () => {
  beforeEach(() => {
    resetRelevantEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when DATABASE_URL is missing", async () => {
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";

    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("lists all missing required vars in the error message", async () => {
    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
    expect(() => validateEnv()).toThrow(/DIRECT_URL/);
    expect(() => validateEnv()).toThrow(/NEXTAUTH_SECRET/);
    expect(() => validateEnv()).toThrow(/NEXTAUTH_URL/);
  });

  it("throws only for missing vars, not present ones", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";

    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).toThrow(/NEXTAUTH_URL/);
    expect(() => validateEnv()).not.toThrow(/DATABASE_URL.*DIRECT_URL.*NEXTAUTH_SECRET/);
  });

  it("does not throw when all required vars are set", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";

    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).not.toThrow();
  });

  it("warns on recommended vars that are missing", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await importValidateEnvModule();

    validateEnv();

    expect(warnSpy).toHaveBeenCalled();
  });

  it("does not warn when recommended vars are present", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";
    mutableEnv().NEXT_PUBLIC_SENTRY_DSN = "https://examplePublic@sentry.io/123";
    mutableEnv().SENTRY_DSN = "https://exampleServer@sentry.io/456";
    mutableEnv().SENTRY_AUTH_TOKEN = "token";
    mutableEnv().SENTRY_ORG = "liberia-learn";
    mutableEnv().SENTRY_PROJECT = "liberialearn-web";
    mutableEnv().RESEND_API_KEY = "resend";
    mutableEnv().EMAIL_FROM = "noreply@example.com";
    mutableEnv().AT_API_KEY = "at-key";
    mutableEnv().AT_USERNAME = "at-user";
    mutableEnv().SUPABASE_LESSON_AUDIO_BUCKET = "lesson-audio";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await importValidateEnvModule();

    validateEnv();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("requires OPENAI_API_KEY when an AI feature flag is enabled", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";
    mutableEnv().AI_TUTOR_ENABLED = "true";

    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).toThrow(/OPENAI_API_KEY/);
  });

  it("requires ANTHROPIC_API_KEY when a Canva generation flag is enabled", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";
    mutableEnv().ENABLE_CANVA_COURSE_THUMBNAILS = "true";

    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("requires SQS queue env when curriculum regeneration queue is enabled", async () => {
    mutableEnv().DATABASE_URL = "postgres://db";
    mutableEnv().DIRECT_URL = "postgres://direct";
    mutableEnv().NEXTAUTH_SECRET = "secret";
    mutableEnv().NEXTAUTH_URL = "http://localhost:3000";
    mutableEnv().ENABLE_CURRICULUM_REGEN_QUEUE = "true";

    const { validateEnv } = await importValidateEnvModule();

    expect(() => validateEnv()).toThrow(/SQS_QUEUE_URL/);
    expect(() => validateEnv()).toThrow(/AWS_REGION/);
  });
});

describe("validateBuildEnv", () => {
  beforeEach(() => {
    resetRelevantEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not require runtime database or auth env vars at config-load time", async () => {
    mutableEnv().NODE_ENV = "production";
    mutableEnv().CI = "true";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateBuildEnv } = await importValidateEnvModule();

    expect(() => validateBuildEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("warns on partial sentry build configuration", async () => {
    mutableEnv().NODE_ENV = "production";
    mutableEnv().CI = "true";
    mutableEnv().NEXT_PUBLIC_SENTRY_DSN = "https://examplePublic@sentry.io/123";
    mutableEnv().SENTRY_DSN = "https://exampleServer@sentry.io/456";
    mutableEnv().SENTRY_ORG = "liberia-learn";
    mutableEnv().SENTRY_PROJECT = "liberialearn-web";
    delete mutableEnv().SENTRY_AUTH_TOKEN;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateBuildEnv } = await importValidateEnvModule();

    validateBuildEnv();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Partial configuration detected")
    );
  });
});
