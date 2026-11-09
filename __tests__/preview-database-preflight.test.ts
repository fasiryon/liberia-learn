import {describe,it,expect,vi} from 'vitest';
import {evaluateDatabasePreflight,metadataFingerprint,REQUIRED_IMMUTABILITY_TRIGGERS,collectDatabaseMetadata} from '@/scripts/preview/database-preflight.mjs';

function fixture(){
  const s:any={identity:{database:'postgres',username:'preview_app',sessionUser:'preview_app',readOnly:true,tls:true,version:170000,inRecovery:false,databaseCreate:false,databaseTemp:false,replicationRole:'origin',canSetReplicationRole:false,vector:true,serverAddress:'127.0.0.1',serverPort:5432},
    roles:[{name:'preview_app',superuser:false,createdb:false,createrole:false,bypassrls:false,replication:false,adminOption:false}],
    schemas:[{name:'public',owner:'preview_owner',ownerReachable:false,canCreate:false,memberCreate:false,typeOwnerReachable:false,publicCreate:false}],
    relations:['User','AuditLog','CurriculumContentRevision','CurriculumGovernanceEvent','CurriculumEvidence','CurriculumProvenance'].map(name=>({name,schema:'public',kind:'r',owner:'preview_owner',ownerReachable:false,rls:true,forceRls:true,privileges:name.startsWith('Curriculum')?[]:['SELECT']})),
    policies:[],triggers:[],grants:[],defaults:[],functions:[],columns:[],remote:{foreignServers:0,userMappings:0,subscriptions:0,otherDatabases:[],extensions:['plpgsql','vector']},migrations:{ledgerExists:false,rows:[]}};
  s.policies=s.relations.map((r:any)=>({schema:'public',table:r.name,name:r.name+'_runtime_select',roles:['preview_app'],command:'SELECT',usingHash:'reviewed-expression-hash',checkHash:null}));
  s.triggers=REQUIRED_IMMUTABILITY_TRIGGERS.map((r:any)=>({...r,schema:'public',enabled:'O',functionHash:'b'.repeat(64),definitionHash:'c'.repeat(64),functionOwnerReachable:false}));
  const policy:any={version:'preview-db-policy/2',status:'ACCEPTED',reviewId:'synthetic-test-only',projectRef:'previewsyntheticrefz',endpointHost:'db.previewsyntheticrefz.supabase.co',migrationMode:'schema-push-reviewed',schemaSha256:'a'.repeat(64),fingerprints:{}};
  for(const key of Object.keys(s))policy.fingerprints[key]=metadataFingerprint(s[key]);
  // The runtime pin comes from the operator's execution environment (PREVIEW_PINNED_PROJECT_REF), never the policy file.
  const env:any={PREVIEW_PINNED_PROJECT_REF:'previewsyntheticrefz'};
  return {s,policy,env,context:{projectRef:policy.projectRef,endpointHost:policy.endpointHost,schemaSha256:policy.schemaSha256,repositoryMigrations:[]}};
}
describe('read-only Preview database acceptance gates',()=>{
  it('accepts only an explicitly reviewed complete metadata contract and emits no metadata values',()=>{
    const {s,policy,context,env}=fixture();expect(evaluateDatabasePreflight(s,policy,context,env).status).toBe('PASS');
    s.identity.database='secret-looking-unsafe-name';
    const r=evaluateDatabasePreflight(s,policy,context,env);expect(r.status).toBe('BLOCKED');expect(JSON.stringify(r)).not.toContain('secret-looking-unsafe-name');
  });
  it.each(['wrong-database','wrong-user','membership','schema-create','database-create','database-temp','dangerous-membership','owner','public-grant','truncate','missing-rls','missing-force','missing-policy','missing-trigger','disabled-trigger','changed-trigger','unsafe-default','remote','unsafe-function','unknown-policy','migration','unknown-field','tls','endpoint'])('fails closed on %s',kind=>{
    const {s,policy,context,env}=fixture();
    if(kind==='wrong-database')s.identity.database='production';
    if(kind==='wrong-user')s.identity.username='postgres';
    if(kind==='membership')s.roles.push({...s.roles[0],name:'elevated-role',bypassrls:true});
    if(kind==='schema-create')s.schemas[0].canCreate=true;
    if(kind==='database-create')s.identity.databaseCreate=true;
    if(kind==='database-temp')s.identity.databaseTemp=true;
    if(kind==='dangerous-membership')s.roles.push({...s.roles[0],name:'pg_write_all_data'});
    if(kind==='owner')s.relations[0].ownerReachable=true;
    if(kind==='public-grant')s.grants.push({schema:'public',kind:'r',object:'User',grantee:'PUBLIC',privilege:'SELECT',grantable:false});
    if(kind==='truncate')s.relations[0].privileges.push('TRUNCATE');
    if(kind==='missing-rls')s.relations[0].rls=false;
    if(kind==='missing-force')s.relations[0].forceRls=false;
    if(kind==='missing-policy')s.policies=[];
    if(kind==='missing-trigger')s.triggers.pop();
    if(kind==='disabled-trigger')s.triggers[0].enabled='D';
    if(kind==='changed-trigger')s.triggers[0].functionHash='changed';
    if(kind==='unsafe-default')s.defaults.push({schema:'public',owner:'preview_owner',kind:'r',grantee:'authenticated',privilege:'INSERT',grantable:false});
    if(kind==='remote')s.remote.foreignServers=1;
    if(kind==='unsafe-function')s.functions.push({schema:'public',name:'unsafe',signature:'',definitionHash:'d'.repeat(64),owner:'preview_owner',kind:'f',ownerReachable:false,grantable:false,securityDefiner:true,appExecute:true,acl:[]});
    if(kind==='unknown-policy')policy.status='UNAPPROVED';
    if(kind==='migration')s.migrations={ledgerExists:true,rows:[{name:'unknown',checksum:'0'.repeat(64),finished:false,rolledBack:false}]};
    if(kind==='unknown-field')delete s.schemas;
    if(kind==='tls')s.identity.tls=false;
    if(kind==='endpoint')context.endpointHost='production.invalid';
    const result=evaluateDatabasePreflight(s,policy,context,env);
    const expected={'wrong-database':'database_identity','wrong-user':'database_identity',membership:'role_membership','dangerous-membership':'role_membership','schema-create':'schema_modification','database-create':'schema_modification','database-temp':'schema_modification',owner:'ownership','public-grant':'external_grants',truncate:'application_grants','missing-rls':'rls_enforcement','missing-force':'rls_enforcement','missing-policy':'rls_policies','missing-trigger':'immutability_triggers','disabled-trigger':'immutability_triggers','changed-trigger':'reviewed_triggers','unsafe-default':'external_grants',remote:'cross_database','unsafe-function':'security_definer','unknown-policy':'reviewed_contract',migration:'migration_state','unknown-field':'metadata_shape',tls:'database_identity',endpoint:'provider_endpoint_binding'}[kind];
    expect(result.status).toBe('BLOCKED');expect(result.gates.find(g=>g.name===expected)?.status).toBe('BLOCKED');
  });
  it('uses a read-only repeatable snapshot and returns safe failure on catalog denial',async()=>{
    const tx:any={$executeRawUnsafe:vi.fn(),$queryRawUnsafe:vi.fn().mockRejectedValue(Error('private-connection-value'))};
    const db:any={$transaction:vi.fn(async fn=>fn(tx))};
    await expect(collectDatabaseMetadata(db)).rejects.toThrow('preview_preflight_catalog_unavailable');
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL search_path = pg_catalog');
    expect(db.$transaction.mock.calls[0][1]).toMatchObject({isolationLevel:'RepeatableRead'});
  });
});

// Phase 2 scrub reviewer P1-a (11-09): the preflight must bind the reviewed policy AND the target to the runtime pin,
// independently of each other. Before this fix an ACCEPTED policy for ANY well-formed non-Production project, paired
// with a context for that same project, passed reviewed_contract. Each case names the gate that must refuse.
describe('reviewed_contract and endpoint are bound to the runtime pin (fail closed)',()=>{
  const OTHER='othersyntheticrefzzz',PROD='bnphuinpvgpmebcsvmsp';
  const gate=(r:any,name:string)=>r.gates.find((g:any)=>g.name===name)?.status;
  it.each<[string,(f:any)=>void]>([
    ['policy and context both name another well-formed project (not the pin)',f=>{f.policy.projectRef=OTHER;f.context.projectRef=OTHER;}],
    ['context ref malformed',f=>{f.policy.projectRef='Not-A-Ref';f.context.projectRef='Not-A-Ref';}],
    ['context ref is Production',f=>{f.policy.projectRef=PROD;f.context.projectRef=PROD;}],
    ['policy ref differs from the context',f=>{f.policy.projectRef=OTHER;}],
    ['template policy with a null ref against a real context',f=>{f.policy.projectRef=null;}],
    ['pin missing',f=>{delete f.env.PREVIEW_PINNED_PROJECT_REF;}],
    ['pin empty',f=>{f.env.PREVIEW_PINNED_PROJECT_REF='';}],
    ['pin 19 letters',f=>{f.env.PREVIEW_PINNED_PROJECT_REF='previewsyntheticref';}],
    ['pin 21 letters',f=>{f.env.PREVIEW_PINNED_PROJECT_REF='previewsyntheticrefzz';}],
    ['pin upper-case',f=>{f.env.PREVIEW_PINNED_PROJECT_REF='PREVIEWSYNTHETICREFZ';}],
    ['pin is Production (target still synthetic)',f=>{f.env.PREVIEW_PINNED_PROJECT_REF=PROD;}],
    ['pin differs from a matching policy/context pair',f=>{f.env.PREVIEW_PINNED_PROJECT_REF=OTHER;}],
  ])('reviewed_contract BLOCKED: %s',(_l,mutate)=>{
    const f:any=fixture();mutate(f);
    const r=evaluateDatabasePreflight(f.s,f.policy,f.context,f.env);
    expect(r.status).toBe('BLOCKED');expect(gate(r,'reviewed_contract')).toBe('BLOCKED');
  });
  it.each<[string,(f:any)=>void]>([
    ['direct host of another project',f=>{f.policy.endpointHost=f.context.endpointHost='db.'+OTHER+'.supabase.co';}],
    ['pooler host with no project user',f=>{f.policy.endpointHost=f.context.endpointHost='aws-0-us-east-2.pooler.supabase.com';}],
    ['pooler host bound to another project',f=>{f.policy.endpointHost=f.context.endpointHost='aws-0-us-east-2.pooler.supabase.com';f.context.endpointProjectRef=OTHER;}],
    ['an arbitrary host',f=>{f.policy.endpointHost=f.context.endpointHost='synthetic.invalid';}],
  ])('provider_endpoint_binding BLOCKED: %s',(_l,mutate)=>{
    const f:any=fixture();mutate(f);
    const r=evaluateDatabasePreflight(f.s,f.policy,f.context,f.env);
    expect(r.status).toBe('BLOCKED');expect(gate(r,'provider_endpoint_binding')).toBe('BLOCKED');expect(gate(r,'reviewed_contract')).toBe('PASS');
  });
  it('the pooler endpoint passes only when its user binds it to the pinned project',()=>{
    const f:any=fixture();f.policy.endpointHost=f.context.endpointHost='aws-0-us-east-2.pooler.supabase.com';f.context.endpointProjectRef='previewsyntheticrefz';
    expect(evaluateDatabasePreflight(f.s,f.policy,f.context,f.env).status).toBe('PASS');
  });
});
