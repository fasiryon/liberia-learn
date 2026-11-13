import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export async function injectSchoolDayAxe(page:Pick<Page,'evaluate'>){
  // Keep the page's per-response nonce inside the browser. It must never enter
  // Playwright arguments, attachments, logs, or a relaxed test-only CSP.
  await page.evaluate(source=>{
    const nonce=document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
    if(!nonce)throw Error('school_day_accessibility_nonce_missing');
    const script=document.createElement('script');
    script.nonce=nonce;
    script.textContent=source;
    document.head.appendChild(script);
    if(!('axe' in window))throw Error('school_day_accessibility_instrumentation_missing');
  },readFileSync(resolve('node_modules/axe-core/axe.min.js'),'utf8'));
}
