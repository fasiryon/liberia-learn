"""Execute only the Atlas synthetic tests with an environment allowlist."""
from pathlib import Path
import os,subprocess,json,sys,hashlib
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[3]
SCRATCH=OUT/'scratch';SCRATCH.mkdir(exist_ok=True)
allowed={'SYSTEMROOT','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','NUMBER_OF_PROCESSORS','PROGRAMFILES','PROGRAMFILES(X86)','SYSTEMDRIVE'}
env={k:v for k,v in os.environ.items() if k.upper() in allowed};env['NODE_ENV']='test'
runner=ROOT.parents[1]/'node_modules/vitest/vitest.mjs'
if not runner.is_file():raise SystemExit('Existing repository Vitest installation not found; no package installation attempted')
proposal='--proposal' in sys.argv
finding=sys.argv[sys.argv.index('--finding')+1] if '--finding' in sys.argv else None
phase=sys.argv[sys.argv.index('--phase')+1] if '--phase' in sys.argv else 'CHECK'
groups={'SEC-R03':['moderation-audience.test.ts','runtime-audience.test.ts'],'SEC-R01':['invocation-isolation.test.ts'],'SEC-R02':['attendance-authority.test.ts','attendance-outbox.test.ts'],'SEC-R07':['emergency-disable.test.ts'],'AT-R-WAEC':['waec-attempt-binding.test.ts','waec-issued-session.test.ts'],'SEC-R08':['privileged-release-gates.test.ts'],'AT-ADJ-01':['escalation-school-boundary.test.ts'],'AT-ADJ-02':['attendance-membership.test.ts']}
report=SCRATCH/((finding+'-'+phase+'.json') if finding else ('proposal-results.json' if proposal else 'synthetic-results.json'))
(SCRATCH/'observations.jsonl').write_text('',encoding='utf-8')
command=['node',str(runner),'run','--config',str(OUT/('vitest.proposal.config.ts' if proposal else 'vitest.config.ts')),'--reporter=json','--outputFile='+str(report)]
if finding: command.extend(groups[finding])
r=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
(SCRATCH/('proposal-console.log' if proposal else 'synthetic-console.log')).write_text(r.stdout+r.stderr,encoding='utf-8')
if not report.exists():
    print((r.stdout+r.stderr)[-4000:]);raise SystemExit(r.returncode or 2)
d=json.loads(report.read_text(encoding='utf-8-sig'))
summary={'atlas_commit':'9fff8615b19591063882ee006dff96b83ccbe4b5','application_source_commit':'887f23eccbe5b194c2e7ff93c0b09c843549a9eb','command':command,'exit_code':r.returncode,'passed':d.get('numPassedTests'),'failed':d.get('numFailedTests'),'total':d.get('numTotalTests'),'method':'Actual route/resolver functions; synthetic authenticated identities; mocked in-memory ORM, provider and side-effect boundaries. Process environment allowlisted; fetch denied. Not a real login/database/integration/production test.','tests':[],'observations':[]}
for suite in d['testResults']:
    for a in suite['assertionResults']:
        summary['tests'].append({'suite':Path(suite['name']).name,'name':a['title'],'status':a['status'],'failure':a.get('failureMessages',[''])[0].split('\n')[0] if a.get('failureMessages') else None})
for line in (r.stdout+r.stderr).splitlines():
    marker=line.find('ATLAS-')
    if marker>=0 and '{' in line[marker:]:
        try:
            tag,payload=line[marker:].split(' ',1)
            summary['observations'].append({'id':tag,'observed':json.loads(payload)})
        except (ValueError,json.JSONDecodeError):pass
summary['mode']='proposal-only source overlay' if proposal else 'unchanged audited source'
summary['source_head']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
source_delta=subprocess.check_output(['git','diff','--name-only','9fff8615b19591063882ee006dff96b83ccbe4b5','--','app','lib','scripts','.github'],cwd=ROOT,text=True).splitlines()
summary['application_files_modified']=bool(source_delta)
summary['test_run_modifies_application_files']=False
summary['source_delta_vs_atlas']={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in source_delta if (ROOT/p).is_file()}
if not proposal:summary['mode']='current repair worktree source' if source_delta else 'unchanged audited source'
if proposal:summary['method']='Only the two P0 suites, using exact proposed source copies under audit scratch via module aliases; no patch applied to application paths. Same synthetic identities/in-memory ORM controls; not integration or production certification.'
summary['observations']=[json.loads(line) for line in (SCRATCH/'observations.jsonl').read_text(encoding='utf-8').splitlines() if line]
summary['raw_result_sha256']=hashlib.sha256(report.read_bytes()).hexdigest()
if finding:
    destination=OUT/'evidence';destination.mkdir(exist_ok=True)
    (destination/(finding+'-'+phase+'.json')).write_text(json.dumps(summary,indent=2),encoding='utf-8')
    (destination/(finding+'-'+phase+'.log')).write_text(r.stdout+r.stderr+'\n'+json.dumps(summary,indent=2),encoding='utf-8')
else:(OUT/('PROPOSAL_VERIFICATION.json' if proposal else 'SYNTHETIC_VERIFICATION.json')).write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps({k:summary[k] for k in ['source_head','mode','exit_code','passed','failed','total','raw_result_sha256']},indent=2))
print('Unexpected harness errors:',[x['name']+': '+str(x['failure']) for x in summary['tests'] if x['status']=='failed' and not str(x['failure']).startswith('AssertionError')])
# Preserve the actual expected RED status. A wrapper success is never called a pass.
raise SystemExit(r.returncode)
