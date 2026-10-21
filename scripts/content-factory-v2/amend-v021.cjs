// Generate the additive C13 erratum from immutable contract bytes. No authored payloads.
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const base = JSON.parse(cp.execFileSync('git', ['show', 'ac196397c:curriculum/modernization/v1/first-ten/spec.json']));
const changes = [
  {path:'/lessons/0/independentAssessment/endOfLesson/2/task', to:'Three items (ft01-a3-q1, ft01-a3-q2, ft01-a3-q4) whose distractors are mapped to M1–M4. Report this mixed-objective task at task level only.'},
  {path:'/lessons/3/independentAssessment/endOfLesson/3/task', to:'Four items (ft04-a4-q1 through ft04-a4-q4) whose distractors are mapped to M1–M6. Report this mixed-objective task at task level only.'},
].map(c => ({op:'replace', ...c, from:c.path.split('/').slice(1).reduce((v,k)=>v[k],base)}));
const amendment = {
  amendmentId:'FT-A002', amendmentVersion:'1.0.0', conflict:'C13',
  effectiveDesignation:'liberialearn-first-ten-modernization-contract/1.0.0+FT-A001+FT-A002',
  target:{sha256:'648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b'},
  authority:'Founder instruction: adopt corrected V0.2.1 and resolve C13 by versioned amendment. DRAFT engineering only; no academic approval.',
  changes,
  derivedTasks:[
    {id:'ft01-a5',objectiveId:'ft01-o3',itemId:'ft01-a3-q3',standaloneMastery:false},
    {id:'ft01-a6',objectiveId:'ft01-o2',itemId:'ft01-a3-q5-tf',standaloneMastery:false},
    {id:'ft04-a5',objectiveId:'ft04-o3',itemId:'ft04-a4-q5',standaloneMastery:false},
    {id:'ft07-a5',objectiveId:'ft07-o3',itemId:'ft07-a5-order',standaloneMastery:false},
  ],
  constraints:['Existing a1–a4 kinds, scoring and objective sets are unchanged.', 'Mixed-objective and transfer tasks remain TASK_ONLY.', 'No single binary item independently establishes mastery.', 'FT-A001, original spec and original manifest remain unchanged.'],
  state:'DRAFT',approved:false,published:false,released:false,
};
const file='curriculum/factory-v2/authoring/first-three/amendments/FT-A002-v021-assessment-counts.json';
fs.mkdirSync(require('path').dirname(file),{recursive:true});
const bytes=Buffer.from(JSON.stringify(amendment,null,2)+'\n');
fs.writeFileSync(file,bytes);
console.log(crypto.createHash('sha256').update(bytes).digest('hex'));
