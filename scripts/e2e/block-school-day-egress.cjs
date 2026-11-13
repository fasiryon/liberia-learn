// Loaded only by the disposable school-day server, never by application deployment.
const fs = require('node:fs');
const path = require('node:path');
const {urlToHttpOptions}=require('node:url');
if (process.env.E2E_SYNTHETIC !== '1' || process.env.CI !== 'true' || process.env.VERCEL_ENV || process.env.VERCEL)
  throw Error('school_day_egress_guard_requires_disposable_ci');
const runId = process.env.GITHUB_RUN_ID || 'synthetic';
if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw Error('invalid_school_day_run_id');
const output = path.resolve('artifacts/g4-e2e');
fs.mkdirSync(output, {recursive:true});
fs.writeFileSync(path.join(output, `egress-guard-${runId}.json`), JSON.stringify({syntheticOnly:true,pid:process.pid,guard:'fetch-http-https',runId}));
function checkHostname(hostname) {
  if (!['localhost','127.0.0.1','::1','[::1]'].includes(hostname)) {
    // Host only: no prompts, credentials, query strings or learner data in evidence.
    fs.appendFileSync(path.join(output, `egress-attempts-${runId}.jsonl`), JSON.stringify({hostname:typeof hostname==='string'&&/^[a-z0-9.:[\]-]+$/i.test(hostname)?hostname:'invalid-hostname',syntheticOnly:true})+'\n');
    throw Error('school_day_external_request_forbidden');
  }
}
function checkFetch(value){checkHostname(new URL(typeof value==='string'||value instanceof URL?value:value.url).hostname);}
function checkRequest(input,args){
  // Match Node's URL + options signature: options override URL fields, and
  // hostname takes precedence over host. Check what the original will receive.
  const fromUrl=typeof input==='string'||input instanceof URL;
  const options=fromUrl?{...urlToHttpOptions(new URL(input)),...(args[0]&&typeof args[0]==='object'?args[0]:{})}:{...input};
  checkHostname(options.hostname||options.host||'localhost');
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input,...args) {checkFetch(input);return originalFetch.call(this,input,...args);};
for (const name of ['node:http','node:https']) {
  const client=require(name);
  for (const method of ['request','get']) {
    const original=client[method];
    client[method]=function(input,...args){checkRequest(input,args);return original.call(this,input,...args);};
  }
}
