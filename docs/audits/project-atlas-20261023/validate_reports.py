"""Verify report integrity and cached evidence without executing application code."""
from pathlib import Path
import json,csv,re,hashlib,subprocess,collections
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
errors=[]; checked=0
for p in OUT.glob('*.json'):
    try:read(p)
    except Exception as e:errors.append(str(p)+': '+str(e))
reg=read(OUT/'AGENT_REGISTRY.json');doc=read(OUT/'AUDIT_EVIDENCE.json');ids={a['id'] for a in reg['agents']}; ev={e['id']:e for e in doc['evidence']}
if len(ids)!=len(reg['agents']):errors.append('duplicate registry ID')
if len(ev)!=len(doc['evidence']):errors.append('duplicate evidence ID')
required=['id','name','aliases','purpose','intended_users','implementation','type','model_provider','orchestration','trigger','inputs','outputs','tools_permissions','database_access','external_services','dependencies','feature_flags','status','last_execution','logging_evaluation_cost','risks','recommendation','evidence']
cache={}
for a in reg['agents']:
    for k in required:
        if k not in a:errors.append(a['id']+' missing '+k)
    if not a['evidence']:errors.append(a['id']+' has no evidence')
    for p in a['implementation']:
        if not (ROOT/p).is_file():errors.append(a['id']+' bad implementation '+p)
    for eid in a['evidence']:
        if eid not in ev:errors.append(a['id']+' unknown evidence '+eid)
for e in doc['evidence']:
    p=e['path']
    if e['source_commit']!=doc['source_commit']:
        # Branch objects remain pinned and are independently checked via Git.
        blob=subprocess.check_output(['git','rev-parse',e['source_commit']+':'+p],cwd=ROOT,text=True).strip()
        if blob!=e['git_blob']:errors.append('branch blob mismatch '+e['id'])
        raw=subprocess.check_output(['git','show',e['source_commit']+':'+p],cwd=ROOT)
        if hashlib.sha256(raw).hexdigest()!=e['fingerprint']:errors.append('branch fingerprint mismatch '+e['id'])
        continue
    if p not in cache:
        raw=(ROOT/p).read_bytes();cache[p]=(hashlib.sha256(raw).hexdigest(),len(raw.splitlines()))
    fingerprint,n=cache[p]
    if e.get('fingerprint') and e['fingerprint']!=fingerprint:errors.append('fingerprint mismatch '+e['id'])
    if not 1<=e['line_start']<=e['line_end']<=n:errors.append('line range invalid '+e['id'])
    checked+=1
with (OUT/'AGENT_INVENTORY.csv').open(encoding='utf-8',newline='') as f: csvrows=list(csv.DictReader(f))
if {x['id'] for x in csvrows}!=ids:errors.append('CSV registry drift')
entrypoints=read(OUT/'WORKFLOW_ENTRYPOINTS.json')
if len([x for x in entrypoints if x['type']=='scheduled automation'])!=37:errors.append('workflow declaration coverage drift')
for x in entrypoints:
    if x['parent_registry_id'] not in ids or not x.get('owner') or not x.get('status'):errors.append('unowned workflow '+x['id'])
coverage=read(OUT/'DISCOVERY_COVERAGE.json')
for x in coverage:
    if x['runtime_candidate'] and 'llm' in x['categories'] and x['review']=='discovery-only reference; not established as separate agent':errors.append('unclassified runtime provider lead '+x['path'])
links=0
for p in OUT.glob('*.md'):
    text=p.read_text(encoding='utf-8-sig')
    for target in re.findall(r'\]\(([^\n)]+)\)',text):
        if target.startswith(('http:','https:','mailto:','#')):continue
        filepart=target.split('#')[0]
        if not filepart:continue
        links+=1
        if not (p.parent/filepart).is_file() and not (p.parent/filepart).is_dir():errors.append(p.name+' broken link '+target)
    if re.search(r'(?:sk-proj-|sk-ant-api\d+-)[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY',text):errors.append(p.name+' credential-looking material')
expected=['AGENT_INVENTORY.md','AGENT_DEPENDENCY_MAP.md','ACTIVATION_DECISIONS.md','PLATFORM_CAPABILITY_MATRIX.md','STRATEGIC_GAP_ANALYSIS.md','RISK_REGISTER.md','PRIORITIZED_ROADMAP.md','EXECUTIVE_BRIEF.md','AGENT_INVENTORY.csv','AUDIT_EVIDENCE.json']
for name in expected:
    if not (OUT/name).is_file():errors.append('missing deliverable '+name)
changes=subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=ROOT,text=True).splitlines()
for change in changes:
    if not change[3:].startswith('docs/audits/project-atlas-20261023/'):errors.append('out-of-audit change: '+change)
report=dict(result='PASS' if not errors else 'FAIL',source_commit=doc['source_commit'],registry_entries=len(ids),evidence_records=len(ev),main_source_records_checked=checked,unique_fingerprinted_sources=len(cache),markdown_links_checked=links,required_deliverables=len(expected),workflow_entrypoints=len(entrypoints),runtime_llm_leads_reconciled=True,validation='JSON/CSV/schema fields/source fingerprints/line bounds/repository links/workflow owners/provider lead classification/audit-only change scope; no runtime/product/security or academic effectiveness tests',errors=errors)
(OUT/'VALIDATION.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
raise SystemExit(bool(errors))
