"""Read tracked source only; persist fingerprints and bounded discovery metadata."""
from pathlib import Path
import subprocess, re, json, hashlib
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True,encoding='utf-8').strip()
files=git('ls-files').splitlines()
blobs={}
for row in git('ls-files','-s').splitlines():
    meta,path=row.split('\t',1); blobs[path]=meta.split()[1]
exclude=re.compile(r'^(artifacts/|FactoryArtifacts/|public/|package-lock|.*node_modules/)|\.(png|jpg|pdf|mp4|zip|svg|lock)$',re.I)
patterns={
 'llm':r'new (?:OpenAI|Anthropic|Groq|Cohere)|(?:chat\.completions|responses|messages)\.create|routedCompletion\(|routedEmbedding\(|generateText\(|invokeAgent\(|runAgent\(|callAI\(',
 'agent':r'registerAgent\(|AgentDefinition|agentRegistry|systemPrompt|system_prompt|LangGraph|langchain|\bREA\b',
 'scheduler':r'cron\b|schedule:|workflow_dispatch|setInterval\(|repeat:|new Worker\(',
 'flag':r'process\.env\.(?:[A-Z][A-Z0-9_]*(?:ENABLED|ENABLE|FLAG)[A-Z0-9_]*|ENABLE_[A-Z0-9_]+)',
 'privilege':r'child_process|execSync|spawn\(|writeFile|deleteMany\(|\$executeRaw|\.grade\.create|\.grade\.update',
 'external':r'\bn8n\b|api\.anthropic|api\.openai|api\.groq|cohere',
}
compiled={k:re.compile(v,re.I if k=='external' else 0) for k,v in patterns.items()}
candidates=[]; flags=[]; imports=[]; records=[]
for p in files:
    if exclude.search(p): continue
    f=ROOT/p
    if f.suffix.lower() not in ['.ts','.tsx','.js','.mjs','.cjs','.json','.yml','.yaml','.md','.py','.tf','.prisma','.sh','.ps1']: continue
    if f.stat().st_size>600000: continue
    try: s=f.read_text(encoding='utf-8-sig')
    except UnicodeError: continue
    matches={k:[] for k in patterns}
    for n,line in enumerate(s.splitlines(),1):
        for k,pat in compiled.items():
            if pat.search(line): matches[k].append(n)
        for name in re.findall(r'process\.env\.([A-Z][A-Z0-9_]*)|isFlagEnabled\([\"\']([A-Z][A-Z0-9_]*)',line):
            name=next(x for x in name if x)
            if any(x in name for x in ['ENABLE','FLAG']): flags.append({'path':p,'line':n,'name':name})
        if p.startswith(('lib/','app/','worker/','workers/')):
            for target in re.findall(r'(?:from\s+|import\s*\()[\'\"]([^\'\"]+)',line): imports.append({'source':p,'target':target,'line':n})
    cats={k:v for k,v in matches.items() if v}
    if cats:
        runtime=p.startswith(('app/','lib/','worker/','workers/','.github/workflows/','tools/','os-vault/daemon/')) and f.suffix!='.md'
        candidates.append({'path':p,'git_blob':blobs[p],'sha256':hashlib.sha256(s.encode()).hexdigest(),'categories':cats,'runtime_candidate':runtime,'strength':'source-candidate' if runtime else 'reference-only'})
        for k,ns in cats.items():
            records.append({'path':p,'git_blob':blobs[p],'symbol':'pattern:'+k,'line_start':ns[0],'line_end':ns[-1],'category':'discovery:'+k,'related':[],'confidence':'candidate','verification':'pattern-only; not runtime proof'})
data={'base_commit':git('rev-parse','HEAD'),'tracked_file_count':len(files),'candidate_file_count':len(candidates),'runtime_candidate_file_count':sum(c['runtime_candidate'] for c in candidates),'files':files,'candidates':candidates,'flag_references':flags,'imports':imports,'evidence':records,'excluded':'artifacts, FactoryArtifacts, public binaries, dependencies, files >600KB; tracked text only'}
(OUT/'CANDIDATES.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
(OUT/'PACKAGE_SCRIPTS.json').write_text(json.dumps(json.loads((ROOT/'package.json').read_text())['scripts'],indent=2),encoding='utf-8')
print(json.dumps({k:data[k] for k in ['base_commit','tracked_file_count','candidate_file_count','runtime_candidate_file_count']}))
print('LLM runtime candidates:',json.dumps([c['path'] for c in candidates if c['runtime_candidate'] and 'llm' in c['categories']]))
