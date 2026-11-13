'use strict';
function requiredSecret(name, env = process.env) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim() || /^<.*>$/.test(value.trim())) {
    throw new Error(`Required secret environment variable ${name} is missing or a placeholder`);
  }
  return value;
}
module.exports = { requiredSecret };
