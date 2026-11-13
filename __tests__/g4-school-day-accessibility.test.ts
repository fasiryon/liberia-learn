import {describe,it,expect,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {injectSchoolDayAxe} from '../e2e/school-day-accessibility';

// A CSP boundary model, not browser acceptance. The private browser suite must
// still execute real axe with the unchanged production policy and assertions.
function fixture(hasNonce:boolean){
  const window={axe:undefined};
  const script={nonce:'',textContent:''};
  const document={
    querySelector:vi.fn(()=>hasNonce?{nonce:'synthetic-test-only-nonce'}:null),
    createElement:vi.fn(()=>script),
    head:{appendChild:vi.fn(()=>{
      if(script.nonce!=='synthetic-test-only-nonce')throw Error('synthetic_csp_refused_script');
      if(!script.textContent.includes('axe'))throw Error('axe_source_missing');
      window.axe={run:()=>{}};
    })},
  };
  const page={evaluate:vi.fn(async(fn,source)=>runInNewContext(`(${fn.toString()})(source)`,{source,document,window})),addScriptTag:vi.fn(async()=>{throw Error('synthetic_csp_refused_script');})};
  return {page,document,window};
}
describe('school-day accessibility instrumentation preserves nonce CSP',()=>{
  it('uses the page-authorized nonce without transporting it out of the browser',async()=>{
    const f=fixture(true);
    await injectSchoolDayAxe(f.page);
    expect(f.window.axe).toBeDefined();
    expect(f.document.head.appendChild).toHaveBeenCalledOnce();
    expect(f.page.addScriptTag).not.toHaveBeenCalled();
    expect(f.page.evaluate.mock.calls[0][1]).not.toContain('synthetic-test-only-nonce');
  });
  it('fails closed when the document has no authorized nonce',async()=>{
    const f=fixture(false);
    await expect(injectSchoolDayAxe(f.page)).rejects.toThrow('school_day_accessibility_nonce_missing');
    expect(f.document.head.appendChild).not.toHaveBeenCalled();
    expect(f.window.axe).toBeUndefined();
  });
});
