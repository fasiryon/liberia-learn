"use strict";

const roleSecrets = Object.freeze({
  "student1@cha.edu.lr": "E2E_DEMO_PASSWORD",
  "teacher1@cha.edu.lr": "E2E_DEMO_PASSWORD",
  "admin@cha.edu.lr": "E2E_DEMO_PASSWORD",
  "official1@moe.gov.lr": "E2E_DEMO_MOE_PASSWORD",
});

function rehearsalBaseUrl(env = process.env) {
  const value = env.E2E_REHEARSAL_BASE_URL;
  if (!value) throw new Error("Required environment variable E2E_REHEARSAL_BASE_URL is missing");
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid E2E_REHEARSAL_BASE_URL"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error("E2E_REHEARSAL_BASE_URL must be an HTTP(S) origin without credentials");
  }
  return url.origin;
}

function rehearsalPassword(email, env = process.env) {
  if (!Object.hasOwn(roleSecrets, email)) throw new Error("No rehearsal credential configured for this account");
  const key = roleSecrets[email];
  if (!key) throw new Error("No rehearsal credential configured for this account");
  const value = env[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Required environment variable ${key} is missing`);
  return value;
}

module.exports = { rehearsalBaseUrl, rehearsalPassword };
