\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SELECT jsonb_pretty(
  jsonb_build_object(
    'schemaVersion', 1,
    'schemas', jsonb_build_array('public'),
    'tables', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', table_class.relname,
          'kind', table_class.relkind,
          'rlsEnabled', table_class.relrowsecurity,
          'rlsForced', table_class.relforcerowsecurity,
          'columns', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'ordinal', column_state.ordinal,
                'name', column_state.name,
                'type', column_state.type,
                'notNull', column_state.not_null,
                'default', column_state.default_expression,
                'identity', column_state.identity_kind,
                'generated', column_state.generated_kind
              ) ORDER BY column_state.ordinal
            )
            FROM (
              SELECT
                row_number() OVER (ORDER BY attribute.attnum) AS ordinal,
                attribute.attname AS name,
                pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS type,
                attribute.attnotnull AS not_null,
                pg_get_expr(attribute_default.adbin, attribute_default.adrelid) AS default_expression,
                attribute.attidentity AS identity_kind,
                attribute.attgenerated AS generated_kind
              FROM pg_attribute attribute
              LEFT JOIN pg_attrdef attribute_default
                ON attribute_default.adrelid = attribute.attrelid
               AND attribute_default.adnum = attribute.attnum
              WHERE attribute.attrelid = table_class.oid
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped
            ) column_state
          ), '[]'::jsonb)
        ) ORDER BY table_class.relname
      )
      FROM pg_class table_class
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      WHERE table_namespace.nspname = 'public'
        AND table_class.relkind IN ('r', 'p')
        AND table_class.relname <> '_prisma_migrations'
    ), '[]'::jsonb),
    'enums', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', enum_type.typname,
          'labels', (
            SELECT jsonb_agg(enum_value.enumlabel ORDER BY enum_value.enumsortorder)
            FROM pg_enum enum_value
            WHERE enum_value.enumtypid = enum_type.oid
          )
        ) ORDER BY enum_type.typname
      )
      FROM pg_type enum_type
      JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
      WHERE enum_namespace.nspname = 'public'
        AND enum_type.typtype = 'e'
    ), '[]'::jsonb),
    'indexes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', indexed_table.relname,
          'name', index_class.relname,
          'accessMethod', access_method.amname,
          'unique', index_state.indisunique,
          'primary', index_state.indisprimary,
          'valid', index_state.indisvalid,
          'ready', index_state.indisready,
          'definition', pg_get_indexdef(index_state.indexrelid),
          'predicate', pg_get_expr(index_state.indpred, index_state.indrelid)
        ) ORDER BY indexed_table.relname, index_class.relname
      )
      FROM pg_index index_state
      JOIN pg_class index_class ON index_class.oid = index_state.indexrelid
      JOIN pg_class indexed_table ON indexed_table.oid = index_state.indrelid
      JOIN pg_namespace index_namespace ON index_namespace.oid = indexed_table.relnamespace
      JOIN pg_am access_method ON access_method.oid = index_class.relam
      WHERE index_namespace.nspname = 'public'
        AND indexed_table.relname <> '_prisma_migrations'
    ), '[]'::jsonb),
    'constraints', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', constrained_table.relname,
          'name', constraint_state.conname,
          'type', constraint_state.contype,
          'definition', pg_get_constraintdef(constraint_state.oid, true),
          'validated', constraint_state.convalidated,
          'deferrable', constraint_state.condeferrable,
          'deferred', constraint_state.condeferred
        ) ORDER BY constrained_table.relname, constraint_state.conname
      )
      FROM pg_constraint constraint_state
      JOIN pg_class constrained_table ON constrained_table.oid = constraint_state.conrelid
      JOIN pg_namespace constraint_namespace ON constraint_namespace.oid = constrained_table.relnamespace
      WHERE constraint_namespace.nspname = 'public'
        AND constrained_table.relname <> '_prisma_migrations'
    ), '[]'::jsonb),
    'extensions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', extension_state.extname,
          'version', extension_state.extversion,
          'schema', extension_namespace.nspname
        ) ORDER BY extension_state.extname
      )
      FROM pg_extension extension_state
      JOIN pg_namespace extension_namespace ON extension_namespace.oid = extension_state.extnamespace
      WHERE extension_state.extname = 'vector'
    ), '[]'::jsonb),
    'functions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', function_state.proname,
          'identityArguments', pg_get_function_identity_arguments(function_state.oid),
          'result', pg_get_function_result(function_state.oid),
          'language', function_language.lanname,
          'volatility', function_state.provolatile,
          'securityDefiner', function_state.prosecdef,
          'definition', pg_get_functiondef(function_state.oid)
        ) ORDER BY function_state.proname, pg_get_function_identity_arguments(function_state.oid)
      )
      FROM pg_proc function_state
      JOIN pg_namespace function_namespace ON function_namespace.oid = function_state.pronamespace
      JOIN pg_language function_language ON function_language.oid = function_state.prolang
      WHERE function_namespace.nspname = 'public'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_depend extension_dependency
          WHERE extension_dependency.classid = 'pg_proc'::regclass
            AND extension_dependency.objid = function_state.oid
            AND extension_dependency.deptype = 'e'
        )
    ), '[]'::jsonb),
    'triggers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', trigger_table.relname,
          'name', trigger_state.tgname,
          'enabled', trigger_state.tgenabled,
          'definition', pg_get_triggerdef(trigger_state.oid, true)
        ) ORDER BY trigger_table.relname, trigger_state.tgname
      )
      FROM pg_trigger trigger_state
      JOIN pg_class trigger_table ON trigger_table.oid = trigger_state.tgrelid
      JOIN pg_namespace trigger_namespace ON trigger_namespace.oid = trigger_table.relnamespace
      WHERE trigger_namespace.nspname = 'public'
        AND NOT trigger_state.tgisinternal
        AND trigger_table.relname <> '_prisma_migrations'
    ), '[]'::jsonb),
    'views', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', view_class.relname,
          'kind', view_class.relkind,
          'definition', pg_get_viewdef(view_class.oid, true)
        ) ORDER BY view_class.relname
      )
      FROM pg_class view_class
      JOIN pg_namespace view_namespace ON view_namespace.oid = view_class.relnamespace
      WHERE view_namespace.nspname = 'public'
        AND view_class.relkind IN ('v', 'm')
    ), '[]'::jsonb),
    'sequences', COALESCE((
      SELECT jsonb_agg(sequence_class.relname ORDER BY sequence_class.relname)
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      WHERE sequence_namespace.nspname = 'public'
        AND sequence_class.relkind = 'S'
    ), '[]'::jsonb),
    'policies', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', policy_state.tablename,
          'name', policy_state.policyname,
          'permissive', policy_state.permissive,
          'roles', policy_state.roles,
          'command', policy_state.cmd,
          'using', policy_state.qual,
          'check', policy_state.with_check
        ) ORDER BY policy_state.tablename, policy_state.policyname
      )
      FROM pg_policies policy_state
      WHERE policy_state.schemaname = 'public'
        AND policy_state.tablename <> '_prisma_migrations'
    ), '[]'::jsonb)
  )
);
