#!/usr/bin/env node
/** V4 factory instruction-quality metrics (CoS). Usage: node scripts/cos-stem/audit-draft6-instruction.cjs <path to a factory-v4 drafts/<version> dir>. Read-only. */
const fs=require('fs'),path=require('path');
const root=process.argv[2];
for(const d of fs.readdirSync(root).filter(x=>!x.includes('.')&&x!=='review')){
  const c=JSON.parse(fs.readFileSync(path.join(root,d,'candidate.json')));
  let checks=0,opt2=0,optN=[],hints=0,miscon=new Set(),generic=0,blocks={},frees=0,words=0,emptyHints=0;
  const genericRe=/Use the model, complete its task|explain what the representation shows/i;
  for(const s of c.scenes){
    words+=(s.content?.body||'').split(/\s+/).length;
    if(genericRe.test(s.learnerAction||''))generic++;
    if(!s.hints||s.hints.length===0)emptyHints++; else hints+=s.hints.length;
    (s.misconceptionIds||[]).forEach(m=>miscon.add(m));
    if(s.interaction?.kind==='FREE_RESPONSE')frees++;
    for(const b of (s.teaching?.blocks||[])){blocks[b.type]=(blocks[b.type]||0)+1;
      if(b.type==='CHECK')for(const it of b.items){checks++;optN.push(it.options.length);if(it.options.length===2)opt2++;if(it.misconceptionId)miscon.add(it.misconceptionId)}}
  }
  console.log(JSON.stringify({lesson:d,title:c.title,min:c.estimatedMinutes,scenes:c.scenes.length,bodyWords:words,checkItems:checks,twoOptionItems:opt2,optionCounts:[...new Set(optN)],scenesWithoutHints:emptyHints,freeResponseScenes:frees,genericLearnerActions:generic,misconceptions:[...miscon],blocks}));
}
