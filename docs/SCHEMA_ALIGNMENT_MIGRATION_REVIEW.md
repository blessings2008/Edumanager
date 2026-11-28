# Read-only review: identity schema-alignment migration

**Review date:** 2026-11-28  
**Scope:** repository SQL, shared identity contracts and existing static schema tests only  
**Decision:** review completed; migration application is **not approved by this document**.

## Executive summary

The checked-in follow-up migration, `20261112153700_align_identity_schema_contracts.sql`, maps the initial tenancy schema's legacy school and membership values to the current shared TypeScript identity vocabulary. It adds the nullable email-verification timestamp and a required school-domain kind. The data changes are narrowly scoped and do not delete rows.

The migration is still unapplied according to the implementation status. This review did not connect to Supabase or any other database, inspect live rows, run the migration, or verify the migration runner's transaction behavior. The repository's last recorded database check reported zero rows in the five foundation tables; that historical observation is not a current preflight.

## Sources inspected

- `supabase/migrations/20261111174756_initial_school_tenancy_foundation.sql`
- `supabase/migrations/20261112153700_align_identity_schema_contracts.sql`
- `packages/contracts/src/identity.ts`
- `apps/api/test/identity-schema.test.ts`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/ROADMAP.md`

## Contract alignment

| Area | Initial schema | Follow-up migration | Shared contract |
|---|---|---|---|
| User status | `active`, `disabled`, `pending` | Unchanged | `USER_STATUSES` |
| User email verification | No column | Adds nullable `email_verified_at` | `emailVerifiedAt: string \| null` |
| School status | `onboarding`, `active`, `suspended`, `archived` | Maps `onboarding` to `provisioning`; changes default; replaces check | `SCHOOL_STATUSES` |
| Membership role | Includes legacy `staff` | Maps `staff` to `school_staff`; replaces check | `SCHOOL_ROLES` |
| Membership status | `invited`, `active`, `suspended`, `revoked` | Replaces check with the same allowed values | `MEMBERSHIP_STATUSES` |
| Domain verification | `pending`, `verified`, `revoked` | Unchanged | `SCHOOL_DOMAIN_VERIFICATION_STATUSES` |
| Domain kind | No column | Adds required `kind`, constrained to `platform_subdomain` or `custom` | `SCHOOL_DOMAIN_KINDS` |

The two value conversions are lossless renames within the existing constrained vocabularies. No primary keys, foreign keys or existing records are deleted by the checked-in statements. The new email-verification column is nullable, so existing users do not require fabricated verification data.

## Preconditions and risks

1. **Domain rows must still be absent.** The migration checks `public.school_domains` before changing the schema and raises an exception if any row exists. This correctly avoids guessing whether a hostname is a platform subdomain or a custom domain. The last repository-recorded empty-table check is historical; recheck the live row count immediately before any approved application.
2. **The migration is a one-time migration, not fully rerunnable SQL.** The email-verification column uses `IF NOT EXISTS`, but the new domain-kind column and replacement constraints do not. Check migration history and actual schema state before retrying after any interrupted attempt.
3. **Atomicity must be confirmed.** The SQL file contains no explicit `BEGIN`/`COMMIT`. Verify that the selected Supabase migration runner executes this migration transactionally. If it does not, a failure after a constraint is dropped could leave a partially altered schema. Do not infer rollback guarantees from the file alone.
4. **Existing constraints are relied upon.** The initial checks constrain school status and membership role to the old vocabulary, so the two updates cover the allowed legacy values. Any out-of-band constraint removal or schema drift should be detected during preflight rather than repaired implicitly by this migration.
5. **This migration does not establish tenant authorization.** It does not add RLS policies, change grants, provision a least-privilege runtime role, or prove cross-school access isolation. The initial migration's RLS and browser-role revocations remain a separate foundation; the `service_role` must not become the normal tenant-data runtime credential.

## Repository test coverage

`apps/api/test/identity-schema.test.ts` statically compares the initial/follow-up constraint values with the shared TypeScript constants, checks the new identity columns, and checks that the domain-row guard appears before the schema alterations.

These tests do **not** execute either migration against PostgreSQL. They do not prove clean-database application, rollback/atomicity, preservation of grants/RLS, or behavior when domain rows already exist.

## Required read-only preflight before an approved run

Run against the intended database and retain the output with the change record:

```sql
SELECT count(*) AS school_domain_rows
FROM public.school_domains;

SELECT status, count(*)
FROM public.schools
GROUP BY status
ORDER BY status;

SELECT role, count(*)
FROM public.school_memberships
GROUP BY role
ORDER BY role;

SELECT status, count(*)
FROM public.school_memberships
GROUP BY status
ORDER BY status;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'school_domains'
  AND column_name = 'kind';
```

Also verify the migration-history record and inspect the actual RLS/grant state for the five foundation tables. Do not use a hostname or a client-provided school ID as authorization.

## Acceptance gates before production application

- [ ] Founder confirms the database/provider and explicitly approves the migration.
- [ ] Current live schema and migration history match the expected initial migration.
- [ ] Current domain-row count is zero, or every existing hostname has been explicitly classified and a reviewed migration plan is supplied.
- [ ] Migration-runner transaction/rollback behavior is verified.
- [ ] A disposable PostgreSQL 17 database applies the initial migration and then this migration successfully.
- [ ] Clean-database tests verify the value conversions, defaults, new nullable/required columns and all resulting constraints.
- [ ] A separate failure-path test proves the domain-row guard leaves no partial schema changes under the verified migration runner.
- [ ] RLS enablement and grants are rechecked after the migration.
- [ ] A backup/restore point is verified before any production change.

## Conclusion

**Repository review: complete. Migration execution: pending.**

The checked-in SQL is consistent with the current shared identity value sets and has an explicit guard against inventing domain kinds. The remaining blockers are live-state preflight, clean PostgreSQL 17 execution, migration-runner atomicity verification, runtime-role/RLS design and explicit founder approval. No database action was taken during this review.
