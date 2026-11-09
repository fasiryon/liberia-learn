-- SELECT-only catalog inventory. Never select role passwords, row data, connection strings,
-- subscription connection info, foreign-server options or raw policy/function bodies.
-- section: identity
SELECT jsonb_build_object('database',current_database(),'username',current_user,'sessionUser',session_user,
 'version',current_setting('server_version_num')::int,'serverAddress',inet_server_addr()::text,'serverPort',inet_server_port(),
 'readOnly',current_setting('transaction_read_only')='on','tls',COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false),
 'inRecovery',pg_is_in_recovery(),'databaseCreate',EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_database_privilege(r.oid,current_database(),'CREATE')),'databaseTemp',EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_database_privilege(r.oid,current_database(),'TEMP')),
 'replicationRole',current_setting('session_replication_role'),'canSetReplicationRole',EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_parameter_privilege(r.oid,'session_replication_role','SET')),
 'vector',to_regtype('public.vector') IS NOT NULL) AS value;
-- section: roles
SELECT COALESCE(jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,
 'bypassrls',r.rolbypassrls,'replication',r.rolreplication,'inherit',r.rolinherit,'login',r.rolcanlogin,
 'adminOption',EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid=r.oid AND pg_has_role(current_user,m.member,'MEMBER') AND m.admin_option)) ORDER BY r.rolname),'[]') AS value
FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER');
-- section: schemas
SELECT COALESCE(jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),
 'ownerReachable',pg_has_role(current_user,n.nspowner,'MEMBER'),'canCreate',has_schema_privilege(n.oid,'CREATE'),
 'publicCreate',EXISTS(SELECT 1 FROM aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee=0 AND a.privilege_type='CREATE'),
 'memberCreate',EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_schema_privilege(r.oid,n.oid,'CREATE')),
 'typeOwnerReachable',EXISTS(SELECT 1 FROM pg_type t WHERE t.typnamespace=n.oid AND pg_has_role(current_user,t.typowner,'MEMBER'))) ORDER BY n.nspname),'[]') AS value
FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema';
-- section: relations
SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
 'ownerReachable',pg_has_role(current_user,c.relowner,'MEMBER'),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
 'privileges',CASE WHEN c.relkind='S' THEN (SELECT COALESCE(jsonb_agg(p ORDER BY p),'[]') FROM unnest(ARRAY['SELECT','UPDATE','USAGE']) p WHERE EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_sequence_privilege(r.oid,c.oid,p)))
 ELSE (SELECT COALESCE(jsonb_agg(p ORDER BY p),'[]') FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] || CASE WHEN current_setting('server_version_num')::int>=170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) p WHERE EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_table_privilege(r.oid,c.oid,p))) END) ORDER BY n.nspname,c.relname),'[]') AS value
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S');
-- section: policies
SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'command',cmd,
 'usingHash',encode(sha256(convert_to(qual,'UTF8')),'hex'),'checkHash',encode(sha256(convert_to(with_check,'UTF8')),'hex')) ORDER BY schemaname,tablename,policyname),'[]') AS value FROM pg_policies WHERE schemaname !~ '^pg_' AND schemaname<>'information_schema';
-- section: triggers
SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
 'definitionHash',encode(sha256(convert_to(pg_get_triggerdef(t.oid,true),'UTF8')),'hex'),'functionHash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 'functionOwnerReachable',pg_has_role(current_user,p.proowner,'MEMBER')) ORDER BY c.relname,t.tgname),'[]') AS value
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND NOT t.tgisinternal;
-- section: grants
SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.schema,g.kind,g.object,g.grantee,g.privilege),'[]') AS value FROM (
 SELECT n.nspname::text AS schema,'schema'::text AS kind,n.nspname::text AS object,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable
 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT n.nspname::text,c.relkind::text,c.relname::text,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a
 WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S')) g;
-- section: defaults
SELECT COALESCE(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',COALESCE(n.nspname,'*'),'kind',d.defaclobjtype,
 'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)
 ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype,a.grantee,a.privilege_type),'[]') AS value
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a;
-- section: functions
SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),
 'kind',p.prokind,'owner',pg_get_userbyid(p.proowner),'ownerReachable',pg_has_role(current_user,p.proowner,'MEMBER'),
 'securityDefiner',p.prosecdef,'appExecute',EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_function_privilege(r.oid,p.oid,'EXECUTE')),
 'grantable',EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION')),
 'acl',(SELECT COALESCE(jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.privilege_type),'[]') FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a),
 'definitionHash',encode(sha256(convert_to(CASE WHEN p.prokind='a' THEN (SELECT to_jsonb(a)::text FROM pg_aggregate a WHERE a.aggfnoid=p.oid) ELSE pg_get_functiondef(p.oid) END,'UTF8')),'hex')) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') AS value
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND p.prokind IN ('f','p','w','a');
-- section: columns
SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,
 'privileges',(SELECT COALESCE(jsonb_agg(priv ORDER BY priv),'[]') FROM unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) priv WHERE EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_column_privilege(r.oid,c.oid,a.attnum,priv))),
 'grantOptions',(SELECT COALESCE(jsonb_agg(priv ORDER BY priv),'[]') FROM unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) priv WHERE EXISTS(SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND has_column_privilege(r.oid,c.oid,a.attnum,priv || ' WITH GRANT OPTION'))),
 'acl',(SELECT COALESCE(jsonb_agg(jsonb_build_object('grantee',CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,'privilege',acl.privilege_type,'grantable',acl.is_grantable) ORDER BY acl.grantee,acl.privilege_type),'[]') FROM aclexplode(a.attacl) acl))
 ORDER BY n.nspname,c.relname,a.attnum),'[]') AS value
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped;
-- section: remote
SELECT jsonb_build_object('foreignServers',(SELECT count(*) FROM pg_foreign_server),'userMappings',(SELECT count(*) FROM pg_user_mappings),
 'subscriptions',(SELECT count(subdbid) FROM pg_subscription),'otherDatabases',(SELECT COALESCE(jsonb_agg(datname ORDER BY datname),'[]') FROM pg_database WHERE NOT datistemplate AND datname<>current_database()),
 'extensions',(SELECT COALESCE(jsonb_agg(extname ORDER BY extname),'[]') FROM pg_extension)) AS value;
-- section: migrations
SELECT jsonb_build_object('ledgerExists',to_regclass('public._prisma_migrations') IS NOT NULL,'rows','[]'::jsonb) AS value;
