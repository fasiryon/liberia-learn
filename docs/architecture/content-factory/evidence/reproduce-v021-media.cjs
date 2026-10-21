const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root='C:/restricted-authoring/completed-v021';
const figures=fs.readdirSync(root+'/media/svg').map(name=>({file:'media/svg/'+name,sha256:sha(fs.readFileSync(root+'/media/svg/'+name))}));
const pngs=fs.readdirSync(root+'/media').filter(f=>f.endsWith('.png')).map(name=>({file:'media/'+name,sha256:sha(fs.readFileSync(root+'/media/'+name))}));
const references=[];
for(const id of ['wk_mca7a_fri_p4','wk_mca7a_fri_p3','lesson_mca_1']){
 const input=JSON.parse(fs.readFileSync(root+'/'+id+'.authored.json'));
 function walk(value,location){
  if(!value||typeof value!=='object')return;
  for(const [key,ref]of Object.entries(value)){
   if(typeof ref==='string'&&/^repo-path:.*\.(png|svg)$/.test(ref)){
    const file=(ref.endsWith('.svg')?'media/svg/':'media/')+path.basename(ref);
    const actual=sha(fs.readFileSync(root+'/'+file));
    const declared=value.sha256??value.contentHash??null;
    if(declared&&/^[a-f0-9]{64}$/.test(declared))assert.equal(actual,declared,location);
    references.push({contentId:id,location:location+'/'+key,sourceRef:ref,file,declaredSha256:declared,actualSha256:actual});
   }else walk(ref,location+'/'+key);
  }
 }
 walk(input,'');
}
fs.writeFileSync('docs/architecture/content-factory/evidence/first-three-v021-media.json',JSON.stringify({codeCommit:require('child_process').execFileSync('git',['rev-parse','HEAD']).toString().trim(),figures,pngs,references,scope:'All delivered figures and PNGs hashed locally. Every repo-path SVG/PNG reference resolves locally. Remote publication and rights clearance remain blocked.',productionWrites:false},null,2)+'\n');
console.log(JSON.stringify({figures:figures.length,pngs:pngs.length,references:references.length,verifiedDeclaredHashes:references.filter(x=>x.declaredSha256).length}));
