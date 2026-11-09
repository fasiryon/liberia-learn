"""Generate Atlas reports from a single normalized proposed registry and evidence."""
from pathlib import Path
import json,csv,re,hashlib,subprocess,collections
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8-sig'))
def write(name,s): (OUT/name).write_text(s.strip()+'\n',encoding='utf-8')
def dump(name,d):write(name,json.dumps(d,indent=2,ensure_ascii=False))
def txt(x):return '; '.join(map(str,x)) if isinstance(x,list) else str(x or 'Not established by inspected evidence')
def cell(x):return txt(x).replace('|','/').replace('\n',' ')
def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+['| '+' | '.join(cell(x) for x in row)+' |' for row in rows])
def source(path,line=None):return f'[{path}'+(f':{line}' if line else '')+f'](../../../{path}'+(f'#L{line}' if line else '')+')'
a=read('automation-review.json');l=read('learning-review.json');s=read('security-review.json');r=read('supplement-review.json');d=read('CANDIDATES.json');branches=read('BRANCH_CONTEXT.json')
BASE=d['base_commit']; evidence=[]; agents=[]; bodies={}
def body(p):
    if p not in bodies:bodies[p]=(ROOT/p).read_bytes()
    return bodies[p]
def paths(value):
    if not value:return []
    if isinstance(value,list):return value
    return [re.sub(r':\d+$','',x.strip()) for x in value.split(';') if x.strip() and (ROOT/re.sub(r':\d+$','',x.strip())).is_file()]
for prefix,data in [('AUTO',a),('LEARN',l),('SEC',s),('ROOT',r)]:
    for i,item in enumerate(data['evidence'],1):
        e=dict(item);e.setdefault('id',f'{prefix}-E{i:03d}');e.setdefault('source_commit',BASE)
        p=e['path'];raw=body(p);n=len(raw.splitlines());e['git_blob']=d['tracked_blobs'][p]
        e['fingerprint']=hashlib.sha256(raw).hexdigest();e['fingerprint_kind']='sha256-raw-bytes'
        if e['line_end']>n:e['requested_line_end']=e['line_end'];e['line_end']=n
        e['evidence_strength']='E1 source-confirmed'
        if p.startswith(('docs/','.claude/','os-vault/SYSTEM/')):e['evidence_strength']='E3 documented'
        if p=='docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md' or p=='docs/ops/LOAD_TEST_RESULTS.md':e['evidence_strength']='E2 dated repository audit; not reproduced'
        e['production_execution_verified']=False;evidence.append(e)
for b in branches:
    e=dict(b);e['evidence_strength']='E3 branch documentation';e['production_execution_verified']=False;evidence.append(e)
for c in d['candidates']:
    for cat,lines in c['categories'].items():
        evidence.append(dict(id='DISC-'+str(len(evidence)+1).zfill(4),path=c['path'],git_blob=c['git_blob'],symbol='pattern:'+cat,line_start=min(lines),line_end=max(lines),category='discovery:'+cat,related=[],confidence='candidate',verification='pattern-only; not a proven agent',evidence_strength='E4 discovery lead',production_execution_verified=False,source_commit=BASE))
evby={e['id']:e for e in evidence}
def cited(ids):return '; '.join(f"{i} {source(evby[i]['path'],evby[i]['line_start'])}" for i in ids if i in evby) or 'See implementation paths; lifecycle evidence incomplete.'
for raw in a['agents']:
    x=dict(raw);x['name']=x.pop('canonical_name');x['model_provider']=x.pop('provider');x['database_access']=x.pop('database_tables');x['feature_flags']=x.pop('activation_conditions');x['logging_evaluation_cost']=x.pop('controls');x['last_execution']=x.pop('last_execution_evidence');x['depth']=x.pop('audit_level');agents.append(x)
for raw in l['agents']:
    raw=dict(raw)
    raw.setdefault('risk',raw.get('risks','Execution and educational effectiveness remain unverified'))
    x=dict(raw);x['implementation']=paths(x.pop('location'));x['implementation']+=paths(x.get('entry'));x['tools_permissions']=x.pop('tools');x['database_access']=x.pop('tables');x['feature_flags']=x.pop('flags');x['model_provider']=x.pop('provider');x['external_services']=x.pop('services');x['logging_evaluation_cost']=x.pop('monitoring');x['last_execution']=x.pop('last_observed_execution');x['risks']=x.pop('risk');x['recommendation']=x.pop('decision');x['depth']=x.pop('level');x['intended_users']='Students / teachers / qualified reviewers according to entry-point roles';x['owner']='Academic platform and content owners'
    x['evidence']=[e['id'] for e in evidence if e['path'] in x['implementation'] and not e['id'].startswith('DISC')];agents.append(x)
agents+=r['agents']
for x in agents:
    x.setdefault('inputs',x.get('inputs_outputs','Trusted caller context; see source contract'))
    x.setdefault('outputs',x.get('inputs_outputs','Route/definition-specific output; see evidence'))
    x.setdefault('owner','Platform engineering with academic reviewer for consequential decisions')
    x.setdefault('production_status','UNKNOWN')
    x.setdefault('aliases',[])
    x['implementation']=paths(x['implementation'])
    x['evidence']=list(dict.fromkeys(x.get('evidence',[])+[e['id'] for e in evidence if e['path'] in x['implementation'] and not e['id'].startswith('DISC')]))
    x['activation_verified']=False
    if not x['evidence']:
        x['evidence']=[e['id'] for e in evidence if e['path'] in x['implementation'] and e['id'].startswith('DISC')]
    x['counting_unit']='logical capability group' if x['type'] not in ['scheduled automation','documentation-only persona'] else ('dispatcher entry point' if x['type']=='scheduled automation' else 'persona document')
    x['evidence_strength']='E1 source-confirmed; execution unknown' if x['type']!='documentation-only persona' else 'E3 documented persona; activation unknown'
    if x['id']=='maintenance-generation-tools':x['depth']='C';x['status']='unknown';x['evidence_strength']='E4 CLI discovery and sampled implementation; invocation unknown'
assert len({x['id'] for x in agents})==len(agents)
agents.sort(key=lambda x:x['id']);byid={x['id']:x for x in agents}
counts={'total_registry_entries':len(agents),'by_type':dict(collections.Counter(x['type'] for x in agents)),'by_status':dict(collections.Counter(x['status'] for x in agents)),'confirmed_production_active':0,'confirmed_obsolete':0}
counts['runtime_and_external_entries']=sum(x['type']!='documentation-only persona' for x in agents)
counts['logical_runtime_groups_excluding_dispatchers']=sum(x['type'] not in ['documentation-only persona','scheduled automation'] for x in agents)
registry={'title':'Agent registry — proposed; static discovery, no activation authority','schema_version':'1.0.0','source_commit':BASE,'audit_date':'2026-10-23','counting_policy':'Logical capabilities are grouped; middleware/model services and dispatcher entry points have separate types. Helpers, prompt versions, eight injected factory roles and every CLI are not each counted as autonomous LLM agents. Zero confirmed active is a lack of live proof, not a claim all are off.','counts':counts,'agents':agents}
dump('AGENT_REGISTRY.json',registry)
with (OUT/'AGENT_INVENTORY.csv').open('w',newline='',encoding='utf-8') as f:
    cols=['id','name','aliases','type','status','production_status','implementation','trigger','feature_flags','last_execution','evidence_strength','recommendation','owner','depth','evidence']
    w=csv.DictWriter(f,cols);w.writeheader()
    for x in agents:w.writerow({k:txt(x.get(k)) for k in cols})
intro=f'''# Project Atlas agent inventory

Audited main snapshot `{BASE}` on 2026-10-23. This is discovery and recommendation only. No agent was invoked, no runtime flag changed, and no application code or operational record was modified. The canonical proposed registry is [AGENT_REGISTRY.json](AGENT_REGISTRY.json); this Markdown and the CSV are generated views.

{counts['total_registry_entries']} catalog entries include {counts['runtime_and_external_entries']} executable/configured runtime or external entries and 26 persona documents. Entry counts are not a count of independent autonomous agents. Eight injected factory roles form one deterministic workflow; the tutor adapter and shared answer engine are two API-facing capabilities sharing one engine. See counting policy in the registry.

{table(['Type','Entries'],counts['by_type'].items())}

{table(['Repository status','Entries'],counts['by_status'].items())}

Confirmed production-active: **0**. Confirmed obsolete: **0**. Experimental/test-only examples: echo and goal-echo, **2**. These are evidence counts; live active/disabled counts are UNKNOWN. Configured-disabled means checked-in policy/workflow disable evidence, not an inspected production environment. No retirement is authorized by this report.

Evidence strength: E0 live execution, none observed; E1 directly inspected implementation/guard/caller; E2 checked-in execution or historical audit evidence, not reproduced; E3 documentation or branch claim; E4 pattern lead. Source confidence and activation confidence are separate. No provider SDK was executed.

## Catalog
'''
inventory=[intro]
fields=[('Purpose and users',lambda x:x['purpose']+' Users: '+txt(x.get('intended_users'))),('Implementation',lambda x:'; '.join(source(p) for p in x['implementation'])),('Type / model / orchestration',lambda x:txt(x['type'])+'; '+txt(x.get('model_provider'))+'; '+txt(x.get('orchestration'))),('Trigger / inputs / outputs',lambda x:txt(x.get('trigger'))+'; IN '+txt(x['inputs'])+'; OUT '+txt(x['outputs'])),('Tools and permissions',lambda x:txt(x.get('tools_permissions'))),('Database access',lambda x:txt(x.get('database_access'))),('External services',lambda x:txt(x.get('external_services'))),('Dependencies',lambda x:txt(x.get('dependencies'))),('Flags and activation',lambda x:txt(x.get('feature_flags'))),('Status and last execution',lambda x:x['status']+'; production UNKNOWN; '+txt(x.get('last_execution'))),('Logging / evaluation / cost',lambda x:txt(x.get('logging_evaluation_cost'))),('Risks',lambda x:txt(x.get('risks'))),('Decision / owner / audit depth',lambda x:x['recommendation']+'; '+txt(x.get('owner'))+'; '+txt(x.get('depth'))),('Evidence',lambda x:cited(x['evidence']))]
for x in agents:
    inventory+=['\n### '+x['id']+'\n',x['name']+'. Aliases: '+(txt(x['aliases']) if x['aliases'] else 'none established')+'.\n',table(['Field','Observed evidence'],[(label,fn(x)) for label,fn in fields])]
write('AGENT_INVENTORY.md','\n'.join(inventory))

# Risk/recommendation records stay stable; no claimed live exploit or outcome.
risks=[]
for x in s['risks']:
    z=dict(x);z['claim']=z.get('title');z.setdefault('impact',z['title']);z.setdefault('likelihood','Unknown');risks.append(z)
for x in a['findings']+r['findings']:
    z=dict(x);z.setdefault('title',z.get('claim'));z.setdefault('evidence',z.get('paths',[]));z.setdefault('status','Static finding; live exposure unknown');z.setdefault('action',z.get('recommendation','Investigate'));z.setdefault('complexity','M');z.setdefault('owner','Platform engineering');z.setdefault('acceptance','Demonstrate the intended behavior and hostile failure cases in an isolated environment, with correlated audit evidence.');risks.append(z)
for rid,title,ev,action in [
 ('AT-R-WAEC','WAEC practice lacks issued-attempt binding before legacy mastery writes',['lib/waec/practice.ts:126','app/api/student/waec/[subject]/practice/route.ts:36'],'Bind immutable issued items to authenticated learner/subject/attempt, reject duplicates and replay, admit only verified provenance to legacy mastery.'),
 ('AT-R-LAB','Virtual-lab AI refusal/zero can be recorded as learner performance',['app/api/student/labs/[labId]/session/route.ts:89','lib/ai/lab/labAnalyzer.ts:28','lib/intelligence/recordPerformanceEvent.ts:48'],'Keep activation gated; represent refusal as no attainment evidence, label AI suggestions provisional and preserve assistance attribution.'),
 ('AT-R-CONTENT','Frozen legacy catalog fails current Excellence mechanical criteria',['docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md:3'],'Use exact-revision ledger and qualified review to repair first admitted schoolday. Do not equate legacy APPROVED with current instructional readiness.')]:
    risks.append(dict(id=rid,title=title,claim=title,priority='P1',severity='HIGH',likelihood='High if these paths/content are admitted unchanged; deployment unknown',impact='Invalid educational evidence or instruction',evidence=ev,status='Static current code or dated frozen content baseline; no current live learner harm measured',action=action,owner='Academic integrity + learner/content platform',complexity='M',acceptance='Exact version and hostile cases pass isolated review; independent academic reviewer signs admission; no unverified mark becomes attainment.'))
risks.sort(key=lambda x:(x['priority'],x['id']))
recs=[]
for x in risks:
    recs.append(dict(id='ACT-'+x['id'],priority=x['priority'],action=x['action'],evidence=x['evidence'],benefit=x.get('impact',x['title']),dependencies=['Risk-specific owner and isolated verification; production changes require separate authority'],owner=x['owner'],acceptance=x['acceptance'],complexity=x['complexity'],track='Quick win' if x['complexity']=='S' else 'Architectural / verification work'))
recs+=l['recommendations']
for x in recs:x.setdefault('track','Quick win' if x.get('complexity')=='S' else 'Architectural / verification work')
recs+= [dict(id='AT-P2-REGISTRY',priority='P2',action='Adopt the proposed registry with one owner, reconcile external inventory and enforce activation evidence',evidence=['AGENT_REGISTRY.json','vercel.json','.github/workflows','lib/agents/control.ts'],benefit='Prevent duplicate agents and unsafe enablement; know which services actually execute',dependencies=['Read-only hosted workflow/flag/database access by authorized operators'],owner='Chief of Staff + platform operations',acceptance='Each production agent/job has owner, effective flags including AgentControl override, last successful invocation, secret-free cost/health evidence and rollback gate; n8n inventory reconciled.',complexity='S',track='Quick win'),dict(id='AT-P3-CONSOLIDATION',priority='P3',action='Unify provider usage, prompt/rubric contracts and telemetry; migrate callers before deprecating duplicate paths',evidence=['lib/ai/router.ts','lib/ai/routedCompletion.ts','lib/ai/homeworkGrader.ts','lib/ai/homework-grader.ts','lib/teacher/lessonPlanner.ts','lib/ai/teacher/lessonPlanner.ts'],benefit='Reduce correctness drift, observability gaps and repeated maintenance without rewrite',dependencies=['Caller compatibility map and authoritative score/review contracts'],owner='AI platform + academic platform',acceptance='Every billable caller has usage context; weekly/single-lesson planning modes preserved; old API removal follows zero live callers and retained historical-record readers.',complexity='L',track='Architectural / verification work')]
recs.sort(key=lambda x:(x['priority'],x['id']))
specific_dependencies={
 'ACT-SEC-R01':['Platform-admin guard or trustworthy tenant linkage for invocation rows','Default redacted log projection'],
 'ACT-SEC-R02':['Teacher-authoritative attendance policy','Distinguishable provisional device observation and official teacher record'],
 'ACT-SEC-R03':['Server-derived minor audience','Fail-closed release policy for UNCERTAIN and provider outage'],
 'ACT-SEC-R04':['Complete academic-record inventory and approved backup service','Isolated restore target with encrypted artifacts and provenance checks'],
 'ACT-SEC-R05':['ToolDefinition requiresAuth roles and outputSchema','Resource-level scope enforced by trusted tool context'],
 'ACT-SEC-R06':['Atomic usage reservations and shared billing identity','Concurrent cost-cap regression harness'],
 'ACT-SEC-R07':['Documented emergency disable precedence','AgentControl override audit and kill-switch evaluation'],
 'ACT-SEC-R08':['Authorized hosted MFA/RLS and database-role evidence','No production credential disclosure'],
 'ACT-SEC-R09':['Approved retention/redaction policy','Scoped operational log reader and deletion evidence'],
 'ACT-SEC-R10':['Known deploy target and immutable release digest','Isolated rollback rehearsal'],
 'ACT-AT-R-COST':['Mandatory aiUsage or explicit tracked adapter for all billable calls','Shared provider cost ledger'],
 'ACT-AT-R-WORKER':['Selected supported transport for autonomous/audio producers','Handler execution plus DLQ/idempotency evidence'],
 'ACT-AT-R-VENDOR':['Approved processor/data-retention terms','Minimized student document payload and remote tool permissions'],
 'ACT-AT-R-WAEC':['Existing sealed lessonQuizSession pattern','Server-issued immutable items and idempotent attempt admission'],
 'ACT-AT-R-LAB':['Provisional AI-score authority model','Independent performance-event provenance contract'],
 'ACT-AT-R-CONTENT':['Qualified independent curriculum reviewers','Exact revised lesson/item/source-rights bindings'],
}
for x in recs:
    if x['id'] in specific_dependencies:x['dependencies']=specific_dependencies[x['id']]

def refs(items):
    out=[]
    for item in items:
        if item in evby:out.append(cited([item]));continue
        if item=='AGENT_REGISTRY.json':out.append('[canonical registry](AGENT_REGISTRY.json)');continue
        m=re.match(r'^(.*?)(?::(\d+))?$',item)
        if m:out.append(source(m[1],m[2]))
    return '; '.join(out)
write('RISK_REGISTER.md',f'''# Project Atlas risk register

Snapshot `{BASE}`. Priority is work urgency; severity is potential impact, not evidence of exploitation. Two HIGH source defects merit P0 repair. No current live CRITICAL exploit, exposed credential value or production breach was confirmed. Source exposure and deployment exposure remain separate.

{table(['ID / priority / severity','Finding / likelihood','Impact','Evidence','Action / owner / size'],[(x['id']+' / '+x['priority']+' / '+x['severity'],x['title']+'; '+x['likelihood']+'; '+x['status'],x['impact'],refs(x['evidence']),x['action']+' Owner: '+x['owner']+'. '+x['complexity']) for x in risks])}

Historical findings were revalidated, not copied as current defects. The legacy login route is gone and the old cross-school grade override now checks school and audits. See [security review](security-review.md) and SEC historical_revalidation in [AUDIT_EVIDENCE.json](AUDIT_EVIDENCE.json).

Dependency vulnerability status is UNKNOWN. Package/lock declarations were discovered; no fresh advisory database or npm audit result was fetched. Absence of a verified advisory is not a clean vulnerability scan. Security vendor terms, hosted MFA/RLS and credential rotation remain external verification tasks.
''')
write('PRIORITIZED_ROADMAP.md',f'''# Project Atlas prioritized roadmap

This portfolio is a recommendation, not permission to activate or deploy. Repair data boundaries first, admit one academically complete schoolday next, then expand measured coverage. Reuse the factory, sealed quiz sessions, governed learner state, review ledger and existing school workflows.

## Quick wins

{table(['ID / priority','Action','Benefit','Dependencies','Owner / size','Acceptance','Evidence'],[(x['id']+' / '+x['priority'],x['action'],x.get('benefit','Risk reduction'),x.get('dependencies',[]),x.get('owner','Assigned owner')+' / '+x.get('complexity','M'),x['acceptance'],refs(x['evidence'])) for x in recs if x['track']=='Quick win'])}

## Architectural and verification work

{table(['ID / priority','Action','Benefit','Dependencies','Owner / size','Acceptance','Evidence'],[(x['id']+' / '+x['priority'],x['action'],x.get('benefit','Risk reduction'),x.get('dependencies',[]),x.get('owner','Assigned owner')+' / '+x.get('complexity','M'),x['acceptance'],refs(x['evidence'])) for x in recs if x['track']!='Quick win'])}

Sequence within P1: restore authority/cost/operational safety, then exact-version schoolday admission and Assessment V2 vertical slice. The in-flight K-12 program keeps its own gates and owners; this audit does not select a competing sprint order. Relative sizes are scope estimates, not dates. P0 repairs must not wait for the larger convergence program.
''')

capabilities=l['capabilities']+[
dict(area='school',capability='Staff import and administration',status='implemented',evidence=['app/api/admin/onboarding/import-teachers/route.ts','app/api/admin/teachers/route.ts'],limit='School-scoped import inspected. Full HR/payroll and live school setup not certified.'),
dict(area='school',capability='School/district/national analytics and reporting',status='implemented',evidence=['lib/reporting/dashboard/districtAggregator.ts','lib/ai/curriculum/curriculumOptimizer.ts','app/api/admin/national/curriculum-signals/route.ts'],limit='Aggregate pipelines and optional narratives exist; outcome validity, current completeness and authorization require feature-specific evidence.'),
dict(area='platform',capability='Multi-tenant isolation and RBAC',status='partially implemented',evidence=['lib/permissions.ts','lib/auth.ts','app/api/admin/agents/invocations/route.ts','app/api/admin/enrollment/route.ts'],limit='Broad scoped foundations; SEC-R01 shows global invocation leakage, so isolation is not certified end-to-end.'),
dict(area='platform',capability='Authentication and privileged MFA',status='unverified',evidence=['lib/auth.ts','docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md'],limit='Auth implementation exists; deployed MFA/RLS posture unverified. See SEC-R08.'),
dict(area='platform',capability='API security and academic write authority',status='partially implemented',evidence=['lib/autonomous/actions/actionExecutor.ts','lib/learning-state/masteryWriter.ts','app/api/student/sync/route.ts'],limit='Governed writes exist; attendance sync violates canonical authority. No all-route security certification performed.'),
dict(area='platform',capability='Privacy, child safeguarding and retention',status='partially implemented',evidence=['lib/agents/safeguarding/keywordGate.ts','lib/agents/safeguarding/slaCheck.ts','lib/agents/invocationLog.ts','lib/agents/runtime.ts'],limit='Escalation and SLA mechanisms exist; moderation UNCERTAIN, raw logging and retention require repair/verification.'),
dict(area='platform',capability='Offline conflict resolution and sync support',status='partially implemented',evidence=['lib/offline-sync/policies.ts','docs/ops/LEARNER_SYNC_SUPPORT_DIAGNOSTICS_V1.md','app/api/student/sync/route.ts'],limit='Replay/diagnostics foundations exist; attendance last-write-wins trusts device timestamps. Shared-device and release tests are not new field evidence.'),
dict(area='platform',capability='Agent observability and incident response',status='partially implemented',evidence=['lib/agents/invocationLog.ts','lib/agents/opsSentinel/detectors.ts','docs/ops/INCIDENT_RESPONSE.md','lib/autonomous/runtime/runtimeHealthService.ts'],limit='Logs, heartbeat, DLQ and runbook exist; runtime registry/alert ownership and successful live delivery unknown. Sentinel has narrow allowlist.'),
dict(area='platform',capability='Model costs and quotas',status='partially implemented',evidence=['lib/ai/budgetGuard.ts','lib/ai/routedCompletion.ts','lib/agents/costEnforcement.ts','lib/canva/canvaMcp.ts'],limit='Budget infrastructure exists, optional aiUsage and direct SDK paths bypass shared accounting; no production spend measured.'),
dict(area='infrastructure',capability='Deployment, rollback and environment separation',status='partially implemented',evidence=['.github/workflows/deploy-ecs.yml','docs/ops/ENVIRONMENTS.md','docs/ops/DEPLOYMENT_RUNBOOK.md'],limit='Image publication/workflow/runbook are code evidence; current deployed release, secret isolation and rehearsed rollback unverified.'),
dict(area='infrastructure',capability='Backup and disaster recovery',status='partially implemented',evidence=['app/api/cron/nightly-backup/route.ts','docs/ops/BACKUP_SCHEDULE.md'],limit='Partial bounded CSV backups are not full academic database recovery; RPO24h/RTO4h are targets, not demonstrated current recovery.'),
dict(area='infrastructure',capability='Queues, retries and idempotency',status='partially implemented',evidence=['worker/index.ts','worker/handlers/index.ts','lib/autonomous/idempotencyService.ts','lib/autonomous/runtime/workflowRecoveryService.ts'],limit='Bounded SQS retries/DLQ and workflow locks exist; two known job variants unsupported; handler idempotency needs per-effect proof.'),
dict(area='infrastructure',capability='Low-end devices and national performance',status='unverified',evidence=['docs/ops/LOAD_TEST_RESULTS.md','load-tests/peak.js','docs/architecture/OFFLINE_FIRST.md'],limit='Historical conditional load result has browse p95 above target. No new low-RAM/device/network or national-scale certification.'),
dict(area='platform',capability='Dependency vulnerability posture',status='unverified',evidence=['package.json','package-lock.json','.github/workflows/ci.yml'],limit='Dependencies/CI inspected as declarations; fresh advisory scan was not run. No safe/unsafe version claim inferred.'),
]
# Authority defect changes classification of the previously broadly implemented offline row.
for c in capabilities:
    if c['capability']=='Offline learning and sync':c['status']='partially implemented';c['limit']+=' Canonical attendance authority defect SEC-R02 blocks blanket certification.'
write('PLATFORM_CAPABILITY_MATRIX.md',f'''# Project Atlas platform capability matrix

Snapshot `{BASE}`. Implemented means a repository route/service exists and was traced to a foundation. It does not mean deployed, defect-free, academically approved or effective. Partially implemented means an integration, authority or coverage gap is established. Missing means not found in the examined scope, not proven absent from every external system. Entire route bodies and UI/device journeys were sampled, not exhaustively executed.

{table(['Area','Capability','Classification','Evidence','Practical limitation'],[(c['area'],c['capability'],c['status'],refs(c['evidence']),c['limit']) for c in capabilities])}

The repository has substantial school operations and learning foundations. Route inventory is stronger evidence than a mockup, but only a reproducible end-to-end check with real authority and release bindings establishes workflow readiness. Existing test files were located; tests were not rerun in this documentation-only audit.
''')

gaps=[
('G1','An academically admitted full K-12 schoolday','Legacy lessons and schedules exist; coherent independently reviewed daily instruction is not established across K-12. The frozen Oct16 baseline has 0 mechanical passes and 1105 pending judgment reviews.','Content Factory V2, Excellence rubric, modernization ledger, exact-revision bundles, active CoS/T1/T2 schoolday work.','A polished schedule can lead to incomplete or poorly matched instruction.','XL','Very high','Qualified reviewers, MOE/WAEC source rights, exact pins, provisional vs official evidence.','Admit one complete version-pinned day under the existing program gates, with every slot reviewed; publish a missing-coverage matrix for all 13 grades.',['docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md:3','lib/content-factory/v2/manager.ts:20','docs/architecture/content-factory/CONTENT_FACTORY_READINESS_V1.md:18']),
('G2','Diagnostics, persistent profiles and personalized learning across grades','Governed registry currently admits G4 Math only; legacy strand EMA and heuristic dashboard models coexist. Prerequisites and misconceptions lack broad released coverage.','Published ontology registry, sealed diagnostic sessions, canonical event-replayed learner state, deterministic orchestrator.','Most learners cannot receive the same defensible diagnostic-to-remediation-to-reassessment loop.','L','Very high','Reviewed concept/item bindings; tenant ownership; state-write provenance and calibrated policies.','One additional approved unit covering diagnostic, prerequisite response, remediation, reassessment and teacher explanation, without claiming national coverage.',['lib/learning-authority/publishedReleases.ts:1','lib/learning-state/masteryWriter.ts:54','lib/learning-calibration/earlyLearningPolicy.ts:8']),
('G3','Independent assessment and defensible records end-to-end','V2 contracts/projections and selected official readers exist; V2 downstream writes stay false and player/persistence/moderation lifecycle is incomplete. WAEC practice replay contaminates legacy evidence.','Assessment V2 contracts; Records V2 policy; legacyAssignmentScoreAuthority; sealed lessonQuizSession.','Schools risk confusing assisted practice, AI suggestions and official attainment.','L','Very high','P0 attendance authority repair, sealed attempts, assistance/provenance ledger, qualified review and appeal policy.','Implement one approved assessment-to-review-to-official-reader slice; keep downstream write gate closed until hostile/replay/moderation checks pass.',['lib/assessment/v2/consumers.ts:26','lib/records/v2/legacyAssignmentScoreAuthority.ts','lib/waec/practice.ts:126']),
('G4','Retained, transferable learning rather than interaction completion','Retention policy and outcome trackers exist, but scheduler/delivery wiring and validated learner gains are absent from inspected evidence.','Assessment retention planning, impact/intervention analytics, quality gate, RAG eval harness.','Dashboards can show progress without demonstrating durable understanding or successful intervention.','M','Very high','Consent/privacy, validated independent items, sufficient sample, teacher review, predeclared measures.','Run one bounded unit pilot with baseline, independent post-check, 7/21-day retention, transfer task and intervention comparison; report uncertainty and attrition.',['lib/assessment/v2/retention.ts:45','lib/evals/runner.ts:287','lib/metrics/impact/interventionOutcomeResolver.ts','docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md:8']),
('G5','Trustworthy operation in low-connectivity schools','Offline packs/sync/support exist; student attendance writes break authority; scheduler authentication and partial backup/unsupported queue paths need repair. Current real-device readiness is unknown.','PWA/IndexedDB, support sync diagnostics, idempotent events, SQS/DLQ and heartbeat services.','False attendance, unresolved sync and silent missed jobs undermine teacher/guardian trust even when the UI works.','L','High','P0 tenant/attendance repair; audited job identity, immutable release pins, privacy-safe logs and restore proof.','Rehearse one complete day on low-RAM shared devices through disconnect/reconnect and lost worker/restore cases; reconcile exact student evidence without duplicated effects.',['lib/offline-sync/policies.ts:27','docs/ops/LEARNER_SYNC_SUPPORT_DIAGNOSTICS_V1.md:9','worker/handlers/index.ts:57','app/api/cron/nightly-backup/route.ts']),
('G6','Kindergarten and Koloqua inclusion','Enrollment accepts grades1-12; UI locales en/kpe/bss, no Koloqua registration. This differs from the K-12/English-Koloqua vision.','next-intl catalogs, narration services, early-learning policies, schoolday band templates in in-flight branch.','Young learners and Koloqua-preferring families lack a verified supported path.','M','High','Native-speaking educator review, dialect/orthography policy, age-appropriate consent/accessibility and no diagnosis claims.','Define Kindergarten enrollment/content contract and native-reviewed Koloqua vocabulary plus narrated starter unit; verify language switching and comprehension before expansion.',['lib/academics/enrollment/contracts.ts','i18n.ts:4','lib/audio/lessonAudioProvider.ts:8']),
('G7','Computing, engineering design and practical STEM progression','Coding exercise, practical/AI/virtual labs and interactive definitions are present, but no validated complete K-12 progression or physical practice outcomes established.','Existing lab runtimes, factory project/practical role, coding tasks, paper alternatives, CoS computing/engineering standard branch.','An isolated simulation does not establish practical design, testing, debugging and transfer skills.','L','High','Lab certification, device capability/fallbacks, safe inputs, teacher assessment and independent marks.','One reviewed band unit combining simulation, constrained coding/design task, paper/physical alternative and teacher-scored transfer rubric.',['lib/exercises/generateCodeExercise.ts:76','lib/content-factory/v2/manager.ts:9','lib/labs/ai/planLabAction.ts','app/api/student/labs/[labId]/session/route.ts:89']),
]
write('STRATEGIC_GAP_ANALYSIS.md',f'''# Project Atlas strategic gap analysis

The smallest credible path is to finish governed academic and school workflows already present, then expand admitted coverage. No complete rewrite is supported by this audit. Published source models and attractive interfaces are not educational-outcome evidence.

{table(['Gap / missing capability','Current gap','Reusable foundation','User impact','Complexity / academic impact','Security and operational dependencies','Smallest credible milestone','Evidence'],[(g[0]+' '+g[1],g[2],g[3],g[4],g[5]+' / '+g[6],g[7],g[8],refs(g[9])) for g in gaps])}

## Educational quality and outcomes

Baseline diagnostics have server-authoritative sealed-session foundations. Grade/item validity across subjects and Kindergarten is unverified. Prerequisite mapping is strong where a reviewed ontology release exists; it cannot be inferred for the rest of K-12. Formative practice, independent attempts and AI assistance must remain distinguishable in every consumer. Misconception/retention state types and deterministic ranking exist, while broad released bindings and delivery integration remain incomplete. Evidence: LEARN-E001 through LEARN-E006 in [evidence index](AUDIT_EVIDENCE.json).

Teacher review and advisory-only AI review are real authority boundaries worth retaining. Selected Records V2 legacy readers exclude unconfirmed AI marks; this is narrower than a fully connected official assessment lifecycle. WAEC replay and lab suggested-score attribution are counterexamples to treating every legacy performance event as independent evidence. See [risk register](RISK_REGISTER.md).

The frozen catalog baseline expressly distinguishes reproducible mechanical checks from judgment awaiting expert review. Its 1105 revisions have no learning-outcome evidence. RAG recall, citation scores, arithmetic tests, content hash seals, simulated schooldays and screenshots are useful engineering checks; none establishes retained learning or effective intervention. National scale should follow measured academic admission and restore/device/network evidence, not route counts. Evidence: [baseline](../../../docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md#L3), [early policy hypothesis](../../../lib/learning-calibration/earlyLearningPolicy.ts#L8), [RAG evaluation](../../../lib/evals/runner.ts#L287).

## In-flight work and scope

{table(['Branch / pinned commit','Observed work','Evidence boundary'],[(b['branch']+' / '+b['source_commit'],b['claim'],'BRANCH documentation only; not part of audited main and not current production proof') for b in branches])}

These branches were inspected through Git objects, without entering or editing their worktrees. The CoS branch is moving during the audit; the frozen commit in BRANCH_CONTEXT.json is the reproducible reference. Its schoolday plan must not be counted as released platform coverage. A branch sentence describing the legacy catalog as independently reviewed conflicts with the baseline's explicit pending-review status; use the baseline classification in founder decisions.
''')

graph='''```mermaid
flowchart TD
  student[Student tutor and role assistant] --> grounded[Shared grounded answer service]
  grounded --> retrieval[Audience-scoped retrieval]
  retrieval --> index[RagChunk / embeddings / optional Cohere]
  grounded --> router[Provider router / budget / telemetry]
  staff[Teacher planning and grading modes] --> router
  legacy[Legacy curriculum generation / unit assembler] --> router
  factory[Content Factory V2 injected role DAG] --> artifact[Sealed drafts / quality receipts]
  artifact --> human[Qualified human review and release authority]
  review[Four advisory curriculum SME configurations] --> human
  review --> router
  event[Learning events and approved evidence] --> slm[Canonical SLM / deterministic orchestrator]
  event --> detectors[Deterministic operational detectors]
  detectors --> approval[Governed recommendations / approvals]
  approval --> effects[Bounded interventions or curriculum flags]
  vercel[Vercel cron declarations] --> sweeps[Agent sweeps / goals / operations]
  sweeps --> runtime[Custom bounded agent runtime]
  runtime --> tools[Allowlisted tools / scoped DB services]
  runtime --> router
  queue[SQS dispatcher] --> jobs[Embeddings / imports / SMS / assets / textbooks / regeneration]
  jobs --> router
  github[GitHub workflows] --> mergeops[Readiness / MergeOps policy gates]
  os[OS daemon / n8n template] -. external state unknown .-> research[Draft research and briefs]
  canva[Direct Anthropic Canva MCP] --> vendor[External design generation]
```
'''
duplicates=a['duplicates']+l['duplicate_groups']
write('AGENT_DEPENDENCY_MAP.md',f'''# Project Atlas agent and workflow dependency map

Edges summarize inspected call paths. They do not assert deployment or that every imported optional dependency executes. Detailed known imports are cached in CANDIDATES.json; graph coverage is bounded by source inspection.

{graph}

## Duplication decisions

{table(['Responsibility','Members','Decision'],[(x.get('group',x.get('responsibility')),x['members'],x.get('decision',x.get('finding'))) for x in duplicates])}

The primary reuse decisions are to keep one provider router, one grounded-answer engine with role-specific adapters, one authoritative learner-state path, existing review/release authority, and the deterministic factory manager. `lib/ai/router.ts` is already a re-export; it is not a competing router. Textbook compilation is deterministic. ContentFactory V2 role names do not prove eight autonomous model agents. See ROOT-001, ROOT-016, ROOT-034 and LEARN source references in [inventory](AGENT_INVENTORY.md).

There are multiple real planning and grading implementations and several content-authoring entry points. Consolidate shared contracts, moderation, usage accounting and provenance before retiring callers; retain separate weekly/single-lesson and advisory/official workflows. Do not delete historical score or curriculum readers to tidy names. Compare legacy-curriculum-generation, content-factory-v2, elite-upgrade, unit-assembler and exam-generation in the canonical registry.

## Reachability, cycles and broken connections

Only goal-echo has a registered goal handler. The schedule/event registration APIs have no production registrations found by the reviewer; this is a bounded source-search finding, not proof no external host can register at runtime. The eight-role factory has an explicit acyclic dependency graph and attempts bounded1-5. The generic agent runtime is bounded by depth/time and JSON repair; no verified unbounded autonomous call cycle was established. Whole-program dynamic cycle freedom is unverified. Evidence: [factory graph](../../../lib/content-factory/v2/manager.ts#L6), [automation findings](automation-review.md).

The SQS worker deliberately rejects known unimplemented audio/autonomous job variants and retries/DLQs them. Recovery enqueue success must not be reported as successful execution. Cron Bearer-contract mismatches, optional budget context and unenforced generic tool role/output declarations are concrete integration gaps. See AT-R-WORKER, AUTO-R1, AT-R-COST and SEC-R05 in [risk register](RISK_REGISTER.md).

Ops Sentinel, runtime-health, DLQ checks, heartbeat and incident dashboards overlap operational ownership. Integrate their health registry and alert delivery while keeping deterministic domain detectors. OS research briefs, n8n and research personas need one canonical context and cost ledger; repository docs alone cannot prove redundancy of hosted workflows. No distinct LangChain/LangGraph or executable REA agent was located in targeted source/history searches. REA remains an unresolved alias, not a fabricated catalog entry.

## Simplified target

Versioned source/ontology → existing factory and author adapters → sealed draft → qualified review → exact released composition → ScheduledWork → assistance-aware attempts → verified learner evidence → canonical SLM → deterministic recommendation → teacher action → measured reassessment. Shared provider/cost/moderation services support these stages; LLM outputs never supply their own approval authority. This reuses the accepted ContentBundle convergence direction in [readiness decision](../../../docs/architecture/content-factory/CONTENT_FACTORY_READINESS_V1.md#L18).
''')

activation_rows=[
('AI Tutor / grounded role assistant','Implemented; server tutor default OFF plus Edge Config; live effective state UNKNOWN','Approved safe retrieval, model budget, scope and rate guards','Grounding/moderation and latency unverified with real learners','student-ai-tutor','IMPROVE; verify one scoped cohort before any controlled activation'),
('AI Labs and Virtual Labs','Default-gated implementations; interactive candidates separate','Certified lab registry, score provenance, safe tool action bounds','Refusal can become zero attainment; suggestions mislabeled in legacy telemetry','virtual-lab-analyzer','BLOCK until L-P1-01; preserve already reviewed interactive definitions separately'),
('Student Learning Model / orchestrator','Implemented; published governed release limited to G4 Math','Released ontology, qualified item bindings, canonical evidence','Legacy strand models/heuristic summaries coexist','learning-orchestrator','KEEP; expand reviewed units incrementally'),
('Diagnostic / remediation loop','Server placement and targeted practice exist; coverage partial','Sealed sessions, prerequisite mapping and teacher review','WAEC replay affects legacy mastery, retained effectiveness unknown','placement-item-generator','IMPROVE; no broad personalization claim'),
('Content Factory','V2 deterministic role manager and legacy LLM generation coexist; new V4 branch drafts held','Qualified independent review, exact revisions, source rights, contracts','0 mechanical passes in dated legacy baseline; source status is not approval','content-factory-v2','INTEGRATE existing generations through shared contracts; retain human release'),
('Curriculum Excellence / four AI SMEs','Standards and AI review implemented; seeded AI definitions disabled by default','Qualified human review roster/calibration; provider ledger','Advisory model output cannot grant academic approval','curriculum-review-subject-sme','KEEP advisory-only; verify before enable'),
('Academic Records V2','Domain rules plus selected legacy reader admission integrated; full lifecycle partial','Approved assessment evidence, teacher confirmation, appeal/promotion policy','Incomplete end-to-end official evidence flow','learning-orchestrator','IMPROVE vertical slice; no automatic official grade release'),
('Assessment Architecture V2','Contracts/projection/read consumers; downstream write constant false','Persistence, player, assistance ledger, moderation, authorized consumers','Premature enabling would bypass named authority gates','content-factory-v2','DISABLED FOR VALID REASON; retain gate until verified'),
('Teacher interventions','Heuristics, deterministic detectors and optional AI advice exist','Scoped evidence, teacher authorization, outcome tracking','Overlapping risk models; actual benefit not measured','school-intervention-advisor','CONSOLIDATE recommendation contracts; deterministic first'),
('Parent / guardian intelligence','SMS family tools, dashboards, messaging and weekly digest code exist','Verified guardian link/phone, safeguarding, SMS costs','Raw child logs and external identifiers; live carrier state unknown','liberialearn-family','IMPROVE privacy/authorization before scaling'),
('Offline learning / synchronization','PWA, packs, replay and support diagnostics implemented','Original learner binding, release pins, conflict policy, teacher authority','Student canonical attendance overwrite','sqs-worker','P0 REPAIR; isolated disconnect/replay proof before readiness claim'),
('MergeOps','Policy disables merge/repair authority; readiness observer exists','Protected checks, app permission scope, reviewed exact head','Readiness is not merge permission; no live permission state inspected','mergeops-controller','KEEP observer; write activation remains separately gated'),
('Agent observability','Invocation/cost logs, Sentinel and cron heartbeats implemented','P0 scoped log access, retention, owner registry, monitor/alert routing','Cross-school raw logs; effective overrides unknown','ops-sentinel','IMPROVE; verify alert delivery without exposing child data'),
('Scheduled operations','27 Vercel declarations,10 GitHub workflows; execution UNKNOWN','Provider schedule support, auth, flag/override and job handler','Bearer mismatches, unsupported queue variants and stale paused docs','cron-agents-tick','VERIFY read-only runtime state, repair known breaks first'),
('External n8n / OS / REA','n8n template exists; daemon and scanner code; REA alias unresolved','Authorized external inventory and execution history','No external inventory connector or hosted records available','n8n-daily-pulse','INVESTIGATE; no activation or deletion recommendation without evidence'),
]
write('ACTIVATION_DECISIONS.md',f'''# Project Atlas activation decisions

No flag was changed. Actual deployed state is UNKNOWN unless independently supplied later. There are zero features certified here as "active and working" because no current end-to-end runtime was observed. Source defaults, AgentControl rows, Edge Config, deployment revision and service credentials can disagree; an env false is not a universal kill switch where the DB override wins. Evidence: [control precedence](../../../lib/agents/control.ts#L15).

{table(['Feature / agent','Actual evidence-backed status','Dependencies','Risks','Evidence / registry entry','Recommendation'],[(f,st,de,ri,'['+ident+'](AGENT_INVENTORY.md#'+ident+')',dec) for f,st,de,ri,ident,dec in activation_rows])}

## Category decisions

Active and working: none confirmed by live evidence. Active but needs repair: current activity unknown; SEC-R01/02 warrant immediate code repair independently of activation. Disabled for valid reason: Assessment V2 writes, MergeOps write policy, seeded advisory reviewers and unreleased candidates have explicit authority/quality gates. Safe candidate for controlled activation: none certified on source inspection alone; grounded tutor and deterministic health observations are candidates for isolated verification after blockers. Blocked by security/academic integrity: generic child-facing teaching moderation, raw invocation exposure, attendance sync authority, lab score attribution, WAEC legacy mastery admission. Obsolete/redundant: no safe unconditional retirement established; test echo and duplicated planner/grader contracts are controlled consolidation candidates. Unknown/external: all live flags, agent DB overrides, hosted jobs, SMS, n8n, current provider spend and current learning outcomes.

Verification before enablement must provide exact deployed commit, effective flag/DB override values without credentials, allowed tenant/user cohort, current independent academic approval where relevant, scoped hostile tests, measured costs/latency, last-run/alert evidence and rollback authority. This is a proposed activation gate, not a new production configuration.
''')

inspected=set(a['inspected_files'])|set(l['inspected_files'])|set(s['inspected_files'])|set(r['inspected_files'])
inspected={p for p in inspected if isinstance(p,str) and p in d['tracked_blobs']}
# Discovery completeness uses source metadata, not a false claim of all-body review.
coverage=[]
for c in d['candidates']:
    ids=[x['id'] for x in agents if c['path'] in x['implementation']]
    support={'lib/agents/runtime.ts':'Shared bounded runtime, not a separate agent','lib/agents/scheduler.ts':'Registration/dispatch API; no non-test schedules found','lib/agents/triggers.ts':'Event dispatch API; no non-test registrations found','lib/ai/openaiClient.ts':'Provider client factory, part of ai-provider-router','lib/quality/fixtures/regression.ts':'Test fixture prose, false positive','lib/security/contentSecurityPolicy.ts':'CSP provider URL policy, false positive','app/api/admin/agents/morning-brief/run/route.ts':'Manual dispatcher for morning-brief, not a separate agent'}
    role='classified implementation' if ids else (support.get(c['path']) or ('reviewed support module' if c['path'] in inspected else 'discovery-only reference; not established as separate agent'))
    coverage.append(dict(path=c['path'],git_blob=c['git_blob'],categories=list(c['categories']),runtime_candidate=c['runtime_candidate'],registry_ids=ids,review=role))
dump('DISCOVERY_COVERAGE.json',coverage)
dispatchers=[dict(id=x['id'],parent_registry_id=x['id'],type=x['type'],owner=x['owner'],status=x['status'],production_status='UNKNOWN',paths=x['implementation']) for x in agents if x['type']=='scheduled automation']
worker_source=body('worker/handlers/index.ts').decode('utf-8-sig')
for job in re.findall(r'case JobType\.([A-Z_]+):',worker_source):
    dispatchers.append(dict(id='sqs-'+job.lower().replace('_','-'),parent_registry_id='sqs-worker',type='SQS job variant',owner='Platform worker owner plus handler domain owner',status='unsupported; retry/DLQ if submitted' if job in ['GENERATE_LESSON_AUDIO','AUTONOMOUS_WORKFLOW_RUN'] else 'implemented but unverified',production_status='UNKNOWN',paths=['worker/handlers/index.ts','worker/index.ts']))
dump('WORKFLOW_ENTRYPOINTS.json',dispatchers)
flag_rows=[]
for f in d['flag_references']:
    flag_rows.append(dict(**f,git_blob=d['tracked_blobs'][f['path']],effective_production_value='UNKNOWN',evidence_strength='E4 source reference',registry_ids=[x['id'] for x in agents if f['path'] in x['implementation']]))
dump('FEATURE_FLAG_REFERENCES.json',flag_rows)
with (OUT/'FEATURE_FLAG_REFERENCES.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,['name','path','line','git_blob','effective_production_value']);w.writeheader();w.writerows({k:x[k] for k in w.fieldnames} for x in flag_rows)
efficiency=dict(repository_files_discovered=d['tracked_file_count'],candidate_files_identified=d['candidate_file_count'],runtime_candidate_files=d['runtime_candidate_file_count'],files_inspected_in_detail=len(inspected),cached_evidence_records=len(evidence),unique_registry_entries=len(agents),logical_runtime_groups_excluding_dispatchers=counts['logical_runtime_groups_excluding_dispatchers'],duplicate_path_references_eliminated=sum(len(x['implementation']) for x in agents)-len(set(p for x in agents for p in x['implementation'])),aliases_mapped=sum(len(x['aliases']) for x in agents),unique_flag_names=len(set(x['name'] for x in flag_rows)),flag_reference_count=len(flag_rows),sampled=['UI/device/accessibility journeys','full route-by-route authorization','ancillary generation CLIs','historical branches beyond four pinned contexts','all operational detector/prediction/optimization consumers','current hosted deployment and learner outcome evidence unavailable'],remaining_uncertainty=['Current production agent invocation counts/flags/costs','n8n and external schedules','Vercel schedule plan and disable state','full dynamic call graph and every privileged SDK permission','fresh dependency advisories','deployed RLS/MFA/restore readiness','qualified academic review and retained outcomes'],token_savings_percentage=None)
efficiency['curated_evidence_records']=sum(not e['id'].startswith('DISC') for e in evidence)
efficiency['discovery_only_evidence_records']=sum(e['id'].startswith('DISC') for e in evidence)
commands=[{'command':c,'purpose':p,'mode':'read-only source'} for c,p in [('git status --short; git branch --show-current; git worktree list','Safety and active ownership baseline'),('git ls-files; git ls-files -s','Tracked discovery and git blob index'),('python discover.py','Deterministic pattern/import/flag candidate cache'),('python enrich_discovery.py','Incremental git-grep enrichment without individual file reads'),('rg targeted provider/registry/guard/import patterns','Runtime tracing and alias deduplication'),('git log --all with agent/research/REA/n8n/MergeOps selectors','Historical names and changes; search is a discovery aid'),('git log main..branch; git show pinned-commit:path','Four selected in-flight branches through Git objects only'),('GitHub fetch_commit_workflow_runs at 887f23ecc','Connected read-only query returned empty first page of PR-triggered runs only; no inference about other events or scheduler activation'),('python build_reports.py','Generate audit-only artifacts from canonical registry and evidence'),('python validate_reports.py','Artifact integrity and source fingerprint checks')]]
dump('AUDIT_EVIDENCE.json',dict(source_commit=BASE,audit_date='2026-10-23',scope='Read-only pinned-main static audit plus four pinned branch documentation contexts; artifacts only in isolated audit worktree',evidence_strength={'E0':'Live execution, none observed','E1':'Inspected source implementation/guard/caller','E2':'Dated repository execution/audit record not reproduced','E3':'Documentation/branch claim','E4':'Candidate/pattern discovery only'},counts=counts,efficiency=efficiency,evidence=evidence,risks=risks,recommendations=recs,capabilities=capabilities,commands=commands,inspected_files=sorted(inspected),historical_revalidation=s['historical_revalidation'],external_unknowns=a['external_unknowns'],github_observation={'tool':'GitHub fetch_commit_workflow_runs','commit':BASE,'response':{'workflow_runs':[]},'limitation':'Wrapper filters PR-triggered events and first page. Empty response does not establish disabled/unexecuted workflows.'},branches=branches,limitations=efficiency['sampled']+efficiency['remaining_uncertainty']))
write('TOKEN_EFFICIENCY_REPORT.md',f'''# Token efficiency report

{table(['Measure','Count'],[(k,v) for k,v in efficiency.items() if isinstance(v,int)])}

The fingerprinted evidence index separates source-confirmed records from pattern leads. Detail inspection count is the unique union of reviewers' declared paths; source discovery is an automated scan, not full-body human review. Duplicate path references counts repeated implementation references removed across the registry, not the number of redundant agents. Aliases are mapped explicitly; no false exact count of duplicate names removed is inferred from filenames.

Intentionally sampled: {txt(efficiency['sampled'])}.

Remaining uncertainty: {txt(efficiency['remaining_uncertainty'])}.

No token-savings percentage is claimed. Actual model-token measurements were unavailable. No previous audit was adopted wholesale as a current fact: older findings were rechecked or labeled dated; source blobs and raw-byte SHA256 enable future reuse without rereading unchanged source.
''')
write('EXECUTIVE_BRIEF.md',f'''# Project Atlas executive brief

LiberiaLearn has substantial reusable school operations, governed learner-state foundations, bounded AI orchestration and human-review controls. The main problem is completing and validating academic workflows, content quality and operational authority before expanding activation. A rewrite is not justified.

At main `{BASE[:9]}`, the proposed registry has **{len(agents)} entries**: {', '.join(str(v)+' '+k for k,v in counts['by_type'].items())}. These include **37 scheduler/workflow dispatchers and26 documentation personas**, not121 independent AI agents. **0 production-active agents confirmed;2 configured-disabled entries;2 test-only;0 confirmed obsolete**. Remaining live activation is unknown. See [catalog](AGENT_INVENTORY.md) for exact status counts and grouping.

Two HIGH code defects merit P0 repair. School administrators can read global raw agent invocation rows through `/api/admin/agents/invocations`. Student offline sync can overwrite canonical teacher attendance using newer device timestamps. Production exploitation was not observed. Evidence: [invocation route](../../../app/api/admin/agents/invocations/route.ts#L45), [attendance policy](../../../lib/offline-sync/policies.ts#L27), SEC-R01/02 in [risk register](RISK_REGISTER.md).

The five largest gaps are academically admitted full-day K-12 content, governed diagnostic/remediation coverage beyond G4 Math, complete independent-assessment-to-records integration, demonstrated retention/transfer/intervention outcomes, and reliable low-connectivity operations. The frozen Oct16 catalog baseline reports0 mechanical passes among1105 revisions and says every judgment review is pending; it is dated repository evidence, not a new production audit. [Baseline](../../../docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md#L3), [governed registry](../../../lib/learning-authority/publishedReleases.ts#L1), [V2 write hold](../../../lib/assessment/v2/consumers.ts#L26).

Prioritize these five actions:

1. Close cross-school invocation access and student-authored canonical attendance, with hostile two-school/teacher-record checks.
2. Repair WAEC attempt replay and lab suggested-score/refusal attribution before admitting those signals as attainment.
3. Finish one exact-version, independently reviewed schoolday under the existing CoS program gates, with missing resources explicit.
4. Complete one approved Assessment V2 → human moderation → official-reader slice; retain downstream-write holds until proven.
5. Verify job identity/handler support, full restore, costs and effective flags; then run a measured retention/transfer pilot.

Useful consolidation is narrow: teacher planner/grader contracts, legacy generation entry points, health ownership and cost ledgers. The tutor already uses a shared grounded engine; `router.ts` already re-exports the provider router. Keep these. The factory's eight roles are injected workflow stages, not eight autonomous agents. MergeOps write policy remains disabled. n8n/hosted workflows, current flags, current dependency advisories and current learning outcomes require external verification. See [architecture](AGENT_DEPENDENCY_MAP.md), [activation decisions](ACTIVATION_DECISIONS.md) and [roadmap](PRIORITIZED_ROADMAP.md).

Koloqua and Kindergarten admission are additional inclusion gaps: current locales are en/kpe/bss and enrollment accepts grades1-12. Existing narration/localization and schoolday planning provide a starting point. [Locale registry](../../../i18n.ts#L4), [learning review](learning-review.md).

No application code, schema, production configuration, flags, database records or other agents' worktrees were modified. In-flight branches were read through pinned Git objects. A [Chief of Staff handoff](CHIEF_OF_STAFF_HANDOFF.md) is prepared in this audit workspace; no external message was sent. [Token efficiency report](TOKEN_EFFICIENCY_REPORT.md) records scope and sampling.
''')
write('CHIEF_OF_STAFF_HANDOFF.md',f'''# Project Atlas handoff to Chief of Staff

Prepared for the K-12 STEM Excellence program owner. This file is the handoff; no owned program document or worktree was changed and no external communication was sent.

Main audit base `{BASE}`. Read [executive brief](EXECUTIVE_BRIEF.md), [P0/P1 risk register](RISK_REGISTER.md) and [prioritized roadmap](PRIORITIZED_ROADMAP.md). Treat SEC-R01/02 as immediate platform-authority repairs. T1 should own virtual-lab score/refusal provenance; academic platform should own WAEC sealed attempts and V2 official evidence; T2 should retain factory author/reviewer separation and exact-version content gates. Security/operations should verify logs, effective kill switches, unsupported queue jobs and restore.

Do not relabel the Oct16 library audit as completed independent review. The baseline explicitly says all1105 judgment areas await qualified independent review. CoS branch docs/program/STEM_PROGRAM_V1.md wording should be reconciled by its owner. The planned all-grade schoolday is an in-flight program, not released coverage; see [pinned branch contexts](BRANCH_CONTEXT.json).

Recommend one canonical agent/workflow registry owner and one acceptance ledger linking existing program gates to exact content, learner evidence and deployment revisions. The registry proposed here carries no activation or publication authority. Keep Assessment V2 downstream writes and MergeOps write capability under their current approval gates. No application, rollout or sprint change was performed by the audit.
''')
write('README.md',f'''# Project Atlas audit

Base `{BASE}`. Audit branch `audit/project-atlas-20261023`. All authored files are confined to this directory in the isolated worktree. Main and all other worktrees were preserved.

Start with [EXECUTIVE_BRIEF.md](EXECUTIVE_BRIEF.md). The ten requested outputs are AGENT_INVENTORY.md, AGENT_DEPENDENCY_MAP.md, ACTIVATION_DECISIONS.md, PLATFORM_CAPABILITY_MATRIX.md, STRATEGIC_GAP_ANALYSIS.md, RISK_REGISTER.md, PRIORITIZED_ROADMAP.md, EXECUTIVE_BRIEF.md, AGENT_INVENTORY.csv and AUDIT_EVIDENCE.json.

[AGENT_REGISTRY.json](AGENT_REGISTRY.json) is the canonical proposed registry. Markdown and CSV views are generated from it by build_reports.py; review JSON/Markdown files are frozen reviewer inputs, not independent registries to maintain. CANDIDATES.json holds deterministic discovery, import and blob metadata; DISCOVERY_COVERAGE.json reconciles candidate paths; FEATURE_FLAG_REFERENCES.json/.csv indexes source flag references without environment values; BRANCH_CONTEXT.json pins four in-flight documentation contexts. No secrets, raw student records or protected assessment keys are included.

Evidence codes and limitations are in AUDIT_EVIDENCE.json. Production activity is unknown; an empty connected GitHub PR-run query is recorded with its narrow limitations. Candidate counts, source-confirmed capability groups and workflow dispatchers must not be conflated. For future updates, compare source_commit/git_blob/fingerprint and reread only changed evidence. Do not invoke agents or application scripts to regenerate this documentation.

Reproduction: discover.py creates cheap tracked-source metadata; enrich_discovery.py adds targeted provider/flag metadata; supplement.py and the frozen domain review inputs supply judged records; branch_context.py pins selected branch documentation; build_reports.py renders normalized outputs; validate_reports.py checks integrity. Discovery scripts scan source, and do not execute application imports. All runtime testing and hosted verification remain separate authorized work.
''')
# Correct canonical symbol paths and spacing in the final generated prose.
for p in OUT.glob('*.md'):
    if p.name in ['automation-review.md','learning-review.md','security-review.md']:continue
    text=p.read_text(encoding='utf-8')
    text=text.replace('lib/records/v2/legacyAssignmentScoreAuthority.ts','lib/academic-records/v2/gradeCalculation.ts').replace('lib/academics/enrollment/contracts.ts','lib/records/systemOfRecord.ts')
    # Preserve hashes, paths, IDs and link targets; use explicit editorial substitutions only.
    if p.name in ['EXECUTIVE_BRIEF.md','CHIEF_OF_STAFF_HANDOFF.md']:
        text=text.replace('and26','and 26').replace('not121','not 121').replace('confirmed;2','confirmed; 2').replace('entries;2','entries; 2').replace('test-only;0','test-only; 0').replace('reports0','reports 0').replace('among1105','among 1,105').replace('grades1-12','grades 1–12').replace('all1105','all 1,105')
    p.write_text(text,encoding='utf-8')
print(json.dumps({'counts':counts,'efficiency':efficiency,'risks':len(risks),'recommendations':len(recs)},indent=2))
