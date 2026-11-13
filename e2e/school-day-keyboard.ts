import type {Page,Locator,TestInfo} from '@playwright/test';

type KeyboardPage={keyboard:Pick<Page['keyboard'],'press'>;evaluate:Page['evaluate']};
type KeyboardTarget=Pick<Locator,'evaluate'|'isVisible'|'isEnabled'>;

async function focusSnapshot(page:KeyboardPage){
  return page.evaluate(()=>{
    const controls=Array.from(document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]'))
      .filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&!el.closest('[inert]')&&el.getClientRects().length>0);
    const active=document.activeElement;
    // No text, values, names, IDs, URLs, cookies, nonce or arbitrary attributes.
    return {tag:active instanceof HTMLElement?active.tagName:null,body:active===document.body,
      ordinal:active instanceof HTMLElement?controls.indexOf(active):-1,focusableCount:controls.length};
  });
}

/** Prove keyboard arrival, forward exit and reverse return for one control. */
export async function assertKeyboardReach(page:KeyboardPage,target:KeyboardTarget,info?:Pick<TestInfo,'attach'>,label='control'){
  const transitions:Array<{key:string;targetFocused:boolean;tag:string|null;body:boolean;ordinal:number;focusableCount:number}>=[];
  let tabLimit=0;
  const focused=()=>target.evaluate(el=>el===document.activeElement);
  const record=async(key:string)=>{const state=await focusSnapshot(page);const targetFocused=await focused();transitions.push({key,...state,targetFocused});return {...state,targetFocused};};
  try{
    if(!await target.isVisible()||!await target.isEnabled()||!await target.evaluate(el=>el instanceof HTMLElement&&el.tabIndex>=0&&!el.closest('[inert]')))
      throw Error('school_day_keyboard_target_ineligible');
    const initial=await record('start');
    tabLimit=Math.min(128,Math.max(8,initial.focusableCount+4));
    let reached=false;
    // Always send a real Tab, even if the target happens to start focused.
    for(let step=0;step<tabLimit;step++){
      await page.keyboard.press('Tab');
      if((await record('Tab')).targetFocused){reached=true;break;}
    }
    if(!reached)throw Error('school_day_keyboard_target_unreachable');
    await page.keyboard.press('Tab');
    const after=await record('Tab-exit');
    if(after.targetFocused)throw Error('school_day_keyboard_forward_trap');
    await page.keyboard.press('Shift+Tab');
    if(!(await record('Shift+Tab-return')).targetFocused)throw Error('school_day_keyboard_reverse_return_failed');
  }finally{
    if(info)await info.attach(`keyboard-${label}`,{body:Buffer.from(JSON.stringify({maxTabLimit:128,tabLimit,transitions},null,2)),contentType:'application/json'});
  }
}
