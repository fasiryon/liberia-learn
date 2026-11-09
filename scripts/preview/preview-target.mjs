export const PRODUCTION_PROJECT_REF='bnphuinpvgpmebcsvmsp';
// The exact Preview project is pinned at RUNTIME (PREVIEW_PINNED_PROJECT_REF, execution environment), never in source:
// the reference is not public (Phase 2 scrub, 2026-11-08). Missing, malformed or Production refuses.
const PROJECT_REF=/^[a-z]{20}$/;
export const isPreviewProjectRef=ref=>typeof ref==='string'&&PROJECT_REF.test(ref)&&ref!==PRODUCTION_PROJECT_REF;
export function pinnedPreviewProjectRef(env){
  const ref=env.PREVIEW_PINNED_PROJECT_REF;
  if(!isPreviewProjectRef(ref))fail();
  return ref;
}
const pooler='aws-0-us-east-2.pooler.supabase.com';
const fail=()=>{throw Error('preview_database_target_refused');};
/** Exact input validation only. Never repair, trim, serialize or add URL parameters. */
export function validatePreviewTarget(env){
  if(env.SYNTHETIC_PREVIEW_SEED!=='1'||env.VERCEL_ENV==='production'||env.VERCEL==='1'||env.CI==='true')fail();
  const PREVIEW_PROJECT_REF=pinnedPreviewProjectRef(env);
  if(env.PREVIEW_SUPABASE_PROJECT_REF!==PREVIEW_PROJECT_REF||env.PREVIEW_DB_ROLE!=='preview_app')fail();
  if(typeof env.PREVIEW_DB_PASSWORD!=='string'||env.PREVIEW_DB_PASSWORD.length<16)fail();
  function check(raw,kind){
    if(typeof raw!=='string'||!raw.startsWith('postgresql://')||raw!==raw.trim()||/[\u0000-\u0020\u007f]/.test(raw)||raw.includes('#'))fail();
    let decoded,url;
    try{decoded=decodeURIComponent(raw);url=new URL(raw);}catch{fail();}
    const authority=raw.slice(raw.indexOf('://')+3).split(/[/?#]/,1)[0];
    // Reserved characters in userinfo must be encoded, not silently normalized by WHATWG URL.
    if(!/^(?:[A-Za-z0-9._~-]|%[a-fA-F0-9]{2})+:(?:[A-Za-z0-9._~-]|%[a-fA-F0-9]{2})+@[^@]+$/.test(authority))fail();
    if(decoded.toLowerCase().includes(PRODUCTION_PROJECT_REF)||url.protocol!=='postgresql:'||url.pathname!=='/postgres'||url.hash)fail();
    let username,password;
    try{username=decodeURIComponent(url.username);password=decodeURIComponent(url.password);}catch{fail();}
    if(!username||!password||/[\u0000-\u001f\u007f]/.test(password)||password!==env.PREVIEW_DB_PASSWORD)fail();
    if(url.hostname===pooler){
      if(username!==`preview_app.${PREVIEW_PROJECT_REF}`||url.port!==(kind==='transaction'?'6543':'5432'))fail();
      if(kind==='transaction'&&url.searchParams.get('pgbouncer')!=='true')fail();
    }else if(kind==='direct'&&url.hostname===`db.${PREVIEW_PROJECT_REF}.supabase.co`){
      if(username!=='preview_app'||(url.port||'5432')!=='5432')fail();
    }else fail();
    if(kind==='direct'&&url.searchParams.has('pgbouncer'))fail();
    if(url.searchParams.get('sslmode')!=='require')fail();
    for(const pair of url.search.slice(1).split('&'))if(!/^(pgbouncer|sslmode|connection_limit|pool_timeout|schema)=/.test(pair))fail();
    for(const [key,value] of url.searchParams){
      if(!['pgbouncer','sslmode','connection_limit','pool_timeout','schema'].includes(key))fail();
      if(key==='sslmode'&&value!=='require')fail();
      if(key==='schema'&&value!=='public')fail();
      if(key==='pgbouncer'&&value!=='true')fail();
      if(['connection_limit','pool_timeout'].includes(key)&&!/^[1-9]\d{0,3}$/.test(value))fail();
      if(url.searchParams.getAll(key).length!==1)fail();
    }
    return raw;
  }
  return {projectRef:PREVIEW_PROJECT_REF,role:'preview_app',database:'postgres',databaseUrl:check(env.DATABASE_URL,'transaction'),directUrl:check(env.DIRECT_URL,'direct')};
}

/** Explicit operator file only; ambient URLs/secrets cannot fill missing configured values. */
/** @param {Record<string,string|undefined>} configuration @param {Record<string,string|undefined>} executionEnv */
export function previewOperatorEnvironment(configuration,executionEnv=process.env){
  const selected=Object.fromEntries(['DATABASE_URL','DIRECT_URL','PREVIEW_SUPABASE_PROJECT_REF','PREVIEW_DB_ROLE','PREVIEW_DB_PASSWORD'].map(key=>[key,configuration[key]]));
  // The pin comes from the execution environment, separately from the credentials file that names the target.
  return {...selected,SYNTHETIC_PREVIEW_SEED:'1',PREVIEW_PINNED_PROJECT_REF:executionEnv.PREVIEW_PINNED_PROJECT_REF,CI:executionEnv.CI,VERCEL:executionEnv.VERCEL,VERCEL_ENV:executionEnv.VERCEL_ENV};
}
