/**
 * Founder/Atlas execution-safety repair (2026-11-02), part 2: once a worker run starts, every abnormal path fails
 * closed. Stop and timeout terminate the worker and ignore any later output; a crash, a message that cannot be
 * deserialized, or a malformed result never reaches the learner as program output.
 */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LLCODE_LIMITS,LLCODE_VERSION} from '@/lib/learner-experience/stem/llcode';
import {startInWorker} from '@/lib/learner-experience/stem/runInWorker';

class FakeWorker{
  static last:FakeWorker;
  onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null;terminated=false;
  constructor(){FakeWorker.last=this;}
  postMessage(){}
  terminate(){this.terminated=true;}
}
const good={version:LLCODE_VERSION,ok:true,output:['1'],steps:1,trace:[],traceTruncated:false,error:null};
beforeEach(()=>{
  vi.useFakeTimers();
  vi.stubGlobal('window',{setTimeout:globalThis.setTimeout.bind(globalThis),clearTimeout:globalThis.clearTimeout.bind(globalThis)});
  vi.stubGlobal('Worker',FakeWorker);
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const settledState=async(p:Promise<unknown>)=>{let done=false;void p.then(()=>{done=true;});await vi.advanceTimersByTimeAsync(0);return done;};

describe('Stop and timeout terminate and suppress later output',()=>{
  it('Stop terminates the worker; output posted afterwards is ignored',async()=>{
    const run=startInWorker('print 1');run.stop();
    FakeWorker.last.onmessage?.({data:good});
    const r=await run.result;
    expect(FakeWorker.last.terminated).toBe(true);expect(r.ok).toBe(false);expect(r.output).toEqual([]);
  });
  it('the hard timeout terminates the worker; late output is ignored',async()=>{
    const run=startInWorker('while True:\n    pass');
    await vi.advanceTimersByTimeAsync(LLCODE_LIMITS.timeoutMs);
    expect(FakeWorker.last.terminated).toBe(true);
    FakeWorker.last.onmessage?.({data:good});
    const r=await run.result;
    expect(r.ok).toBe(false);expect(r.error?.kind).toBe('LIMIT');expect(r.output).toEqual([]);
  });
  it('a caller cannot raise the timeout',async()=>{
    const run=startInWorker('x',{limits:{timeoutMs:60_000}});
    await vi.advanceTimersByTimeAsync(LLCODE_LIMITS.timeoutMs);
    expect(FakeWorker.last.terminated).toBe(true);
    expect((await run.result).ok).toBe(false);
  });
});

describe('crashes and malformed messages fail closed',()=>{
  it('a worker crash yields a fixed runtime refusal and terminates',async()=>{
    const run=startInWorker('x');FakeWorker.last.onerror?.();
    const r=await run.result;
    expect(r).toMatchObject({ok:false,output:[],error:{kind:'RUNTIME'}});expect(FakeWorker.last.terminated).toBe(true);
  });
  it('RED: a message that cannot be deserialized fails closed at once, not at the timeout',async()=>{
    const run=startInWorker('x');
    expect(typeof FakeWorker.last.onmessageerror).toBe('function');
    FakeWorker.last.onmessageerror?.();
    expect(await settledState(run.result)).toBe(true);
    expect((await run.result).ok).toBe(false);expect(FakeWorker.last.terminated).toBe(true);
  });
  it.each([
    ['null',null],
    ['a string',"<img src=x onerror=alert(1)>"],
    ['wrong version',{...good,version:'llcode/9'}],
    ['ok with an error',{...good,error:{kind:'RUNTIME',line:null,message:'x'}}],
    ['non-string output',{...good,output:[{toString:1}]}],
    ['oversized output',{...good,output:Array(LLCODE_LIMITS.outputLines+1).fill('a')}],
    ['oversized trace',{...good,trace:Array(LLCODE_LIMITS.traceEntries+1).fill({step:1,line:1,vars:{},output:0})}],
    ['unknown error kind',{...good,ok:false,error:{kind:'EVAL',line:null,message:'x'}}],
    ['extra fields',{...good,html:'<b>x</b>'}],
  ])('RED: a malformed result (%s) is refused, never shown as output',async(_label,data)=>{
    const run=startInWorker('x');FakeWorker.last.onmessage?.({data});
    const r=await run.result;
    expect(r).toMatchObject({ok:false,output:[],trace:[],error:{kind:'RUNTIME'}});
    expect(FakeWorker.last.terminated).toBe(true);
  });
  it('a well-formed result is delivered unchanged',async()=>{
    const run=startInWorker('x');FakeWorker.last.onmessage?.({data:good});
    expect(await run.result).toEqual(good);
  });
});
