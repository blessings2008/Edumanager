# EduManager database foundation

## Supabase project

- Provider: Supabase
- Database: PostgreSQL 17
- Project reference: `rtcpeatxwuisefdymocp`
- Region: `eu-west-1`
- Project status at verification: `ACTIVE_HEALTHY`

The project URL is stored in `.env.example`. Database passwords and privileged API keys are not stored in this repository.

## Initial schema

Migration: `20261111174756_initial_school_tenancy_foundation.sql`

| Table | Purpose |
|---|---|
| `users` | Global application user profile; authentication-provider mapping remains pending |
| `schools` | School tenant and lifecycle state |
| `school_memberships` | User membership and school-scoped role/status |
| `school_domains` | Unique school hostnames and verification lifecycle |
| `audit_events` | Initial audit-event storage structure |

The initial migration adds constraints for role/status values, unique school slugs, one membership per user per school, unique hostnames and one primary domain per school. It also adds common lookup indexes and update timestamps for mutable records.

## Pending schema alignment migration

File: `20261112153700_align_identity_schema_contracts.sql`

This follow-up migration is present in the feature branch but has **not** been applied to the Supabase project. It:

- Renames the persisted school lifecycle value `onboarding` to `provisioning`.
- Renames the membership role `staff` to `school_staff`, while preserving the distinct `school_owner` role.
- Reasserts the membership status values, including `revoked`.
- Adds the explicit `platform_subdomain` / `custom` domain kind.
- Adds `users.email_verified_at`.

The migration deliberately aborts if `school_domains` already contains rows, because the old schema has no reliable way to infer whether an existing hostname is a platform subdomain or custom domain. Existing rows must be classified explicitly rather than guessed.

The API test suite includes static schema-contract checks that compare migration constraint values with the shared TypeScript constants. These checks catch vocabulary drift but are not a substitute for applying the migration to a clean PostgreSQL database and running database integration tests.

## Access boundary

RLS is enabled on all five initial tables. The initial migration revokes table privileges from `PUBLIC`, `anon` and `authenticated`, and grants table access to Supabase `service_role` only. No user-facing RLS policies are installed yet.

This is a deliberate locked state, not a completed authorization implementation. Do not add real student or school data until all of the following exist:

1. A chosen authentication architecture and a secure mapping from authenticated identities to `public.users`.
2. A runtime database access strategy that preserves the caller's identity and tenant context.
3. RLS policies for school membership and tenant-owned records.
4. API-level authorization on every read and write.
5. Tests proving School A cannot read, create, update, delete or link records belonging to School B.
6. A restricted runtime credential. Do not use a service-role key in browser code or treat it as a user's authorization.

Migrations may use privileged database credentials in a controlled deployment environment. Application runtime credentials must be separate from migration credentials.

## Provider-neutral runtime-role safety contract

The API now defines an injected runtime-role inspection contract and a fail-closed validator. A concrete database adapter must report:

- The current runtime role and whether it is a superuser or bypasses row-level security.
- Every role the connection can assume, including the current role, with the same privilege flags.
- For every required tenant table, whether row-level security is enabled and which role owns the table.

The validator rejects privileged current roles, assumable superuser/BYPASSRLS roles, missing or duplicate table metadata, tables without RLS, and runtime connections that own or can assume a tenant-table owner. Inspection errors are normalized to a safe failure code.

The provider-neutral validator is now backed by a concrete PostgreSQL 17 catalog inspector. It uses one parameterized query through an injected server-only executor to report the effective `current_user`, every role the login identity (`session_user`) can `SET ROLE` to, and RLS/owner metadata for configured ordinary or partitioned tables. For each possible `SET ROLE` target it also checks whether table-owner privileges are immediately inherited, so a role cannot evade the ownership check merely because the owner role itself is not settable. PostgreSQL's `pg_has_role(..., 'SET')` and `pg_has_role(..., 'USAGE')` checks are used for those separate capabilities. Required table identifiers are restricted to simple lowercase schema-qualified names and passed as query parameters.

The inspector has unit tests with an injected fake executor and a PostgreSQL 17 integration test that runs in GitHub Actions against a disposable service database. The integration test creates temporary roles and tenant tables, then exercises the actual catalog query for a safe runtime role, a changed `current_user`, direct and transitive `SET ROLE` access to a table owner, inherited owner privileges without `SET ROLE`, an assumable `BYPASSRLS` role, disabled RLS, and a missing required table. It does not create a production pool, read credentials, or provision production roles; no live runtime role has been inspected. It reports catalog role/RLS/ownership capabilities, not policy expressions, effective table grants, function side effects, or actual two-school isolation.

The Fastify application now requires one injected server-only tenant-persistence adapter containing the membership resolver, runtime-role inspection method and explicit required-table list. Adapter implementations must derive both operations from the same runtime executor/pool; the app snapshots both method references and the table list and runs the fail-closed validator during Fastify readiness, before the app accepts requests. This prevents independent resolver/inspector wiring at the API dependency boundary, although the app cannot independently prove that adapter internals share one underlying executor. Missing adapter configuration prevents app construction; an unsafe or incomplete inspection prevents readiness. The current server entry point still configures neither a membership resolver nor a runtime pool/inspector, so this is an enforced integration gate rather than a live startup verification. RLS policy correctness, effective grants and real cross-school behavior remain pending.

An optional `createPostgresTenantPersistenceAdapter` factory now composes the PostgreSQL membership reader and role inspector over one frozen query facade. It snapshots the supplied executor's `query` method once, preserves that method's original receiver, and passes the same facade to both adapters; the required-table list is also snapshotted. The canonical provider-neutral tenant-context resolver factory is injected by the trusted composition root, avoiding a cross-workspace source import in the API runtime compilation. An API integration test exercises startup inspection and membership resolution through the same executor. This proves shared executor-object composition, not that a pool's physical connections all have identical credentials or session initialization. A pool supplied to this factory must be configured consistently for every connection, and the readiness inspection currently observes the connection used by that one query. The factory remains optional and is not wired into `server.ts`.

## Transaction-scoped tenant context primitive

The API contains an unconfigured `withTenantTransaction` PostgreSQL helper. It:

1. Reads and validates the user, school and membership identifiers into a detached snapshot before awaiting pool acquisition, so later mutation of the caller-owned context cannot change the identity installed in the transaction.
2. Checks out one connection from an injected pool.
3. Starts a transaction.
4. Installs the validated identifiers with parameterized `set_config(..., true)` calls.
5. Runs supplied repository work through a frozen query-only executor; the callback cannot access the pool connection's `release` control. Before forwarding SQL, a conservative lexical guard permits only one `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `MERGE` statement (including supported `WITH` queries ending in one of those commands), rejects top-level transaction/session commands, Unicode-escaped identifiers (which the lexer deliberately does not decode), and direct `set_config` calls that could overwrite the tenant settings. The executor shallow-copies the parameter array at call time before asynchronous validation and dispatch, so later changes to array slots or length cannot change the dispatched parameter vector; nested parameter objects are not deep-cloned.
6. Limits that executor to the callback's lifetime. It closes the executor when callback work settles, waits for every query already started by the callback to settle before either COMMIT or ROLLBACK, including when the callback itself rejects, and rejects later calls made through retained executor references.
7. Commits on success, or rolls back on failure, then releases the connection.
8. Marks the connection for disposal if rollback itself fails.

The settings are transaction-local and are cleared by PostgreSQL at transaction end, preventing one request's tenant context from leaking through a reused pooled connection. The helper deliberately does not set a role or copy a role claim into the database context; policies must derive permissions from persisted school membership. The SQL guard is defense-in-depth, not a complete PostgreSQL parser: it does not prevent indirect session changes performed inside arbitrary database functions, so callbacks must remain trusted repository code and the least-privilege role/RLS requirements below remain mandatory.

**This helper is not an RLS policy and does not make a privileged connection safe.** It is not wired into the server entry point and has no configured pool or runtime credentials. Before using it for tenant-owned queries:

- Use a least-privilege runtime role that is neither superuser nor granted `BYPASSRLS`.
- Ensure the runtime role does not own tenant tables unless those tables explicitly use `FORCE ROW LEVEL SECURITY`.
- Add policies that validate the transaction-local user and school against active persisted membership; never trust a role supplied by the request.
- Keep all tenant-owned operations within the transaction callback so they use the same checked-out connection and transaction-local context.
- Add real PostgreSQL integration tests for cross-school reads, inserts, updates, deletes and relationship changes.

## Important modelling decisions

- A student is a school record, not necessarily a login account. Student profiles and login identities must remain separate.
- A guardian may be linked to multiple students. The link must be school-scoped and verified by the school.
- Teacher access must be derived from active teacher assignments, class/subject scope and the relevant academic period.
- School-owned records must carry `school_id` or be attached through a parent record with an enforceable school-scoped relationship.
- Use composite foreign keys such as `(school_id, student_id)` when modelling relationships between school-owned records.
- A hostname identifies a candidate tenant only. It is never proof of identity or authorization.

## Next database milestones

1. Review and apply the schema-alignment migration after approval, then verify it against a clean database.
2. Decide the authentication architecture and identity mapping.
3. Design and provision the least-privilege runtime role and connection strategy that preserves the caller's identity and tenant context.
4. Add academic-year, term, class, student, guardian-link, staff and teacher-assignment tables.
5. Add RLS and database-level tenant isolation tests before connecting school-data routes.
6. Add backups, restore verification, audit retention and operational monitoring before pilot use.
