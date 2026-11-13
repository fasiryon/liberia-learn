# Container build secrets

DATABASE_URL, DIRECT_URL and NEXTAUTH_SECRET are runtime inputs. Supply them
through the running container's environment/secret configuration. Do not pass
them as Docker build arguments. The worker stages retain their existing build
contract; the repository's worker deployment does not supply these build args.

The web builder optionally accepts SENTRY_AUTH_TOKEN through BuildKit:

```sh
docker build --secret id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN --target runner .
```

This reads an already configured caller environment variable; the command
contains no token value. Omitting it builds without an upload token. Public
NEXTAUTH_URL/SENTRY_ORG/SENTRY_PROJECT metadata remains available as build args.
BuildKit is required for the secret mount. This document authorizes no build,
publication or deployment against a live environment.

Private workspace directories and nested env files are excluded from build
context. Keep those exclusions when adding tooling directories. Do not copy
credentials into a build layer and then delete them in a later instruction.

The local security probe uses a cached image, synthetic canary and isolated
PostgreSQL database. It verifies the exact mount/export instruction prefix and
ignore file, image metadata/history/filesystem, and runtime DB injection. It
does not certify the full application image or execute a production build.

Reference: [Docker build secrets](https://docs.docker.com/build/building/secrets/).
