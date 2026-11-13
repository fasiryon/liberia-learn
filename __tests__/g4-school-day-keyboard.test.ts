import {describe,it,expect,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {assertKeyboardReach} from '../e2e/school-day-keyboard';

// Focus-order model only. Actual viewport DOM and keyboard results remain a
// mandatory private browser gate; this does not assert browser-chrome behavior.
function fixture(options:{trap?:boolean;unreachable?:boolean;reverseMiss?:boolean;ineligible?:boolean}={}){
  class Element{
    constructor(public tagName:string,public tabIndex=0){}
    matches(){return false;}
    closest(){return null;}
    getClientRects(){return [1];}
  }
  const lead=new Element('A'),targetNode=new Element('BUTTON'),body=new Element('BODY',-1);
  const order=[lead,targetNode,body];let index=0;
  const document={body,get activeElement(){return order[index];},querySelectorAll:()=>[lead,targetNode]};
  const context={document,HTMLElement:Element,target:targetNode};
  const execute=(fn:{toString():string},arg?:unknown)=>runInNewContext(`(${fn.toString()})(arg)`,{...context,arg});
  const page={evaluate:vi.fn(async(fn)=>execute(fn)),keyboard:{press:vi.fn(async(key:string)=>{
    if(options.trap&&index===1&&key==='Tab')return;
    index=(index+(key==='Shift+Tab'?-1:1)+order.length)%order.length;
    if(options.unreachable&&index===1)index=key==='Shift+Tab'?0:2;
    if(options.reverseMiss&&key==='Shift+Tab')index=0;
  })}};
  const target={isVisible:vi.fn(async()=>!options.ineligible),isEnabled:vi.fn(async()=>true),evaluate:vi.fn(async(fn)=>execute(fn,targetNode))};
  const info={attach:vi.fn()};
  return {page,target,info};
}

describe('bounded real-keyboard probe contract',()=>{
  it('permits the document boundary only with real Tab arrival, forward exit and Shift+Tab return',async()=>{
    const f=fixture();await assertKeyboardReach(f.page,f.target,f.info);
    expect(f.page.keyboard.press.mock.calls.map(([key])=>key)).toEqual(['Tab','Tab','Shift+Tab']);
    const receipt=JSON.parse(f.info.attach.mock.calls[0][1].body.toString());
    expect(receipt.transitions.map(row=>[row.key,row.targetFocused,row.body])).toEqual([
      ['start',false,false],['Tab',true,false],['Tab-exit',false,true],['Shift+Tab-return',true,false],
    ]);
    expect(Object.keys(receipt.transitions[0]).sort()).toEqual(['body','focusableCount','key','ordinal','tag','targetFocused']);
  });
  it('rejects a real forward focus trap and still attaches bounded evidence',async()=>{
    const f=fixture({trap:true});await expect(assertKeyboardReach(f.page,f.target,f.info)).rejects.toThrow('school_day_keyboard_forward_trap');
    expect(f.info.attach).toHaveBeenCalledOnce();
  });
  it('rejects an unreachable target within a finite number of Tabs',async()=>{
    const f=fixture({unreachable:true});await expect(assertKeyboardReach(f.page,f.target,f.info)).rejects.toThrow('school_day_keyboard_target_unreachable');
    expect(f.page.keyboard.press).toHaveBeenCalledTimes(8);
  });
  it('requires reverse return instead of treating any non-target focus as success',async()=>{
    const f=fixture({reverseMiss:true});await expect(assertKeyboardReach(f.page,f.target)).rejects.toThrow('school_day_keyboard_reverse_return_failed');
  });
  it('refuses an ineligible control without keyboard or focus manipulation',async()=>{
    const f=fixture({ineligible:true});await expect(assertKeyboardReach(f.page,f.target)).rejects.toThrow('school_day_keyboard_target_ineligible');
    expect(f.page.keyboard.press).not.toHaveBeenCalled();
  });
});
