"""Write exact-commit local mailbox handoff from captured verification records."""
from pathlib import Path
import json,hashlib,sys
OUT=Path(__file__).resolve().parent;finding=sys.argv[1];test_sha=sys.argv[2];fix_sha=sys.argv[3]
data={}
for phase in ['RED','GREEN']:
    p=OUT/'evidence'/f'{finding}-{phase}.json';d=json.loads(p.read_text());data[phase]=d
    text=OUT/'evidence'/f'{finding}-{phase}.txt';text.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
assert data['RED']['failed']>0 and data['GREEN']['failed']==0
checks=[]
for kind in ['types','changed','related']:
    p=OUT/'evidence'/f'{finding}-{kind}.json'
    if p.exists():checks.append(json.loads(p.read_text()))
lines=[f'# Codex Atlas to CoS: {finding} ready for exact-commit review','',f'Test-only commit: `{test_sha}`. Repair commit: `{fix_sha}`. Finding remains OPEN pending CoS acceptance; no push/merge/deploy/production access.','',f'Exact command at both commits: `python docs/audits/project-atlas-20261023/post-audit/run_verification.py --finding {finding} --phase RED` or `--phase GREEN`.','',f"RED: {data['RED']['failed']} failed, {data['RED']['passed']} passed; actual exit {data['RED']['exit_code']}. GREEN: {data['GREEN']['passed']} passed, {data['GREEN']['failed']} failed; actual exit {data['GREEN']['exit_code']}.",'','Captured records are in the Atlas worktree `docs/audits/project-atlas-20261023/post-audit/evidence/`.']
for phase in ['RED','GREEN']:
    p=OUT/'evidence'/f'{finding}-{phase}.txt';lines+=['',f'- `{p.name}` SHA256 `{hashlib.sha256(p.read_bytes()).hexdigest()}`.']
for c in checks:lines+=['',f"- {c['check']}: exit {c['exit_code']}; recorded source `{c['head']}`; `{finding}-{c['check']}.json` and `.txt` contain command and output SHA256."]
notes={
 'SEC-R03':'Scope: explicit audiences on all8 built-ins; public input/output and translated output fail closed; constant safe fallback; internal/general compatibility preserved. 31 directly related tests passed before the broader changed gate. Independent review: SEC-R03-INDEPENDENT_REVIEW.md, code-side PASS. Classroom wrapper still returns503 on non-SUCCESS rather than narrating the runtime fallback; guardian wrapper sends the static fallback. This is a bounded UX/acceptance caveat, not unchecked AI release. No learner-state, tool authority, flag or curriculum change.',
 'SEC-R01':'Scope: global raw invocation logs require authenticated platform-admin membership; school ADMIN and forged userId filters are denied before any count/read. Existing platform-admin and student-denial controls pass. Shared AGENT_PLATFORM_VIEW grants remain for tenant-scoped escalation workflows. Raw platform diagnostics still need separate minimization/retention review.',
 'SEC-R02':'Scope: student attendance becomes an explicit conflict retained by the device outbox; it cannot create or replace canonical attendance. Resolver defaults conflict rather than trusting timestamps. No server teacher-review task is created by this containment. Other queued operation categories and trusted staff writer stay separate. Preserved WIP68e66a70b unchanged; read-only merge-tree has one sync conflict,21 overall; no merge readiness claimed.',
}
lines+=['',notes.get(finding,'See the finding-specific implementation note and regression cases for failure, honest flow and boundary checks.'),'','Self assessment: PASS for captured isolated code-side checks; deployment assurance remains unverified. CoS must review exact commits and independent security evidence before changing tracker status.']
text='\n'.join(lines)+'\n';(OUT/f'{finding}-READY.md').write_text(text,encoding='utf-8')
mail=Path('C:/liberia-learn/artifacts/v4-coordination')/f'CODEX-ATLAS-{finding}-READY.md';mail.write_text(text,encoding='utf-8')
print(str(mail))
