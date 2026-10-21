// Isolated local reviewer runtime. No real provider, database or production credentials.
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'COMSPEC'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, {
  NODE_ENV: 'development', LAB_REVIEW_HARNESS: '1', NEXTAUTH_URL: 'http://127.0.0.1:3195',
  NEXTAUTH_SECRET: 'pr195-isolated-synthetic-review-secret',
  DATABASE_URL: 'postgresql://review_reader:pr195-read-only-local@127.0.0.1:55495/pr195_review',
  DIRECT_URL: 'postgresql://review_reader:pr195-read-only-local@127.0.0.1:55495/pr195_review',
  SKIP_ENV_VALIDATION: 'true', NEXT_TELEMETRY_DISABLED: '1',
});
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3195'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => process.exit(code ?? 1));
