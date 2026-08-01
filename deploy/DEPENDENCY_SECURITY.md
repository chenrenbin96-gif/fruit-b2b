# Dependency security review

Run:

```bash
npm audit --omit=dev --workspace @fruit-b2b/api
```

As of 2026-07-25, npm reports a high-severity `brace-expansion` denial of
service advisory through `typeorm -> glob -> minimatch`. The installed TypeORM
version is current in the lockfile and npm reports no available compatible fix.
The affected glob path is used by TypeORM command-line file discovery, while
the production API does not accept user-controlled glob patterns.

Temporary control:

- the production image excludes development dependencies;
- migration/CLI commands run in a controlled deployment job, not via HTTP;
- API input is validated and no endpoint passes client text to glob;
- re-run the audit on every lockfile update and upgrade TypeORM immediately
  when a patched compatible release is available.

This is a documented temporary risk acceptance, not a clean security scan.
