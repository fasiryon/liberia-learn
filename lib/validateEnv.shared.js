const GROUPS = {
  coreApp: {
    label: "core app",
    required: ["DATABASE_URL", "DIRECT_URL"],
  },
  auth: {
    label: "auth",
    required: ["NEXTAUTH_SECRET", "NEXTAUTH_URL"],
  },
  aiProviders: {
    label: "AI providers",
    requiredWhen: [
      {
        when: [
          "AI_TUTOR_ENABLED",
          "AI_TEACHER_ASSIST_ENABLED",
          "ENABLE_RAG_TUTOR",
          "NEXT_PUBLIC_ENABLE_RAG_TUTOR",
          "ENABLE_TEACHER_GENERATION",
          "ENABLE_ASSIGNMENT_TUTOR",
          "ENABLE_AI_GRADING_ASSIST",
          "AI_INTERVENTIONS_AI_ENHANCED",
          "AI_DROPOUT_RISK_ENABLED",
          "ENABLE_CURRICULUM_OPTIMIZATION_AI",
          "ENABLE_DELIVERY_PROFILE",
        ],
        required: ["OPENAI_API_KEY"],
      },
    ],
    optional: ["GROQ_API_KEY", "AI_BUDGET_MONTHLY_CAP_USD"],
  },
  observability: {
    label: "observability",
    recommended: ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN"],
    allOrNothing: [["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]],
  },
  notifications: {
    label: "SMS / notifications",
    recommended: ["RESEND_API_KEY", "EMAIL_FROM", "AT_API_KEY", "AT_USERNAME"],
  },
  optionalDemoDev: {
    label: "optional demo/dev",
    optional: ["DEMO_MODE", "DEMO_RESET_SECRET", "DEMO_SCHOOL_IDS", "LOG_LEVEL"],
  },
};

function isEnabled(value) {
  return value === "true";
}

function getConditionalRequirements(env) {
  const issues = [];

  for (const group of Object.values(GROUPS)) {
    for (const rule of group.requiredWhen ?? []) {
      if (!rule.when.some((flag) => isEnabled(env[flag]))) continue;
      const missing = rule.required.filter((name) => !env[name]);
      if (missing.length > 0) {
        issues.push({
          group: group.label,
          missing,
          flags: rule.when.filter((flag) => isEnabled(env[flag])),
        });
      }
    }
  }

  return issues;
}

function validateEnv(env = process.env) {
  // ✅ Skip strict validation during build phase (CI / Docker / Next build)
  const isBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    (process.env.NODE_ENV === "production" && process.env.CI === "true");

  if (isBuild) {
    console.warn("Skipping strict env validation during build phase");
    return;
  }

  // 🔒 Runtime validation
  const hardFailures = [];

  for (const group of Object.values(GROUPS)) {
    const missing = (group.required ?? []).filter((name) => !env[name]);
    if (missing.length > 0) {
      hardFailures.push({ group: group.label, missing });
    }
  }

  hardFailures.push(...getConditionalRequirements(env));

  if (hardFailures.length > 0) {
    const details = hardFailures
      .map((failure) => {
        const reason = failure.flags?.length
          ? ` (required because ${failure.flags.join(", ")} is enabled)`
          : "";
        return `${failure.group}: ${failure.missing.join(", ")}${reason}`;
      })
      .join("; ");

    throw new Error(`Missing required environment variables: ${details}`);
  }

  // ⚠️ Recommended warnings
  for (const group of Object.values(GROUPS)) {
    for (const name of group.recommended ?? []) {
      if (!env[name]) {
        console.warn(`[ENV][${group.label}] Recommended env var not set: ${name}`);
      }
    }

    // ⚠️ All-or-nothing validation
    for (const set of group.allOrNothing ?? []) {
      const present = set.filter((name) => !!env[name]);
      if (present.length > 0 && present.length !== set.length) {
        const missing = set.filter((name) => !env[name]);
        console.warn(
          `[ENV][${group.label}] Partial configuration detected. Set all of ${set.join(
            ", "
          )} together. Missing: ${missing.join(", ")}`
        );
      }
    }
  }
}

module.exports = {
  ENV_GROUPS: GROUPS,
  validateEnv,
};