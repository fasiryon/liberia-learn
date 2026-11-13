/**
 * Focused evidence for Atlas's LL Code execution-safety items (2026-11-02). Unit-level only: it does not replace
 * the hosted/browser worker+CSP check, accessibility, offline or independent review.
 */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {buildContentSecurityPolicy} from '@/lib/security/contentSecurityPolicy';
import {LLCODE_LIMITS,runLLCode} from '@/lib/learner-experience/stem/llcode';

const directive=(csp:string,name:string)=>csp.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+' '))??'';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});

describe('worker and CSP',()=>{
  it('production CSP has no unsafe-eval, blob: or data: script source, so only same-origin bundled workers can start',()=>{
    const script=directive(buildContentSecurityPolicy('n',true),'script-src');
    expect(script).toContain("'self'");
    for(const banned of ["'unsafe-eval'","'unsafe-inline'",'blob:','data:','*'])expect(script.split(' ')).not.toContain(banned);
    // No worker-src/child-src override: workers fall back to script-src.
    expect(directive(buildContentSecurityPolicy('n',true),'worker-src')).toBe('');
    expect(directive(buildContentSecurityPolicy('n',true),'child-src')).toBe('');
  });
  it('the worker scope removes network, storage and loader capabilities before accepting a program, and runs one program only',async()=>{
    const posted:unknown[]=[];
    const self:Record<string,unknown>={fetch:()=>0,XMLHttpRequest:class{},WebSocket:class{},EventSource:class{},importScripts:()=>0,indexedDB:{},caches:{},BroadcastChannel:class{},Worker:class{},SharedWorker:class{},
      postMessage:(m:unknown)=>posted.push(m)};
    vi.stubGlobal('self',self);
    await import('@/lib/learner-experience/stem/llcode.worker');
    for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','indexedDB','caches','BroadcastChannel','Worker','SharedWorker'])expect(self[name]).toBeUndefined();
    const onmessage=self.onmessage as (e:{data:unknown})=>void;
    onmessage({data:{source:'print(1)'}});onmessage({data:{source:'print(2)'}});
    expect(posted).toHaveLength(1);
  });
});

describe('resource limits',()=>{
  it('every limit is finite and positive, with a hard 2 s page-side timeout',()=>{
    for(const value of Object.values(LLCODE_LIMITS))expect(Number.isFinite(value)&&value>0).toBe(true);
    expect(LLCODE_LIMITS.timeoutMs).toBeLessThanOrEqual(2000);
  });
  it('callers can only tighten limits, never raise them',()=>{
    const loop='x = 0\nwhile True:\n    x = x + 1';
    const raised=runLLCode(loop,{limits:{steps:10_000_000}});
    expect(raised.ok).toBe(false);expect(raised.error?.kind).toBe('LIMIT');
    expect(raised.steps).toBeLessThanOrEqual(LLCODE_LIMITS.steps+1);
  });
  it('oversized source is refused before parsing',()=>{
    const result=runLLCode('x'.repeat(LLCODE_LIMITS.sourceChars+1));
    expect(result.ok).toBe(false);expect(result.error?.kind).toBe('LIMIT');
  });
});
