#!/bin/sh
set -eu

url_variable="$1"
operation="$2"
database_url="$(printenv "$url_variable")"

if [ -z "$database_url" ]; then
  echo "database URL variable is empty" >&2
  exit 2
fi

# Prisma accepts client-only URI parameters that libpq tools reject. Remove
# those parameters inside the container without ever printing the URL.
database_url="$(printf '%s' "$database_url" | sed -E \
  -e 's/([?&])(pgbouncer|connection_limit|pool_timeout|schema)=[^&]*&?/\1/g' \
  -e 's/([?&])(pgbouncer|connection_limit|pool_timeout|schema)=[^&]*&?/\1/g' \
  -e 's/\?&/?/g' \
  -e 's/&&+/\&/g' \
  -e 's/[?&]$//')"

case "$operation" in
  server-version)
    exec psql "$database_url" -X -v ON_ERROR_STOP=1 -At -c "SHOW server_version"
    ;;
  dump)
    exec pg_dump "$database_url" \
      --schema-only \
      --schema=public \
      --no-owner \
      --no-privileges \
      --format=plain \
      --file=/capture/production-public-schema.raw.sql
    ;;
  catalog)
    exec psql "$database_url" \
      -X \
      -v ON_ERROR_STOP=1 \
      -f /workspace/scripts/pre-p2a-canonical-catalog.sql \
      -o /capture/production-public-catalog.raw.json
    ;;
  *)
    echo "unsupported capture operation" >&2
    exit 2
    ;;
esac
