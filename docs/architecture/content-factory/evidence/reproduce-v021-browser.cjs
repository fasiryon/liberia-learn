const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root='artifacts/first-three-v2/browser-v021';fs.mkdirSync(root,{recursive:true});
const axeSource=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const audit=async page=>{await page.evaluate(axeSource);return page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return {violations:r.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.length})),incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),liveRegions:document.querySelectorAll('[aria-live],[role="status"]').length,horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth,unnamedControls:[...document.querySelectorAll('button,input,select')].filter(e=>e.offsetParent&&!(e.getAttribute('aria-label')||e.labels?.length||e.textContent.trim())).length};});};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  for(const lab of ['g7-liberia-counties','g7-water-particles','g7-fraction-manipulatives']){
   const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)||!['GET','HEAD'].includes(route.request().method()))return route.abort();return route.continue();});
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-10-20T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
   await page.goto(`http://localhost:3027/lab-review/${lab}?profile=FALLBACK_2D&scenario=overview`,{timeout:180000});
   await page.waitForFunction(()=>!!window.__labReview,{timeout:90000});await page.clock.runFor(2000);
   assert.equal(await page.locator('[data-lab-version]').getAttribute('data-lab-version'),'1.1.0');
   if(lab==='g7-water-particles'){
    for(const energy of [481,669,1924]){
     assert((await page.evaluate(energy=>window.__labReview.dispatch({type:'set-variables',values:{energyJPerG:energy,surfaceExchange:0}}),energy)).ok);
     await page.clock.runFor(1000);assert.match(await page.locator('body').innerText(),/Surface samples escape/);
    }
   }
   if(lab==='g7-liberia-counties'){
    await page.getByText('County keyboard list',{exact:true}).click();
    assert.match(await page.locator('body').innerText(),/a very short contact/);
    assert.equal(await page.getByLabel('Capital card',{exact:true}).locator('option').count(),18);
   }
   if(lab==='g7-fraction-manipulatives'){
    assert((await page.evaluate(()=>window.__labReview.dispatch({type:'set-variables',values:{denA:4,maskA:7,denB:3,maskB:3,tickA:8,tickB:8,lockedA:1,lockedB:0,relation:0,reason:0}}))).ok);
    await page.clock.runFor(200);assert.match(await page.locator('body').innerText(),/Count the jumps from 0 for each fraction before you choose/);
    assert((await page.evaluate(()=>window.__labReview.dispatch({type:'set-variables',values:{denA:3,maskA:15,denB:5,maskB:63,tickA:20,tickB:18,lockedA:1,lockedB:1,relation:3,reason:1}}))).ok);
    await page.clock.runFor(200);assert.match(await page.locator('body').innerText(),/Correct\. Now justify/);assert.match(await page.locator('body').innerText(),/15 equal intervals/);
    assert((await page.evaluate(()=>window.__labReview.dispatch({type:'set-variables',values:{denA:2,maskA:1,denB:4,maskB:3,tickA:0,tickB:0,lockedA:0,lockedB:0,relation:0,reason:0}}))).ok);
    await page.clock.runFor(200);
    const part=page.getByRole('button',{name:'Strip A, whole 1, piece 1 of 2',exact:true});
    await part.focus();await page.keyboard.press('t');await page.clock.runFor(200);
    assert.match(await page.locator('body').innerText(),/Strip A: 3\/6/);
    assert((await page.evaluate(()=>window.__labReview.dispatch({type:'set-variables',values:{denA:4,maskA:7,denB:3,maskB:3,tickA:9,tickB:8,lockedA:1,lockedB:1,relation:3,reason:0}}))).ok);
    await page.clock.runFor(200);assert.match(await page.locator('body').innerText(),/Correct\. Now justify/);
   }
   await page.clock.runFor(1000);
   const player=page.locator('[data-lab-active-profile]');
   const first=await player.screenshot({path:`${root}/${lab}-a.png`,animations:'disabled'}),second=await player.screenshot({path:`${root}/${lab}-b.png`,animations:'disabled'});
   assert.equal(sha(first),sha(second));assert.deepEqual(errors,[]);
   await page.clock.resume();// axe waits on timers; frames above were captured while paused.
   const accessibility=await audit(page);assert.deepEqual(accessibility.violations,[]);assert.equal(accessibility.unnamedControls,0);
   results.push({lab,version:'1.1.0',profile:'FALLBACK_2D',errors,checks:'PASS',accessibility,repeatedPausedFrameIdentical:true,sha256:sha(first)});
   await page.close();
  }
  for(const lab of ['g7-liberia-counties','g7-water-particles','g7-fraction-manipulatives']){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)||!['GET','HEAD'].includes(route.request().method()))return route.abort();return route.continue();});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://localhost:3027/lab-review/${lab}?profile=FALLBACK_2D&scenario=overview`,{timeout:180000});
   await page.waitForFunction(()=>!!window.__labReview,{timeout:90000});
   const accessibility=await audit(page);
   assert.deepEqual(accessibility.violations,[]);assert.equal(accessibility.horizontalOverflow,false);assert.equal(accessibility.unnamedControls,0);assert.deepEqual(errors,[]);
   results.push({lab,width:390,touch:true,profile:'FALLBACK_2D',errors,accessibility});
   await context.close();
  }
 }finally{await browser.close();fs.writeFileSync(`${root}/report.json`,JSON.stringify({results,scope:'Local software Chromium scripted V2 behavior and repeated paused frames. Not independent-run capture determinism, visual signoff or real-device certification.'},null,2)+'\n');}
 console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
