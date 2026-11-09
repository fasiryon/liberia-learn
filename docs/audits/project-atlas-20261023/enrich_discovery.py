"""Incremental git-grep metadata enrichment; no unchanged body rereads."""
from pathlib import Path
import json,subprocess,re
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
d=json.loads((OUT/'CANDIDATES.json').read_text()); files=d['files']; by={c['path']:c for c in d['candidates']}
blobs={}
for row in subprocess.check_output(['git','ls-files','-s'],cwd=ROOT,text=True).splitlines():
    meta,p=row.split('\t',1); blobs[p]=meta.split()[1]
def grep(pattern,paths):
    r=subprocess.run(['git','grep','-n','-E',pattern,'--',*paths],cwd=ROOT,text=True,encoding='utf-8',capture_output=True)
    if r.returncode not in [0,1]: raise RuntimeError(r.stderr)
    return r.stdout.splitlines()
for row in grep(r'routedCompletion\(|routedEmbedding\(|query\(|api.openai.com|api.anthropic.com|isFlagEnabled\(',['lib','app','worker','scripts','tools','os-vault/daemon']):
    p,n,line=row.split(':',2); n=int(n)
    if p not in by:
        by[p]={'path':p,'git_blob':blobs[p],'categories':{},'runtime_candidate':p.startswith(('lib/','app/','worker/','tools/','os-vault/daemon/')),'strength':'source-candidate'}
    kind='llm' if re.search(r'routedCompletion\(|routedEmbedding\(|api.openai.com|api.anthropic.com',line) else 'interface-reference'
    by[p]['categories'].setdefault(kind,[])
    if n not in by[p]['categories'][kind]: by[p]['categories'][kind].append(n)
    for name in re.findall(r'isFlagEnabled\([\"\']([A-Z][A-Z0-9_]*)',line):
        if not any(x['path']==p and x['line']==n and x['name']==name for x in d['flag_references']): d['flag_references'].append(dict(path=p,line=n,name=name))
d['candidates']=sorted(by.values(),key=lambda x:x['path']); d['candidate_file_count']=len(by);d['runtime_candidate_file_count']=sum(c['runtime_candidate'] for c in by.values())
d['tracked_blobs']=blobs
d['enrichment']='Incremental git grep adds routedCompletion/routedEmbedding, direct HTTP providers, flag reader calls; query() hits retained as interface candidates only.'
(OUT/'CANDIDATES.json').write_text(json.dumps(d,indent=2),encoding='utf-8')
print(json.dumps({k:d[k] for k in ['tracked_file_count','candidate_file_count','runtime_candidate_file_count']}))
