import fs from "fs";
import path from "path";
import {execFileSync} from "child_process";
import assert from "assert/strict";
import {bytesHash} from "../lib/content-factory/v2/batchContract";
import {digest} from "../lib/content-factory/v2/blueprint";
import {FIRST_TEN_BASELINE} from "../lib/content-factory/v2/firstTen";
import {loadPinnedAuthoringCohort,processAuthoredSubset} from "../lib/content-factory/v2/partialBatch";
import {authoringInputSchema,validateAuthoringInput,authoringGenerationInput} from "../lib/content-factory/v2/authoringInput";
import {resolveAuthoredRuntime} from "../lib/content-factory/v2/runtimeBindings";
import {verifyFirstThreeRuntimeSources} from "../lib/content-factory/v2/runtimeSource";
import {loadPinnedContractPolicy} from "../lib/content-factory/v2/contractPolicySource";
import {FIRST_TEN_CONTRACT_PIN} from "../lib/content-factory/v2/contractPolicy";

const expected:Record<string,string>={
 wk_mca7a_fri_p4:"25f24f33a77c47233a1d500323fa8d94d72774a2045f9bf60db808a86fac31d1",
 wk_mca7a_fri_p3:"9d3bee7de50f1ff9429c7b6726ee90044b50ad6e9fc8cf01b82480da61db8b0c",
 lesson_mca_1:"99de3cfb3eba234fb783ed69f7b0ecaefe6dfa6e982e9998444523221a832b9a",
};
const previous=JSON.parse(fs.readFileSync("docs/architecture/content-factory/evidence/first-three-production.json","utf8"));
const sourceRoot="C:/restricted-authoring/completed-v021";
const outputRoot=path.resolve(process.argv[2]||"C:/restricted-authoring/review-packages/first-three-v021-final");
const reportFile="docs/architecture/content-factory/evidence/first-three-v021-reconciliation.json";
const read=(file:string)=>JSON.parse(fs.readFileSync(file,"utf8"));
function inventory(root:string):{file:string;sha256:string;modifiedMs:number}[]{
 const walk=(dir:string):string[]=>fs.readdirSync(dir).flatMap(name=>{const file=path.join(dir,name);assert(!fs.lstatSync(file).isSymbolicLink());return fs.statSync(file).isDirectory()?walk(file):[file];});
 return walk(root).sort().map(file=>({file:path.relative(root,file),sha256:bytesHash(fs.readFileSync(file)),modifiedMs:fs.statSync(file).mtimeMs}));
}
function verifyPackage(dir:string){
 const manifest=read(path.join(dir,"manifest.json")),{packageHash,...body}=manifest;
 assert.equal(packageHash,digest("factory-batch-package",body));
 assert.deepEqual(fs.readdirSync(dir).filter(f=>f!=="manifest.json").sort(),Object.keys(manifest.files).sort());
 for(const [file,hash] of Object.entries(manifest.files)){assert.equal(path.basename(file),file);assert.equal(bytesHash(fs.readFileSync(path.join(dir,file))),hash);}
 return manifest;
}
async function main(){
 const historicalRoots=[previous.outputRoot,"C:/restricted-authoring/review-packages/first-three-v2-reconciliation","C:/restricted-authoring/review-packages/first-three-v2-61fa60b7"];
 assert(!historicalRoots.some(root=>path.resolve(root)===outputRoot),"historical_output_forbidden");
 const historyBefore=historicalRoots.map(root=>({root,files:inventory(root)}));
 const handoffPath=path.join(sourceRoot,"evidence/records/factory-owner-v021-handoff.md");
 const handoffSha256=bytesHash(fs.readFileSync(handoffPath));
 assert.equal(handoffSha256,"323289de212d425a3cf827df299e9d8e5277a6a56ce2c1b833150aeee11f55fb");
 assert.equal(bytesHash(fs.readFileSync(path.join(sourceRoot,"evidence/records/README.md"))),"959fdfa9cadad90b71436a07e3d8cdabd96ee2a2cd28d2639467b617f5a00295");
 const oldBefore=inventory(previous.outputRoot);
 for(const p of previous.packages){
  assert.equal(verifyPackage(p.reviewPackage).packageHash,p.packageHash);
  const evidence=read(path.join(p.reviewPackage,"input.json"));
  const original=Buffer.from(evidence.originalAuthoringInputBase64,"base64");
  assert.equal(bytesHash(original),previous.sourceInputs.find((i:{contentId:string})=>i.contentId===p.contentId).sha256);
 }
 const cohort=loadPinnedAuthoringCohort(execFileSync("git",["show",`${FIRST_TEN_BASELINE.sourceCommit}:${FIRST_TEN_BASELINE.specPath}`]),"C:/liberia-learn/.worktrees/library-modernization-v1/artifacts/library-modernization-v1/extract");
 const ids=Object.keys(expected),authoringInputs=ids.map(id=>fs.readFileSync(path.join(sourceRoot,`${id}.authored.json`)));
 const sourceInputs=authoringInputs.map((bytes,index)=>{
  const contentId=ids[index];assert.equal(bytesHash(bytes),expected[contentId]);
  const input=authoringInputSchema.parse(JSON.parse(bytes.toString("utf8")));
  const old=read(path.join(previous.packages.find((p:{contentId:string})=>p.contentId===contentId).reviewPackage,"input.json"));
  assert.deepEqual(input.source,JSON.parse(Buffer.from(old.originalAuthoringInputBase64,"base64").toString("utf8")).source);
  const validation=validateAuthoringInput(input,"authored",cohort.requirements);assert(validation.valid,JSON.stringify(validation));
  const binding=resolveAuthoredRuntime(input);assert(binding);assert.equal(binding.authoredGeneration,"V0.2.1");
  assert.equal(resolveAuthoredRuntime({...input,cohortCommit:"0".repeat(40)}),null);
  const generated=authoringGenerationInput(input,cohort.requirements);
  if(contentId==="wk_mca7a_fri_p4"){
   assert(binding.bindings.some(b=>b.sceneId==="s12-place-capitals"));assert(binding.bindings.some(b=>b.sceneId==="s12b-place-interior"));
   const lesson=Object.values(generated).flat().find(r=>r.payload.kind==="LESSON");assert(lesson?.payload.kind==="LESSON");
   for(const sceneId of ["s12-place-capitals","s12b-place-interior"])assert.equal(lesson.payload.candidate.scenes.find(s=>s.id===sceneId)?.interaction?.kind,"LAB_LAUNCH");
  }
  const lessonScenes=input.resources.flatMap(r=>{const payload=r.payload as {kind?:string;candidate?:{scenes:{id:string;type:string}[]}};return payload.kind==="LESSON"?payload.candidate!.scenes.map(scene=>({resourceId:r.id,...scene})):[];});
  const media=input.mediaSpecifications.map(m=>{
   const svg=path.join(sourceRoot,"media/svg",path.basename(m.provenance!.sourceRef));
   assert(fs.existsSync(svg),`media_source_missing:${m.id}`);assert.equal(bytesHash(fs.readFileSync(svg)),m.provenance!.sha256,`media_source_hash:${m.id}`);
   if(m.implementation==="GOVERNED_INTERACTION"){assert(binding.bindings.some(b=>b.mediaId===m.id&&b.sceneId===m.sceneId),`media_unbound:${m.id}`);return {mediaId:m.id,implementation:m.implementation,sceneId:m.sceneId,sourceSha256:m.provenance!.sha256,runtime:binding.bindings.filter(b=>b.mediaId===m.id).map(b=>({sceneId:b.sceneId,labId:b.labId,labVersion:b.labVersion}))};}
   const asset=input.assets.find(a=>a.mediaId===m.mediaId);assert(asset,`static_asset_missing:${m.id}`);
   const assetBytes=Buffer.from(asset.bytesBase64,"base64");assert.equal(bytesHash(assetBytes),asset.sha256,`static_asset_hash:${m.id}`);
   return {mediaId:m.id,implementation:m.implementation,sceneId:m.sceneId,sourceSha256:m.provenance!.sha256,embeddedAsset:{mediaId:asset.mediaId,sha256:asset.sha256}};
  });
  const assets=input.assets.map(a=>{const bytes=Buffer.from(a.bytesBase64,"base64");const delivered=fs.readdirSync(path.join(sourceRoot,"media")).find(f=>f.endsWith(".png")&&bytesHash(fs.readFileSync(path.join(sourceRoot,"media",f)))===a.sha256);assert.equal(bytesHash(bytes),a.sha256,`asset_hash:${a.mediaId}`);assert(delivered,`asset_not_delivered:${a.mediaId}`);return {mediaId:a.mediaId,sceneId:a.sceneId,sha256:a.sha256,deliveredFile:`media/${delivered}`};});
  const labScenes=lessonScenes.filter(scene=>scene.type==="LAB").map(scene=>({sceneId:scene.id,runtime:binding.bindings.find(b=>b.sceneId===scene.id)?.labId??null,staticMedia:input.mediaSpecifications.find(m=>m.sceneId===scene.id&&m.implementation==="STATIC_ASSET")?.id??null}));
  for(const scene of labScenes)assert(scene.runtime||scene.staticMedia,`lab_scene_unbound:${contentId}:${scene.sceneId}`);
  return {contentId,source:input.source,mediaAudit:{media,assets,labScenes},oldAuthoredSha256:previous.sourceInputs.find((i:{contentId:string})=>i.contentId===contentId).sha256,authoredSha256:bytesHash(bytes),canonicalSha256:binding.authoredCanonicalSha256,verdict:"CORRECTED_V021_ADOPTED_AS_DRAFT_BASELINE",runtimeBinding:binding,validation:{valid:validation.valid,failures:validation.failures,missing:validation.missing}};
 });
 const runtimeSources=verifyFirstThreeRuntimeSources();
 const stated=read("curriculum/factory-v2/authoring/first-three/stated-primary-objectives-v021.json");
 assert.deepEqual(stated.appliesTo,expected);
 const contractPolicy=loadPinnedContractPolicy("V0.2.1");
 const options={enabled:true,cohort,selectedIds:ids,authoringInputs,outputRoot,contractPolicy};
 const first=await processAuthoredSubset(options),before=inventory(outputRoot),second=await processAuthoredSubset(options),after=inventory(outputRoot);
 assert.deepEqual(first,second);assert.deepEqual(before,after);assert.deepEqual(oldBefore,inventory(previous.outputRoot));
 for(const history of historyBefore)assert.deepEqual(history.files,inventory(history.root));
 const packages=fs.readdirSync(path.join(outputRoot,"packages")).map(slot=>{
  const dir=path.join(outputRoot,"packages",slot),manifest=verifyPackage(dir),summary=read(path.join(dir,"summary.json")),comparison=read(path.join(dir,"comparison.json")),input=read(path.join(dir,"input.json"));
  assert.equal(input.assessmentAttribution.rule,"ITEM_LEVEL_ONLY_FOR_SINGLE_OBJECTIVE_TASKS");assert.equal(input.assessmentAttribution.canonicalMasteryMutation,false);assert.equal(input.contractPolicy.retention.policy.status,"INTERNAL_ENGINEERING_BASELINE");assert(Object.keys(input.contractPolicy.misconceptionCrosswalk.map).length>0);
  const source=sourceInputs.find(s=>s.contentId===comparison.source.contentId)!;assert.equal(bytesHash(Buffer.from(input.originalAuthoringInputBase64,"base64")),source.authoredSha256);
  assert.equal(input.assessmentAttribution.releaseBlockers.length,0);
  assert.equal(summary.state,"DRAFT");assert.equal(summary.approved,false);assert.equal(summary.released,false);assert.equal(summary.failures.length,0);
  return {contentId:comparison.source.contentId,reviewPackage:dir,manifest:path.join(dir,"manifest.json"),manifestFileSha256:bytesHash(fs.readFileSync(path.join(dir,"manifest.json"))),packageHash:manifest.packageHash,candidateContentHashes:comparison.candidates.map((c:{resourceId:string;contentHash:string})=>({resourceId:c.resourceId,contentHash:c.contentHash})),resources:fs.readdirSync(dir).filter(f=>f.startsWith("artifact-")).map(f=>{const a=read(path.join(dir,f));return {resourceId:a.id,version:a.version,role:a.role,contentHash:a.contentHash,file:f,fileSha256:manifest.files[f]};}).sort((a:{resourceId:string},b:{resourceId:string})=>a.resourceId.localeCompare(b.resourceId)),state:summary.state,reviewState:summary.reviewState,releaseBlockers:summary.releaseBlockers,misconceptionCrosswalk:input.contractPolicy.misconceptionCrosswalk.map,retentionPolicy:input.contractPolicy.retention.policy,attribution:{taskOnly:input.assessmentAttribution.tasks.filter((t:{attribution:string})=>t.attribution==="TASK_ONLY").map((t:{taskId:string})=>t.taskId),itemLevel:input.assessmentAttribution.tasks.filter((t:{attribution:string})=>t.attribution==="ITEM").map((t:{taskId:string})=>t.taskId),blockers:input.assessmentAttribution.releaseBlockers}};
 });
 const codeCommit=execFileSync("git",["rev-parse","HEAD"]).toString().trim();
 assert.equal(execFileSync("git",["status","--porcelain","--","lib","components","scripts","curriculum"]).toString().trim(),"","factory_tree_not_clean");
 const draftAttemptRoot="C:/restricted-authoring/review-packages/first-three-v2-reconciliation";
 const draftAttempt=fs.existsSync(draftAttemptRoot)&&path.resolve(draftAttemptRoot)!==outputRoot?{root:draftAttemptRoot,status:"PRESERVED_HISTORICAL_V2_DRAFT_EVIDENCE",fileInventorySha256:bytesHash(JSON.stringify(inventory(draftAttemptRoot)))}:null;
 const report={schemaVersion:"first-three-v021-reconciliation/1.0.0",codeCommit,handoff:{path:handoffPath,sha256:handoffSha256},historicalPreservation:historyBefore.map(h=>({root:h.root,fileCount:h.files.length,bytesAndMtimesUnchanged:true,inventorySha256:bytesHash(JSON.stringify(h.files))})),baselineEvidenceCommit:"25da765d9bcc8805c2859e6e3c4ed131c0337fd9",outputRoot,
 contract:{designation:contractPolicy.contract.designation,contractPin:FIRST_TEN_CONTRACT_PIN,amendments:contractPolicy.contract.amendments},draftAttempt,sourceInputs,packages,runtimeSources,submission:first,
 supersededDrafts:{root:previous.outputRoot,packages:previous.packages.map((p:{contentId:string;packageHash:string;reviewPackage:string})=>({contentId:p.contentId,packageHash:p.packageHash,reviewPackage:p.reviewPackage,status:"SUPERSEDED_DRAFT"})),allBytesAndModificationTimesUnchanged:true,fileCount:oldBefore.length},
 deterministicRerun:{receiptIdentical:true,allFileBytesAndModificationTimesUnchanged:true,fileCount:before.length,fileInventorySha256:bytesHash(JSON.stringify(before))},assessmentAttribution:"ITEM_LEVEL_ONLY_FOR_SINGLE_OBJECTIVE_TASKS_NO_MASTERY_WRITES",productionWrites:false,published:false,approved:false,released:false,
 reviewReadiness:"DRAFT_READY_FOR_LIBRARY_MODERNIZATION_QA_NOT_ACADEMIC_APPROVAL",remainingGates:["INDEPENDENT_QA_OF_EXACT_V021_CANDIDATES","QUALIFIED_HUMAN_SUBJECT_REVIEW","ASSESSMENT_MEDIA_CHANNEL","AUTHORITATIVE_ITEM_OBJECTIVE_CONTRACT","MANUAL_ACCESSIBILITY_AND_REAL_DEVICE_QA","SOURCE_ATTESTATION_AND_RELEASE_AUTHORIZATION"]};
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({reportFile,packages,deterministicRerun:report.deterministicRerun},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
