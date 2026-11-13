from pathlib import Path
import subprocess,json,hashlib
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT,text=True,encoding='utf-8').strip()
items=[('docs/stem-excellence-program-v1','docs/program/STEM_PROGRAM_V1.md','CoS full K-12 day program explicitly says not merged/deployed/activated; synthetic school isolated; production-content review claims must be read against mechanical baseline.'),('feat/content-factory-schoolday','docs/architecture/content-factory/V4_GENERATED_CANDIDATES_HANDOFF.md','Draft V4 packages produced by injected deterministic author executor; full bundle REVISION_REQUIRED; branch handoff is not released capability.'),('feat/content-factory-v4-pipeline','docs/architecture/content-factory/V4_GENERATED_CANDIDATES_HANDOFF.md','V4 candidate workflow reuses Content Factory V2; no separate LLM agent implied.'),('feat/learning-loop-integration-v1','docs/architecture/LEARNING_ORCHESTRATOR_DECISION_INTELLIGENCE_V1.md','Branch carries learning foundations; unique recent commit messages describe first-ten adapter and implementation-ready handoff rather than production activation.')]
rows=[]
for branch,path,claim in items:
    commit=git('rev-parse',branch)
    try:
        raw=subprocess.check_output(['git','show',commit+':'+path],cwd=ROOT)
        body=raw.decode('utf-8-sig');blob=git('rev-parse',commit+':'+path)
    except subprocess.CalledProcessError:continue
    rows.append(dict(id='BRANCH-'+str(len(rows)+1),branch=branch,source_commit=commit,path=path,git_blob=blob,fingerprint=hashlib.sha256(raw).hexdigest(),fingerprint_kind='sha256-raw-git-object',symbol='branch context',line_start=1,line_end=min(30,len(body.splitlines())),category='branch-documentation',related='in-flight-work',confidence='medium',verification='branch document + commit metadata; runtime unverified',claim=claim,unique_recent_commits=git('log','-4','--format=%h %s','887f23ecc..'+commit).splitlines()))
(OUT/'BRANCH_CONTEXT.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('Pinned branch contexts:',len(rows))
