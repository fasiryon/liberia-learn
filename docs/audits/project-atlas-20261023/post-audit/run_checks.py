"""Sequential source checks, no database/provider or schema generation."""
from pathlib import Path
import os,subprocess,sys,json,hashlib
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[3]
kind=sys.argv[1];finding=sys.argv[2]
env={k:v for k,v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','NUMBER_OF_PROCESSORS'}}
env.update(NODE_ENV='test',GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=str(ROOT))
if kind=='types':command=['node',str(ROOT.parents[1]/'node_modules/typescript/bin/tsc'),'--noEmit','--incremental','--tsBuildInfoFile',str(OUT/'scratch/security.tsbuildinfo'),'--pretty','false']
elif kind=='changed':command=['node','scripts/validate-changed.mjs','--base',sys.argv[3],'--no-types']
elif kind=='related':command=['node',str(ROOT.parents[1]/'node_modules/vitest/vitest.mjs'),'run','--config','vitest.config.ts',*sys.argv[3:],'--reporter=dot']
else:raise SystemExit('Unknown check')
mail=Path('C:/liberia-learn/artifacts/v4-coordination')
start=mail/'CODEX-ATLAS-HEAVY-START.md';end=mail/'CODEX-ATLAS-HEAVY-END.md'
start.write_text(f'# Atlas heavy check START\n\n{datetime.now(timezone.utc).isoformat()}\n\nFinding {finding}, check {kind}. Own worktree {ROOT}. No Prisma generation, database or provider calls. Sequential process.\n',encoding='utf-8')
try:r=subprocess.run(command,cwd=ROOT,env=env,capture_output=True)
finally:end.write_text(f'# Atlas heavy check END\n\n{datetime.now(timezone.utc).isoformat()}\n\nFinding {finding}, check {kind}. Child process ended; evidence follows in post-audit/evidence.\n',encoding='utf-8')
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
raw=r.stdout+r.stderr;record={'finding':finding,'check':kind,'head':head,'command':command,'exit_code':r.returncode,'output_sha256':hashlib.sha256(raw).hexdigest()}
target=OUT/'evidence';target.mkdir(exist_ok=True)
(target/f'{finding}-{kind}.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
(target/f'{finding}-{kind}.txt').write_bytes(raw+b'\n'+json.dumps(record,indent=2).encode())
print(json.dumps(record));print(raw.decode('utf-8',errors='replace')[-1600:] if r.returncode else 'PASS')
raise SystemExit(r.returncode)
