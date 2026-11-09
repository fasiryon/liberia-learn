import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {isPreviewProjectRef,pinnedPreviewProjectRef} from './preview-target.mjs';
const POOLER_HOST='aws-0-us-east-2.pooler.supabase.com';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const metadataFingerprint=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const DATABASE_POLICY_VERSION='preview-db-policy/2';
export const REQUIRED_IMMUTABILITY_TRIGGERS=Object.freeze([
  {table:'AuditLog',name:'audit_log_no_update'},{table:'AuditLog',name:'audit_log_no_delete'},
  ...['CurriculumContentRevision','CurriculumGovernanceEvent','CurriculumEvidence'].flatMap((table,i)=>{
    const stem=['curriculum_content_revision','curriculum_governance_event','curriculum_evidence'][i];
    return [{table,name:`${stem}_no_update_or_delete`},{table,name:`${stem}_no_truncate`}];
  }),
  ...['no_delete','no_truncate','identity_no_update','current_revision_guard'].map(suffix=>({table:'CurriculumProvenance',name:`curriculum_provenance_${suffix}`})),
]);
const sections=['identity','roles','schemas','relations','policies','triggers','grants','defaults','functions','columns','remote','migrations'];
const text=value=>typeof value==='string'&&value.length>0;
const strings=value=>Array.isArray(value)&&value.every(text);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const unique=(rows,fields)=>new Set(rows.map(row=>JSON.stringify(fields.map(field=>row[field])))).size===rows.length;
const qualified=(row,name)=>text(row.schema)&&text(row[name]);
const acl=rows=>Array.isArray(rows)&&rows.every(row=>text(row.grantee)&&text(row.privilege)&&typeof row.grantable==='boolean');
/** Validate catalog identities before any fingerprint or privilege can bless them. */
function validCatalogIdentities(s){
  return s.roles.every(r=>text(r.name))&&unique(s.roles,['name'])&&
    s.schemas.every(r=>text(r.name)&&text(r.owner))&&unique(s.schemas,['name'])&&
    s.relations.every(r=>qualified(r,'name')&&text(r.owner)&&['r','p','v','m','f','S'].includes(r.kind)&&strings(r.privileges))&&unique(s.relations,['schema','name'])&&
    s.policies.every(r=>qualified(r,'table')&&text(r.name)&&strings(r.roles)&&r.roles.length>0&&['ALL','SELECT','INSERT','UPDATE','DELETE'].includes(r.command))&&unique(s.policies,['schema','table','name'])&&
    s.triggers.every(r=>qualified(r,'table')&&text(r.name)&&['O','A','D','R'].includes(r.enabled))&&unique(s.triggers,['schema','table','name'])&&
    s.grants.every(r=>qualified(r,'object')&&['schema','r','p','v','m','f','S'].includes(r.kind)&&acl([r]))&&
    s.defaults.every(r=>qualified(r,'owner')&&['r','S','f','T','n'].includes(r.kind)&&acl([r]))&&
    s.functions.every(r=>qualified(r,'name')&&text(r.owner)&&typeof r.signature==='string'&&hash(r.definitionHash)&&['f','p','w','a'].includes(r.kind)&&typeof r.ownerReachable==='boolean'&&typeof r.grantable==='boolean'&&typeof r.appExecute==='boolean'&&typeof r.securityDefiner==='boolean'&&acl(r.acl))&&unique(s.functions,['schema','name','signature'])&&
    s.columns.every(r=>qualified(r,'table')&&text(r.column)&&text(r.type)&&typeof r.nullable==='boolean'&&strings(r.privileges)&&strings(r.grantOptions)&&acl(r.acl))&&unique(s.columns,['schema','table','column']);
}
export function repositoryDatabaseContract(root=process.cwd()){
  return {schemaSha256:createHash('sha256').update(readFileSync(resolve(root,'prisma/schema.prisma'))).digest('hex'),repositoryMigrations:readdirSync(resolve(root,'prisma/migrations')).sort().flatMap(name=>{
    const file=resolve(root,'prisma/migrations',name,'migration.sql');
    return existsSync(file)?[{name,checksum:createHash('sha256').update(readFileSync(file)).digest('hex')}]:[];
  })};
}
/**
 * Catalog values stay in memory. Only fixed gate names/status leave this evaluator.
 * env: the operator EXECUTION environment. The runtime pin (PREVIEW_PINNED_PROJECT_REF) is re-validated here, fail closed,
 * and both the reviewed policy and the target context must name exactly that project (reviewer P1-a, 2026-11-09).
 */
export function evaluateDatabasePreflight(snapshot,policy,context,env={}){
  const gates=[];
  let pin=null;try{pin=pinnedPreviewProjectRef(env);}catch{pin=null;}
  const gate=(name,ok)=>gates.push({name,status:ok?'PASS':'BLOCKED'});
  try{
    if(!snapshot||!policy||!context||sections.some(key=>snapshot[key]===undefined)||Object.keys(snapshot).length!==sections.length)throw Error();
    for(const key of ['roles','schemas','relations','policies','triggers','grants','defaults','functions','columns'])if(!Array.isArray(snapshot[key]))throw Error();
    if(!validCatalogIdentities(snapshot))throw Error();
    gate('reviewed_contract',policy.version===DATABASE_POLICY_VERSION&&policy.status==='ACCEPTED'&&typeof policy.reviewId==='string'&&policy.reviewId.length>0&&pin!==null&&isPreviewProjectRef(context.projectRef)&&context.projectRef===pin&&policy.projectRef===pin);
    // The endpoint must belong to the pinned project: its direct host, or the shared pooler with a user bound to the pin.
    const endpointOwned=pin!==null&&(context.endpointHost===`db.${pin}.supabase.co`||context.endpointHost===POOLER_HOST&&context.endpointProjectRef===pin);
    gate('provider_endpoint_binding',policy.endpointHost===context.endpointHost&&typeof context.endpointHost==='string'&&!context.endpointHost.includes('bnphuinpvgpmebcsvmsp')&&endpointOwned);
    const i=snapshot.identity;
    gate('database_identity',i.database==='postgres'&&i.username==='preview_app'&&i.sessionUser==='preview_app'&&i.readOnly===true&&i.tls===true&&i.inRecovery===false&&i.version>=160000&&i.vector===true&&i.replicationRole==='origin'&&i.canSetReplicationRole===false&&typeof i.serverAddress==='string'&&Number.isInteger(i.serverPort));
    const privilegedRoles=new Set(['preview_owner','preview_bootstrap','pg_read_all_data','pg_write_all_data','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_database_owner','pg_create_subscription','pg_maintain']);
    // A2 permits no runtime memberships. Still evaluate every reachable principal's
    // permissions below so privilege findings are not hidden by this topology gate.
    gate('role_membership',snapshot.roles.length===1&&snapshot.roles[0].name==='preview_app'&&snapshot.roles.every(r=>!privilegedRoles.has(r.name)&&[r.superuser,r.createdb,r.createrole,r.bypassrls,r.replication,r.adminOption].every(v=>v===false)));
    const schemaNames=new Set(snapshot.schemas.map(s=>s.name));
    const relationKey=r=>JSON.stringify([r.schema,r.table??r.name]);
    const relations=new Map(snapshot.relations.map(r=>[relationKey(r),r]));
    const inSchema=o=>typeof o.schema==='string'&&schemaNames.has(o.schema);
    gate('inventory_scope',schemaNames.size===snapshot.schemas.length&&snapshot.schemas.every(s=>typeof s.name==='string'&&!s.name.startsWith('pg_')&&s.name!=='information_schema')&&relations.size===snapshot.relations.length&&snapshot.relations.every(inSchema)&&[...snapshot.policies,...snapshot.triggers,...snapshot.columns].every(o=>inSchema(o)&&relations.has(relationKey(o)))&&snapshot.functions.every(inSchema)&&snapshot.grants.every(inSchema));
    gate('schema_modification',i.databaseCreate===false&&i.databaseTemp===false&&snapshot.schemas.some(s=>s.name==='public')&&snapshot.schemas.every(s=>s.canCreate===false&&s.memberCreate===false&&s.typeOwnerReachable===false&&s.publicCreate===false&&s.ownerReachable===false));
    gate('ownership',snapshot.relations.length>0&&snapshot.relations.every(r=>r.ownerReachable===false&&r.owner!=='preview_app'));
    const forbidden=new Set(['PUBLIC','anon','authenticated','service_role']);
    const reachable=new Set(snapshot.roles.map(r=>r.name));
    const safeAcl=g=>g&&typeof g.grantee==='string'&&!forbidden.has(g.grantee)&&typeof g.grantable==='boolean'&&!(reachable.has(g.grantee)&&g.grantable);
    gate('external_grants',[...snapshot.grants,...snapshot.defaults].every(safeAcl)&&snapshot.defaults.every(g=>!reachable.has(g.grantee))&&[...snapshot.columns,...snapshot.functions].every(o=>Array.isArray(o.acl)&&o.acl.every(safeAcl))&&snapshot.columns.every(o=>Array.isArray(o.grantOptions)&&o.grantOptions.length===0));
    const runtimeReads=new Set(['School','User','Student','Class','Enrollment','TeacherProfile','Timetable','Assignment','Attendance','DataPolicyAcceptance','PolicyConfig','AuditLog','_prisma_migrations']);
    const allowed=(schema,table,privilege)=>schema==='public'&&(privilege==='SELECT'&&runtimeReads.has(table)||table==='AuditLog'&&privilege==='INSERT');
    gate('application_grants',snapshot.relations.every(r=>Array.isArray(r.privileges)&&r.privileges.every(p=>['r','p'].includes(r.kind)&&allowed(r.schema,r.name,p)))&&snapshot.columns.every(g=>{
      const parent=relations.get(relationKey(g));
      return g.grantOptions.length===0&&g.privileges.every(p=>parent&&['r','p'].includes(parent.kind)&&parent.ownerReachable===false&&parent.owner!=='preview_app'&&parent.rls===true&&parent.forceRls===true&&allowed(g.schema,g.table,p));
    }));
    const tables=snapshot.relations.filter(r=>['r','p'].includes(r.kind));
    gate('rls_enforcement',tables.length>0&&tables.every(r=>r.rls===true&&r.forceRls===true));
    gate('rls_policies',tables.filter(r=>r.privileges.length>0||snapshot.columns.some(c=>relationKey(c)===relationKey(r)&&c.privileges?.length>0)).every(r=>snapshot.policies.some(p=>p.schema===r.schema&&p.table===r.name&&Array.isArray(p.roles)&&p.roles.includes('preview_app'))));
    gate('immutability_triggers',REQUIRED_IMMUTABILITY_TRIGGERS.every(required=>snapshot.triggers.some(t=>t.schema==='public'&&t.table===required.table&&t.name===required.name&&['O','A'].includes(t.enabled)&&/^[a-f0-9]{64}$/.test(t.functionHash)&&/^[a-f0-9]{64}$/.test(t.definitionHash)&&t.functionOwnerReachable===false)));
    gate('security_definer',snapshot.functions.every(f=>f.ownerReachable===false&&f.grantable===false&&typeof f.appExecute==='boolean'&&typeof f.securityDefiner==='boolean'&&!(f.appExecute&&(f.securityDefiner||!['f','p','w'].includes(f.kind)))));
    const remote=snapshot.remote;
    gate('cross_database',remote.foreignServers===0&&remote.userMappings===0&&remote.subscriptions===0&&Array.isArray(remote.otherDatabases)&&remote.otherDatabases.length===0&&Array.isArray(remote.extensions)&&!remote.extensions.some(e=>/dblink|postgres_fdw/i.test(e)));
    const m=snapshot.migrations;
    const schemaMatches=/^[a-f0-9]{64}$/.test(policy.schemaSha256)&&policy.schemaSha256===context.schemaSha256;
    const ledgerMatches=m.ledgerExists===true&&Array.isArray(m.rows)&&m.rows.length===context.repositoryMigrations.length&&context.repositoryMigrations.length>0&&context.repositoryMigrations.every(expected=>m.rows.filter(row=>row.name===expected.name&&row.checksum===expected.checksum&&row.finished===true&&row.rolledBack===false).length===1);
    gate('migration_state',schemaMatches&&(policy.migrationMode==='schema-push-reviewed'?m.ledgerExists===false&&Array.isArray(m.rows)&&m.rows.length===0:policy.migrationMode==='migration-ledger'&&ledgerMatches));
    for(const key of sections)gate(`reviewed_${key}`,typeof policy.fingerprints?.[key]==='string'&&/^[a-f0-9]{64}$/.test(policy.fingerprints[key])&&policy.fingerprints[key]===metadataFingerprint(snapshot[key]));
  }catch{gate('metadata_shape',false);}
  return {status:gates.length>0&&gates.every(g=>g.status==='PASS')?'PASS':'BLOCKED',gates};
}
export async function collectDatabaseMetadata(db){
  try{
    return await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      // Resolve catalog helpers only through pg_catalog, not operator search_path.
      await tx.$executeRawUnsafe('SET LOCAL search_path = pg_catalog');
      const sql=readFileSync(new URL('./database-preflight.sql',import.meta.url),'utf8');
      const metadata={};
      for(const part of sql.split('-- section: ').slice(1)){
        const index=part.indexOf('\n'),key=part.slice(0,index).trim();
        if(!sections.includes(key)||metadata[key]!==undefined)throw Error();
        const rows=await tx.$queryRawUnsafe(part.slice(index+1));
        if(rows.length!==1||rows[0].value===undefined)throw Error();
        metadata[key]=rows[0].value;
      }
      if(metadata.migrations?.ledgerExists)metadata.migrations.rows=await tx.$queryRawUnsafe('SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS "rolledBack" FROM public._prisma_migrations ORDER BY migration_name, checksum');
      return metadata;
    },{isolationLevel:'RepeatableRead',timeout:30000});
  }catch{throw Error('preview_preflight_catalog_unavailable');}
}
