/**
 * Hosted origin and callback assumptions for next-auth (T1, 2026-11-02; corrected 2026-11-04 for the frozen lock).
 *
 * The candidate's package-lock pins next-auth 4.24.15. In 4.24.15 `utils/detect-origin.js` returns NEXTAUTH_URL
 * FIRST whenever it is set; only when it is unset does Vercel (VERCEL or AUTH_TRUST_HOST) derive the origin from the
 * forwarded host. 4.24.14 (what this machine's shared node_modules held, so every earlier local run) ignored
 * NEXTAUTH_URL on Vercel; the frozen-lock CI run 41758880144 caught the stale assumption.
 *
 * Security intent, unchanged:
 *  - Preview stores NO NEXTAUTH_URL, so each deployment's own (forwarded) host is the origin. If one is ever set it must
 *    be that Preview host (and https): any other value would send every callback to that other origin.
 *  - A configured NEXTAUTH_URL cannot be overridden by a spoofed Host/X-Forwarded-Host (on or off Vercel).
 *  - Off Vercel without trust, an untrusted Host yields no origin at all.
 *  - Callback URLs (query parameter or cookie) pass through the default redirect callback (the app defines none), which
 *    keeps only same-origin or relative targets; an attacker origin collapses to the base URL.
 * Platform assumption, not provable here: with NEXTAUTH_URL unset on Vercel, the forwarded host is set by Vercel's edge
 * from the domain the request was routed to; a deployment only receives requests for its own domains.
 *
 * Runs against the installed next-auth and first checks it IS the locked version: on a machine whose node_modules was
 * built from another lock this file fails at the version check, which is the honest result (not frozen-lock evidence).
 * LL_NEXTAUTH_PACKAGE_DIR may point at an extracted, integrity-checked tarball of the locked version for local review.
 */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {encode,getToken} from 'next-auth/jwt';

const require=createRequire(import.meta.url);
const pkgDir=process.env.LL_NEXTAUTH_PACKAGE_DIR||path.dirname(require.resolve('next-auth'));
// These utils are not in next-auth's exports map; load the installed files directly.
const {detectOrigin}=require(path.join(pkgDir,'utils','detect-origin.js')) as {detectOrigin:(host:string,protocol?:string)=>string|undefined};
const {createCallbackUrl}=require(path.join(pkgDir,'core','lib','callback-url.js')) as {createCallbackUrl:(a:{options:unknown;paramValue?:string;cookieValue?:string})=>Promise<{callbackUrl:string}>};
const {defaultCallbacks}=require(path.join(pkgDir,'core','lib','default-callbacks.js')) as {defaultCallbacks:{redirect:(a:{url:string;baseUrl:string})=>string}};

afterEach(()=>vi.unstubAllEnvs());
const secret='synthetic-nextauth-origin-test-secret-0123456789';
const DEPLOYMENT='liberia-learn-preview-abc.vercel.app';
const ATTACKER='attacker.example.invalid';
const env=(vercel:boolean,nextauthUrl?:string)=>{
  vi.stubEnv('VERCEL',vercel?'1':undefined as unknown as string);vi.stubEnv('AUTH_TRUST_HOST',undefined as unknown as string);
  vi.stubEnv('NEXTAUTH_URL',nextauthUrl as unknown as string);
};
/** The callback URL next-auth would use for a request whose host header is `host`, given a requested target. */
const callbackFor=async(host:string,target:{param?:string;cookie?:string})=>{
  const origin=detectOrigin(host,'https');
  if(!origin)return {origin,callbackUrl:undefined};
  const {callbackUrl}=await createCallbackUrl({options:{url:new URL(origin),callbacks:defaultCallbacks},paramValue:target.param,cookieValue:target.cookie});
  return {origin,callbackUrl};
};

describe('the tested next-auth is the locked version',()=>{
  it('installed version equals package-lock (otherwise this run is not frozen-lock evidence)',()=>{
    const installed=JSON.parse(fs.readFileSync(path.join(pkgDir,'package.json'),'utf8')).version;
    const locked=JSON.parse(fs.readFileSync(path.join(process.cwd(),'package-lock.json'),'utf8')).packages['node_modules/next-auth'].version;
    expect({installed,locked}).toEqual({installed:'4.24.15',locked:'4.24.15'});
  });
});

describe('origin derivation (next-auth 4.24.15)',()=>{
  it('Vercel, NEXTAUTH_URL unset: the per-deployment forwarded host, https',()=>{
    env(true);
    expect(detectOrigin(DEPLOYMENT,'https')).toBe(`https://${DEPLOYMENT}`);
    expect(detectOrigin(DEPLOYMENT,undefined)).toBe(`https://${DEPLOYMENT}`);
  });
  it('Vercel, NEXTAUTH_URL set: the configured origin takes precedence over any forwarded host',()=>{
    env(true,`https://${DEPLOYMENT}`);
    expect(detectOrigin(ATTACKER,'https')).toBe(`https://${DEPLOYMENT}`);
    env(true,'https://liberia-learn.example.invalid');
    expect(detectOrigin(DEPLOYMENT,'https')).toBe('https://liberia-learn.example.invalid');
  });
  it('off Vercel, NEXTAUTH_URL set: the configured origin, whatever Host says',()=>{
    env(false,'http://127.0.0.1:3100');
    expect(detectOrigin(ATTACKER,'https')).toBe('http://127.0.0.1:3100');
  });
  it('off Vercel without trust and without NEXTAUTH_URL: an untrusted Host yields no origin',()=>{
    env(false);
    expect(detectOrigin(ATTACKER,'https')).toBeUndefined();
  });
});

describe('callbacks cannot be redirected to an attacker origin',()=>{
  it('the app defines no redirect callback, so next-auth\'s same-origin default applies',()=>{
    const source=fs.readFileSync(path.join(process.cwd(),'lib','auth.ts'),'utf8');
    expect(source).not.toMatch(/\bredirect\s*(\(|:)/);
  });
  it.each([
    ['query callbackUrl',{param:`https://${ATTACKER}/steal`}],
    ['callback-url cookie',{cookie:`https://${ATTACKER}/steal`}],
    ['scheme-relative',{param:`//${ATTACKER}/steal`}],
  ])('Vercel, NEXTAUTH_URL unset: an attacker %s collapses to the deployment origin',async(_n,target)=>{
    env(true);
    const {callbackUrl}=await callbackFor(DEPLOYMENT,target);
    expect(new URL(callbackUrl!).origin).toBe(`https://${DEPLOYMENT}`);
  });
  it('relative and same-origin targets are kept on the deployment',async()=>{
    env(true);
    expect((await callbackFor(DEPLOYMENT,{param:'/learn/day'})).callbackUrl).toBe(`https://${DEPLOYMENT}/learn/day`);
    expect((await callbackFor(DEPLOYMENT,{param:`https://${DEPLOYMENT}/admin`})).callbackUrl).toBe(`https://${DEPLOYMENT}/admin`);
  });
  it('NEXTAUTH_URL set: a spoofed Host cannot move the origin, and attacker targets collapse to the configured origin',async()=>{
    env(true,`https://${DEPLOYMENT}`);
    const {origin,callbackUrl}=await callbackFor(ATTACKER,{param:`https://${ATTACKER}/steal`});
    expect([origin,new URL(callbackUrl!).origin]).toEqual([`https://${DEPLOYMENT}`,`https://${DEPLOYMENT}`]);
  });
});

describe('Preview requirement: NEXTAUTH_URL absent or exactly the Preview host',()=>{
  /** The rule the A1b probe enforces (nextauthUrlAbsentOrPreviewHost), stated as the origin it produces. */
  const acceptable=(value:string|undefined,deployment:string)=>{env(true,value);return detectOrigin(deployment,'https')===`https://${deployment}`;};
  it('absent, or the Preview host itself, keeps callbacks on that deployment',()=>{
    expect(acceptable(undefined,DEPLOYMENT)).toBe(true);
    expect(acceptable(`https://${DEPLOYMENT}`,DEPLOYMENT)).toBe(true);
  });
  it.each(['https://liberia-learn.example.invalid',`https://${ATTACKER}`,`http://${DEPLOYMENT}`])('%s would move callbacks off the deployment: forbidden',(value)=>{
    expect(acceptable(value,DEPLOYMENT)).toBe(false);
  });
});

describe('middleware cookie name on Vercel',()=>{
  const request=(name:string,value:string)=>({headers:{cookie:`${name}=${value}`},cookies:{[name]:value}}) as never;
  it('with NEXTAUTH_URL unset, getToken reads the __Secure- session cookie',async()=>{
    env(true);
    const token=await encode({token:{id:'synthetic',role:'STUDENT'},secret});
    expect(await getToken({req:request('__Secure-next-auth.session-token',token),secret})).toMatchObject({id:'synthetic'});
    expect(await getToken({req:request('next-auth.session-token',token),secret})).toBeNull();
  });
  it('an http NEXTAUTH_URL would make middleware miss the __Secure- cookie (so it must be https or unset)',async()=>{
    env(true,`http://${DEPLOYMENT}`);
    const token=await encode({token:{id:'synthetic'},secret});
    expect(await getToken({req:request('__Secure-next-auth.session-token',token),secret})).toBeNull();
  });
});
