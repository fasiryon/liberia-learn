/** Deployed Preview is read/demo-only for automation, irrespective of DEMO_MODE or cron credentials. */
export function previewAutomationDisabled(env:Readonly<Record<string,string|undefined>>=process.env):boolean {
  return env.VERCEL_ENV==='preview'||env.VERCEL_ENV==='staging';
}
export function isCronNamespace(pathname:string):boolean {
  const cron=/^\/api\/crons?(?:\/|$)/i;
  // An undecodable path is still classified by its raw prefix: fail closed.
  try{return cron.test(decodeURIComponent(pathname));}catch{return cron.test(pathname);}
}
