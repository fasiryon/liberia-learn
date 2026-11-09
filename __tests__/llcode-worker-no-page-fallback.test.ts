/**
 * Atlas execution-safety finding (2026-11-02): learner LL Code must never run on the page thread. Without Worker
 * support, or when the Worker cannot be constructed (for example a CSP refusal), the runner refuses with a fixed
 * result instead of falling back to the in-page interpreter. The normal worker path is unchanged.
 */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({run:vi.fn()}));
vi.mock('@/lib/learner-experience/stem/llcode',async original=>({...(await original<object>()),runLLCode:m.run}));
import {LLCODE_VERSION} from '@/lib/learner-experience/stem/llcode';
import {startInWorker} from '@/lib/learner-experience/stem/runInWorker';

class FakeWorker{
  static instances:FakeWorker[]=[];
  onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;terminated=false;posted:unknown[]=[];
  constructor(public url:unknown,public options:unknown){FakeWorker.instances.push(this);}
  postMessage(message:unknown){this.posted.push(message);}
  terminate(){this.terminated=true;}
}
beforeEach(()=>{
  vi.clearAllMocks();FakeWorker.instances=[];
  vi.stubGlobal('window',{setTimeout:globalThis.setTimeout.bind(globalThis),clearTimeout:globalThis.clearTimeout.bind(globalThis)});
});
afterEach(()=>vi.unstubAllGlobals());

describe('no page-thread execution fallback',()=>{
  it('RED: without Worker support the program is refused, not run on the page',async()=>{
    vi.stubGlobal('Worker',undefined);
    const result=await startInWorker('print 1').result;
    expect(m.run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error?.kind).toBe('RUNTIME');
    expect(result.output).toEqual([]);
  });
  it('RED: when the Worker cannot be constructed (e.g. CSP) the program is refused, not run on the page',async()=>{
    vi.stubGlobal('Worker',class{constructor(){throw new Error('SecurityError: refused by CSP');}});
    const result=await startInWorker('print 1').result;
    expect(m.run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error?.message).not.toContain('CSP');
  });
  it('the worker path still runs the program off the page and terminates the worker',async()=>{
    vi.stubGlobal('Worker',FakeWorker);
    const {result}=startInWorker('print 1');
    const worker=FakeWorker.instances[0];
    expect(worker.options).toMatchObject({type:'module',name:'llcode'});
    expect(worker.posted[0]).toMatchObject({source:'print 1'});
    worker.onmessage!({data:{version:LLCODE_VERSION,ok:true,output:['1'],steps:1,trace:[],traceTruncated:false,error:null}});
    expect((await result).ok).toBe(true);
    expect(worker.terminated).toBe(true);
    expect(m.run).not.toHaveBeenCalled();
  });
  it('Stop terminates the worker and reports a stop, never a page run',async()=>{
    vi.stubGlobal('Worker',FakeWorker);
    const run=startInWorker('while true');
    run.stop();
    const result=await run.result;
    expect(result.ok).toBe(false);expect(FakeWorker.instances[0].terminated).toBe(true);expect(m.run).not.toHaveBeenCalled();
  });
});

describe('static guard: the interpreter runs only inside the worker',()=>{
  it('no application, component or library module other than the worker calls runLLCode',async()=>{
    const {readdirSync,readFileSync,statSync}=await import('node:fs');
    const path=await import('node:path');
    const callers:string[]=[];
    const walk=(dir:string)=>{for(const name of readdirSync(dir)){const file=path.join(dir,name);
      if(statSync(file).isDirectory()){if(name!=='node_modules')walk(file);continue;}
      if(/\.(ts|tsx|js|mjs)$/.test(name)&&/\brunLLCode\s*\(/.test(readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'')))callers.push(file.split(path.sep).join('/'));}};
    for(const root of ['app','components','lib'])walk(root);
    expect(callers.sort()).toEqual(['lib/learner-experience/stem/llcode.ts','lib/learner-experience/stem/llcode.worker.ts']);
  });
});
