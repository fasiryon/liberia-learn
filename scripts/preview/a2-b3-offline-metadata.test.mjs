// Synthetic catalog replay only. No client, network, credentials or SQL execution.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {evaluateDatabasePreflight,metadataFingerprint,repositoryDatabaseContract,REQUIRED_IMMUTABILITY_TRIGGERS,collectDatabaseMetadata} from './database-preflight.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const catalogColumn=(fields={})=>({schema:'public',table:'User',column:'id',type:'text',nullable:false,privileges:[],grantOptions:[],acl:[],...fields});
const catalogRoutine=(fields={})=>({schema:'public',name:'helper',signature:'',definitionHash:'d'.repeat(64),owner:'preview_owner',kind:'f',ownerReachable:false,grantable:false,appExecute:false,securityDefiner:false,acl:[],...fields});
function fixture(){
  const contract=repositoryDatabaseContract(root);
  const tables=['School','User','Student','Class','Enrollment','TeacherProfile','Timetable','Assignment','Attendance','DataPolicyAcceptance','PolicyConfig','AuditLog','CurriculumContentRevision','CurriculumGovernanceEvent','CurriculumEvidence','CurriculumProvenance','_prisma_migrations'];
  const s={
    identity:{database:'postgres',username:'preview_app',sessionUser:'preview_app',readOnly:true,tls:true,version:170000,inRecovery:false,databaseCreate:false,databaseTemp:false,replicationRole:'origin',canSetReplicationRole:false,vector:true,serverAddress:'127.0.0.1',serverPort:5432},
    roles:[{name:'preview_app',superuser:false,createdb:false,createrole:false,bypassrls:false,replication:false,adminOption:false}],
    schemas:[{name:'public',owner:'preview_owner',ownerReachable:false,canCreate:false,memberCreate:false,typeOwnerReachable:false,publicCreate:false}],
    relations:tables.map(name=>({name,schema:'public',kind:'r',owner:'preview_owner',ownerReachable:false,rls:true,forceRls:true,privileges:name.startsWith('Curriculum')?[]:name==='AuditLog'?['SELECT','INSERT']:['SELECT']})),
    policies:tables.map(table=>({schema:'public',table,name:`${table}_runtime_select`,roles:['preview_app'],command:'SELECT',usingHash:'d'.repeat(64),checkHash:null})),
    triggers:REQUIRED_IMMUTABILITY_TRIGGERS.map(t=>({...t,schema:'public',enabled:'O',functionHash:'b'.repeat(64),definitionHash:'c'.repeat(64),functionOwnerReachable:false})),
    grants:[],defaults:[],functions:[],columns:[],
    remote:{foreignServers:0,userMappings:0,subscriptions:0,otherDatabases:[],extensions:['plpgsql','vector']},
    migrations:{ledgerExists:true,rows:contract.repositoryMigrations.map(m=>({...m,finished:true,rolledBack:false}))}
  };
  const p={version:'preview-db-policy/2',status:'ACCEPTED',reviewId:'SYNTHETIC-OFFLINE-ONLY-NOT-ATLAS-ACCEPTANCE',projectRef:'previewsyntheticrefz',endpointHost:'db.previewsyntheticrefz.supabase.co',migrationMode:'migration-ledger',schemaSha256:contract.schemaSha256,fingerprints:{}};
  for(const key of Object.keys(s))p.fingerprints[key]=metadataFingerprint(s[key]);
  return {s,p,c:{...contract,projectRef:p.projectRef,endpointHost:p.endpointHost}};
}
// Synthetic runtime pin (operator execution environment); the real Preview reference never enters source.
const evaluate=({s,p,c})=>evaluateDatabasePreflight(s,p,c,{PREVIEW_PINNED_PROJECT_REF:'previewsyntheticrefz'});
test('synthetic reviewed runtime catalog with full mock migration ledger passes',()=>{
  const f=fixture();assert.ok(f.c.repositoryMigrations.length>0);assert.equal(evaluate(f).status,'PASS');
});
const mutations={
  'runtime owns a table':f=>{f.s.relations[0].owner='preview_app';},
  'runtime inherits owner':f=>{f.s.relations[0].ownerReachable=true;},
  'schema CREATE':f=>{f.s.schemas[0].canCreate=true;},
  'PUBLIC schema CREATE':f=>{f.s.schemas[0].publicCreate=true;},
  'database TEMP':f=>{f.s.identity.databaseTemp=true;},
  'BYPASSRLS membership':f=>{f.s.roles.push({...f.s.roles[0],name:'indirect',bypassrls:true});},
  'role admin option':f=>{f.s.roles[0].adminOption=true;},
  'SET replication role':f=>{f.s.identity.canSetReplicationRole=true;},
  'RLS disabled':f=>{f.s.relations[0].rls=false;},
  'FORCE RLS absent':f=>{f.s.relations[0].forceRls=false;},
  'missing policy':f=>{f.s.policies=[];},
  'runtime User update':f=>{f.s.relations.find(r=>r.name==='User').privileges.push('UPDATE');},
  'runtime audit delete':f=>{f.s.relations.find(r=>r.name==='AuditLog').privileges.push('DELETE');},
  'runtime audit truncate':f=>{f.s.relations.find(r=>r.name==='AuditLog').privileges.push('TRUNCATE');},
  'runtime trigger privilege':f=>{f.s.relations[0].privileges.push('TRIGGER');},
  'column credential update':f=>{f.s.columns.push(catalogColumn({column:'hashedPwd',privileges:['UPDATE']}));},
  'PUBLIC data grant':f=>{f.s.grants.push({grantee:'PUBLIC',privilege:'SELECT'});},
  'provider default privilege':f=>{f.s.defaults.push({grantee:'service_role',privilege:'INSERT'});},
  'runtime grant option':f=>{f.s.grants.push({grantee:'preview_app',privilege:'SELECT',grantable:true});},
  'missing immutable trigger':f=>{f.s.triggers.pop();},
  'disabled immutable trigger':f=>{f.s.triggers[0].enabled='D';},
  'reachable guard owner':f=>{f.s.triggers[0].functionOwnerReachable=true;},
  'unsafe callable function':f=>{f.s.functions.push(catalogRoutine({securityDefiner:true,appExecute:true}));},
  'incomplete migration':f=>{f.s.migrations.rows[0].finished=false;},
  'rolled-back migration':f=>{f.s.migrations.rows[0].rolledBack=true;},
  'missing migration':f=>{f.s.migrations.rows.pop();},
  'changed checksum':f=>{f.s.migrations.rows[0].checksum='e'.repeat(64);},
  'duplicate migration':f=>{f.s.migrations.rows.push({...f.s.migrations.rows[0]});},
  'unapproved policy':f=>{f.p.status='UNAPPROVED';}
};
for(const [name,mutate] of Object.entries(mutations))test(`refuses ${name} even with re-fingerprinted synthetic metadata`,()=>{
  const f=fixture();mutate(f);
  // Prove intrinsic gates reject, rather than only comparing the old snapshot hash.
  for(const key of Object.keys(f.s))f.p.fingerprints[key]=metadataFingerprint(f.s[key]);
  assert.equal(evaluate(f).status,'BLOCKED');
});
test('unknown policy expression and trigger-body changes require new reviewed hashes',()=>{
  for(const change of [f=>{f.s.policies[0].usingHash='f'.repeat(64);},f=>{f.s.triggers[0].functionHash='f'.repeat(64);}]){
    const f=fixture();change(f);assert.equal(evaluate(f).status,'BLOCKED');
  }
});
test('mock collector executes only read-only setup plus SELECT catalog queries',async()=>{
  const f=fixture();let section=0;const keys=Object.keys(f.s);const calls=[];
  const tx={
    $executeRawUnsafe:async sql=>{assert.equal(sql,calls.length===0?'SET TRANSACTION READ ONLY':'SET LOCAL search_path = pg_catalog');calls.push(sql);},
    $queryRawUnsafe:async sql=>{
      const withoutComments=sql.replace(/--[^\n]*/g,'').trim();assert.match(withoutComments,/^SELECT\b/i);
      calls.push(sql);
      if(section<keys.length)return [{value:structuredClone(f.s[keys[section++]])}];
      assert.match(sql,/FROM public\._prisma_migrations/);return f.s.migrations.rows;
    }
  };
  const db={$transaction:async (fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx);}};
  const collected=await collectDatabaseMetadata(db);assert.equal(section,12);assert.equal(calls.length,15);
  assert.deepEqual(collected.migrations,f.s.migrations);
});
test('catalog-denial output does not leak underlying driver data',async()=>{
  const tx={$executeRawUnsafe:async()=>{},$queryRawUnsafe:async()=>{throw Error('SYNTHETIC-PRIVATE-MARKER');}};
  await assert.rejects(collectDatabaseMetadata({$transaction:async fn=>fn(tx)}),/^Error: preview_preflight_catalog_unavailable$/);
});
test('runtime policy writes remain blocked even with reviewed fingerprints',()=>{
  const f=fixture();f.s.relations.find(r=>r.name==='PolicyConfig').privileges.push('UPDATE');
  f.p.fingerprints.relations=metadataFingerprint(f.s.relations);
  assert.equal(evaluate(f).status,'BLOCKED');
});

function reseal(f){for(const key of Object.keys(f.s))f.p.fingerprints[key]=metadataFingerprint(f.s[key]);return f;}
test('Atlas P1: inherited column UPDATE cannot pass even when fingerprinted',()=>{
  const f=fixture();f.s.roles.push({...f.s.roles[0],name:'inherited_writer'});
  f.s.columns.push(catalogColumn({column:'hashedPwd',privileges:['UPDATE'],acl:[{grantee:'inherited_writer',privilege:'UPDATE',grantable:false}]}));
  assert.equal(evaluate(reseal(f)).gates.find(g=>g.name==='application_grants').status,'BLOCKED');
});
test('Atlas P1: inherited column SELECT WITH GRANT OPTION cannot pass',()=>{
  const f=fixture();f.s.roles.push({...f.s.roles[0],name:'inherited_reader'});
  f.s.columns.push(catalogColumn({privileges:['SELECT'],grantOptions:['SELECT'],acl:[{grantee:'inherited_reader',privilege:'SELECT',grantable:true}]}));
  assert.equal(evaluate(reseal(f)).gates.find(g=>g.name==='external_grants').status,'BLOCKED');
});
test('Atlas P1: public table name cannot authorize writes in another schema',()=>{
  const f=fixture();f.s.schemas.push({...f.s.schemas[0],name:'custom'});
  f.s.relations.push({...f.s.relations.find(r=>r.name==='AuditLog'),schema:'custom',privileges:['INSERT']});
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
test('Atlas P1: collector inventories custom-schema security-definer functions',async()=>{
  const f=fixture();f.s.schemas.push({...f.s.schemas[0],name:'custom'});
  const keys=Object.keys(f.s);let index=0;
  const tx={$executeRawUnsafe:async()=>{},$queryRawUnsafe:async sql=>{
    if(index===keys.length)return f.s.migrations.rows;
    const key=keys[index++];let value=structuredClone(f.s[key]);
    if(key==='functions'&&!/n\.nspname\s*=\s*'public'/.test(sql))value.push(catalogRoutine({schema:'custom',name:'escalate',securityDefiner:true,appExecute:true}));
    return [{value}];
  }};
  f.s=await collectDatabaseMetadata({$transaction:async fn=>fn(tx)});
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
test('Atlas P1: every object inventory is schema-qualified and covers non-system schemas',()=>{
  const sql=readFileSync(new URL('./database-preflight.sql',import.meta.url),'utf8');
  for(const name of ['relations','policies','triggers','grants','functions','columns']){
    const part=sql.split(`-- section: ${name}\n`)[1].split('-- section:')[0];
    assert.doesNotMatch(part,/(?:n\.nspname|schemaname)\s*=\s*'public'/,name);
    assert.match(part,/'schema'|AS schema/,name);
  }
  const columns=sql.split('-- section: columns\n')[1].split('-- section:')[0];
  assert.match(columns,/has_column_privilege/);assert.match(columns,/WITH GRANT OPTION/);assert.match(columns,/is_grantable/);assert.match(columns,/pg_has_role/);
});
test('a passive non-public schema is inventoried without granting runtime access',()=>{
  const f=fixture();f.s.schemas.push({...f.s.schemas[0],name:'custom'});
  f.s.relations.push({...f.s.relations[0],schema:'custom',name:'Restricted',privileges:[]});
  f.s.columns.push(catalogColumn({schema:'custom',table:'Restricted'}));
  f.s.functions.push(catalogRoutine({schema:'custom',name:'private_helper',securityDefiner:true}));
  assert.equal(evaluate(reseal(f)).status,'PASS');
});
test('safe inherited column SELECT cannot waive the no-membership topology contract',()=>{
  const f=fixture();f.s.roles.push({...f.s.roles[0],name:'reader'});
  f.s.columns.push(catalogColumn({privileges:['SELECT'],acl:[{grantee:'reader',privilege:'SELECT',grantable:false}]}));
  const result=evaluate(reseal(f));
  assert.equal(result.gates.find(g=>g.name==='application_grants').status,'PASS');
  assert.equal(result.gates.find(g=>g.name==='external_grants').status,'PASS');
  assert.equal(result.gates.find(g=>g.name==='role_membership').status,'BLOCKED');
});
for(const kind of ['missing-column-effective','missing-column-grant-options','missing-column-acl','inherited-table-grant-option','nonpublic-policy-spoof','nonpublic-trigger-spoof','inherited-schema-create','owned-enum','nonpublic-user-read','callable-aggregate','old-policy-version'])test(`refuses ${kind}`,()=>{
  const f=fixture();const c=catalogColumn({privileges:['SELECT']});
  if(kind.startsWith('missing-column')){delete c[{'missing-column-effective':'privileges','missing-column-grant-options':'grantOptions','missing-column-acl':'acl'}[kind]];f.s.columns.push(c);}
  if(kind==='inherited-table-grant-option'){f.s.roles.push({...f.s.roles[0],name:'reader'});f.s.grants.push({schema:'public',grantee:'reader',privilege:'SELECT',grantable:true});}
  if(kind==='nonpublic-policy-spoof'){f.s.schemas.push({...f.s.schemas[0],name:'custom'});f.s.policies.filter(p=>p.table==='User').forEach(p=>{p.schema='custom';});}
  if(kind==='nonpublic-trigger-spoof'){f.s.schemas.push({...f.s.schemas[0],name:'custom'});f.s.triggers[0].schema='custom';}
  if(kind==='inherited-schema-create')f.s.schemas[0].memberCreate=true;
  if(kind==='owned-enum')f.s.schemas[0].typeOwnerReachable=true;
  if(kind==='nonpublic-user-read'){f.s.schemas.push({...f.s.schemas[0],name:'custom'});f.s.relations.push({...f.s.relations[0],schema:'custom',name:'User'});}
  if(kind==='callable-aggregate')f.s.functions.push(catalogRoutine({kind:'a',appExecute:true}));
  if(kind==='old-policy-version')f.p.version='preview-db-policy/1';
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
test('Atlas R2: column-only SELECT on a view cannot use the table allowlist',()=>{
  const f=fixture(),user=f.s.relations.find(r=>r.name==='User');
  Object.assign(user,{kind:'v',privileges:[],rls:false,forceRls:false});
  f.s.columns.push({schema:'public',table:'User',column:'id',type:'text',nullable:false,privileges:['SELECT'],grantOptions:[],acl:[]});
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
test('Atlas R2: unsupported routine kind refuses even without EXECUTE',()=>{
  const f=fixture();
  f.s.functions.push({schema:'public',name:'unknown_routine',signature:'',definitionHash:'d'.repeat(64),owner:'preview_owner',kind:'?',ownerReachable:false,grantable:false,appExecute:false,securityDefiner:false,acl:[]});
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
test('Atlas R2: duplicate physical column identities cannot be fingerprinted into acceptance',()=>{
  const f=fixture(),column={schema:'public',table:'User',column:'id',type:'text',nullable:false,privileges:['SELECT'],grantOptions:[],acl:[]};
  f.s.columns.push(column,structuredClone(column));
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
for(const kind of ['v','m','f','S','?'])test(`column-only access refuses relation kind ${kind}`,()=>{
  const f=fixture();Object.assign(f.s.relations.find(r=>r.name==='User'),{kind,privileges:[],rls:false,forceRls:false});
  f.s.columns.push(catalogColumn({privileges:['SELECT']}));
  assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
for(const kind of ['r','p'])test(`column-only SELECT retains the ${kind} table control`,()=>{
  const f=fixture();Object.assign(f.s.relations.find(r=>r.name==='User'),{kind,privileges:[]});
  f.s.columns.push(catalogColumn({privileges:['SELECT']}));
  assert.equal(evaluate(reseal(f)).status,'PASS');
});
for(const field of ['schema','name','signature','definitionHash','owner','kind','acl','appExecute'])test(`non-executable routine requires ${field}`,()=>{
  const f=fixture(),routine=catalogRoutine();delete routine[field];f.s.functions.push(routine);
  const result=evaluate(reseal(f));assert.equal(result.status,'BLOCKED');
  assert.deepEqual(result.gates,[{name:'metadata_shape',status:'BLOCKED'}]);
});
test('routine identity includes signature, permits overloads and denies duplicates',()=>{
  const f=fixture();f.s.functions.push(catalogRoutine(),catalogRoutine({signature:'integer'}));
  assert.equal(evaluate(reseal(f)).status,'PASS');
  f.s.functions.push(catalogRoutine());assert.equal(evaluate(reseal(f)).status,'BLOCKED');
});
for(const section of ['roles','schemas','relations','policies','triggers'])test(`duplicate ${section} identities are refused before privilege checks`,()=>{
  const f=fixture();f.s[section].push(structuredClone(f.s[section][0]));
  assert.deepEqual(evaluate(reseal(f)).gates,[{name:'metadata_shape',status:'BLOCKED'}]);
});
test('column identities are qualified and same column names in different tables stay distinct',()=>{
  const f=fixture();f.s.columns.push(catalogColumn({privileges:['SELECT']}),catalogColumn({table:'School',privileges:['SELECT']}));
  assert.equal(evaluate(reseal(f)).status,'PASS');
});
test('catalog ACL records require their object and owner identities',()=>{
  for(const section of ['grants','defaults']){
    const f=fixture();f.s[section].push({schema:'public',kind:'r',grantee:'safe_reader',privilege:'SELECT',grantable:false});
    assert.deepEqual(evaluate(reseal(f)).gates,[{name:'metadata_shape',status:'BLOCKED'}]);
  }
});
