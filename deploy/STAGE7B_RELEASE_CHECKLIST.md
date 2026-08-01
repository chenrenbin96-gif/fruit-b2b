# Stage 7-B production release checklist

## Required gates

- Build immutable API and Admin images from the same Git commit.
- Run migrations once and verify `migrations` contains
  `CreateProductionOptimization1785542400000`.
- Run `npm run test:acceptance --workspace @fruit-b2b/api`.
- Run `npm run test:production-readiness --workspace @fruit-b2b/api`.
- Confirm the consistency audit reports zero violations.
- Verify `/api/v1/health/live` and `/api/v1/health/ready`.

## Configuration and secrets

- Load production values from a secret manager; never commit `.env.production`.
- Use different random values (at least 64 bytes) for access and refresh JWT.
- Restrict CORS to the real Admin HTTPS origin.
- Configure the approved SMS template and object-storage least-privilege keys.
- Rotate bootstrap credentials after the first administrator login.

## Data and observability

- Start the `backup` profile and verify a restore in an isolated database.
- Monitor MySQL `/var/lib/mysql/mysql-slow.log`; investigate queries over the
  configured `MYSQL_SLOW_QUERY_SECONDS`.
- Collect API JSON logs by request ID and alert on readiness failures and 5xx.
- Alert when backup verification fails, disk exceeds 80%, or Redis persistence
  is unhealthy.

## HTTPS and WeChat

- Issue and auto-renew the certificate mounted at `/etc/letsencrypt`.
- Verify HTTP redirects to HTTPS and TLS 1.2/1.3 only.
- Add the production API and upload domains to the Mini Program console.
- Build the Mini Program with its production environment file and perform a
  real-device smoke test before submission.

## Release and rollback

- Back up the database immediately before migration.
- Keep the previous API/Admin image tags available.
- Application rollback uses the previous image tag. Database rollback requires
  an explicit maintenance window and a verified backup because production data
  may already depend on the new indexes/permissions.
