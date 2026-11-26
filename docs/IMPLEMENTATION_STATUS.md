# Implementation status

## Current milestone: trusted tenant context and database foundation

### Application foundation already present
- pnpm workspace for the web app, API and shared contracts.
- React + TypeScript + Vite web application.
- Fastify + TypeScript API with validated configuration, explicit CORS allowlist, safe error responses and request IDs.
- API tests for health/version routes, 404 handling and configuration validation.
- Shared identity contracts for users, schools, memberships, domains and trusted tenant request context.
- Platform-subdomain resolver and hostname validation tests.
- Shared fail-closed membership validation and trusted tenant-context builder.
- Coarse role-permission matrix and resource-level student access policy building blocks.
- GitHub Actions workflow for tests, type-checking and builds.

### Verified authentication boundary seam
- The Fastify API accepts an optional, injected provider-neutral authentication adapter.
- Protected `GET /api/v1/me` accepts only a runtime-validated active global user identity from that adapter and returns `Cache-Control: no-store`.
- Tenant IDs, school roles and permissions are not accepted as authenticated-principal claims; they must be resolved separately from trusted school records.
- With no adapter configured in the server entry point, the endpoint fails closed with 401.
- API tests cover missing adapters, forged identity headers, malformed/inactive principals, discarded tenant/role claims and sanitized adapter failures. Adapter exceptions are normalized to a generic 503 response so provider-supplied status codes and internal messages cannot control the public response. Runtime principal parsing snapshots identity fields once and rejects throwing accessors, preventing mutable adapter objects from changing the user ID between validation and use.
- This is an integration seam only: no credential verifier, authentication provider, session lifecycle, account recovery or persisted identity mapping is implemented.

### Verified partial school-membership boundary
- Added a provider-neutral tenant-context resolver seam after authentication.
- Protected `GET /api/v1/schools/:schoolId/context` passes only the authenticated global user ID and the requested path school ID to the resolver; successful context responses also set `Cache-Control: no-store`.
- The API rejects resolver contexts whose user or school IDs do not exactly match the request, whose membership ID is blank, or whose role is outside the shared school-role vocabulary. It snapshots each resolver field once and rejects throwing accessors, preventing mutable resolver objects from changing tenant identity or role between validation and use. Unknown fields are discarded.
- A missing resolver returns 503; missing authentication returns 401; a mismatched or malformed context returns 403. Resolver exceptions are normalized to a generic 503 response, independent of status codes attached to persistence errors.
- Shared contracts now provide `createTenantContextResolver`, which adapts a server-only membership reader, validates the actual persisted user/school/membership IDs and statuses, and delegates the final active-state and relationship checks to `buildTenantRequestContext`. The resolver snapshots each persisted record and field exactly once, rejects throwing accessors and revoked proxies, and passes only detached values into the context builder so a changing membership role cannot be elevated between validation and use.
- A PostgreSQL membership-reader adapter now performs one parameterized join across the persisted user, school and membership tables. It rejects malformed UUID inputs and returns no snapshot for missing, duplicate or malformed query results; it deliberately returns inactive statuses for the shared policy to reject.
- Unit tests exercise the SQL parameters, school/user relationship joins, fail-closed result handling and persistence errors through an injected query executor.
- API integration coverage composes the authenticated school-context route with the shared resolver and a trusted membership-reader fixture: an active School A membership succeeds for School A and is denied for School B despite forged query/header and extra principal claims. This does not replace live database isolation tests.
- Added an unconfigured PostgreSQL transaction helper that snapshots the validated user/school/membership identifiers before awaiting pool acquisition, installs them through parameterized transaction-local settings, and runs repository work through a frozen query-only executor that does not expose pooled-connection release. The executor is active only during callback work; it closes when the callback settles, waits for all callback-started queries to settle before commit/rollback, including when the callback itself rejects, and rejects queries through retained references after closure. A conservative SQL guard rejects multiple statements, top-level transaction/session commands, non-data commands, Unicode-escaped identifiers and direct `set_config` calls before forwarding callback SQL. The guard is defense-in-depth rather than a complete SQL parser and cannot prevent indirect side effects inside arbitrary database functions. The helper alone controls commit, rollback and release. It also shallow-copies each query parameter array when the executor is called, preventing later caller changes to array slots or length from changing the dispatched parameter vector; nested parameter objects are not deep-cloned. Tests cover successful commit, context and query-parameter array snapshotting against caller mutation, restricted and expired executor capabilities, in-flight query draining, unawaited query failure, blocked transaction/session commands, multiple statements, direct tenant-setting mutation, work failure, context-installation failure, malformed context and failed rollback connection disposal.
- The server entry point does not configure the membership adapter, transaction helper or a connection pool. No live membership lookup or school-data route is connected yet. The transaction-local settings are only a context propagation primitive; they do not enforce RLS or make a privileged database role safe.

### Verified student relationship policy foundation
- Student records are modelled as school-owned records without a required login user ID.
- Student portal access is optional and requires a separate active, school-scoped account link.
- Guardian access is tied to an active guardian-to-student-record link, not a student login identity.
- Teacher access is derived from an active teacher/class/subject/academic-period assignment matched to the student's active enrolment in the same school, class and academic period.
- Unit tests cover mismatched actors, schools, student records, classes, periods and inactive/revoked relationships.
- These remain pure shared policy functions. They are not yet connected to authenticated school-data routes or database-backed repositories.

### Supabase foundation applied and verified
- Supabase project provisioned with PostgreSQL 17.
- Migration `20261111174756_initial_school_tenancy_foundation` applied.
- Created `users`, `schools`, `school_memberships`, `school_domains` and `audit_events`.
- Added school/user membership uniqueness, status and role constraints, hostname uniqueness, lookup indexes and updated-at triggers.
- Enabled RLS on all five tables.
- Revoked browser-role access and granted table access only to the Supabase `service_role`; no end-user RLS policies are installed yet.
- Confirmed all five tables exist and RLS is enabled; all five tables currently contain zero rows.
- Security advisor reports only the expected informational finding that RLS is enabled without policies. This is intentional until the auth and tenant policy model is implemented.
- Performance advisor reports unused indexes; the database is empty, so usage cannot yet be meaningfully evaluated.

### Schema/contract alignment drafted — not applied
- Follow-up migration `20261112153700_align_identity_schema_contracts` aligns school lifecycle values and membership roles with the shared TypeScript contracts.
- Adds explicit school-domain kind and the email-verification timestamp required by the identity contract.
- Shared role/status unions are now exported from one source, including the distinct `school_owner` role and revoked membership state.
- Static schema-contract tests compare the SQL constraint values with the shared TypeScript constants.
- The migration is repository-only and has **not** been applied to Supabase. It includes a guard that refuses to guess domain kinds if domain rows already exist.

### Deliberately not implemented yet
- Authentication provider, credential/session lifecycle and application-user identity mapping.
- Runtime database client, connection pool and startup wiring remain unconfigured. The provider-neutral safety contract now has a concrete PostgreSQL 17 catalog inspector that uses one parameterized query through an injected server-only executor. It reports the current role, the session login's complete `SET ROLE` closure, RLS enablement and ownership for configured ordinary/partitioned tenant tables, and whether any settable role inherits table-owner privileges. Unit tests use a fake executor; a disposable PostgreSQL 17 CI integration test now exercises the verified transaction runner against temporary runtime/owner roles and a test-owned RLS policy. No production/runtime role has been inspected, no production credentials or pool are configured, and the Supabase project's policy expressions, grants and application-schema cross-school isolation remain unverified. The membership reader and transaction helper remain unconfigured adapters; do not wire tenant-owned operations through a privileged RLS-bypass credential.
- Production tenant-aware RLS policies and cross-school integration tests against the approved application schema.
- Student, guardian, staff, class, academic or finance tables.
- Database-backed repositories and API routes.
- Production deployment configuration.

### Verified per-checkout PostgreSQL role verification primitive — not wired
- Added `createPostgresVerifiedTenantTransactionRunner`. Each tenant transaction checks out one physical pool connection, snapshots its query/release methods, executes the PostgreSQL role/RLS catalog inspection on that same connection, and only then passes the captured connection into the tenant transaction helper.
- An unsafe, malformed or uninspectable connection is released with an error before `BEGIN`; the repository callback is not invoked. The configured tenant-table list and pool checkout method are snapshotted when the runner is created.
- This verifies every connection when it is checked out for tenant work; it does not proactively enumerate idle pool connections. It adds one catalog inspection query per tenant transaction. The server entry point still has no configured runtime pool or credentials, and RLS policy correctness and live cross-school isolation remain pending.


### Verified disposable PostgreSQL 17 integration coverage for verified tenant transactions
- Added a test-only integration suite for the per-checkout transaction runner using a temporary PostgreSQL 17 CI service and a development-only node-postgres dependency.
- The suite creates disposable runtime/owner roles, a temporary school-record table and an explicit test RLS policy. It exercises two concurrent physical pool connections and checks that each school sees only its own rows, cross-school updates/deletes affect no rows, cross-school inserts are rejected, and a runtime role that can assume the table owner is rejected before repository work.
- CI supplies `EDUMANAGER_POSTGRES_TEST_URL` from the disposable service. The test does not connect to the Supabase project or use production credentials/data.
- The GitHub Actions PR workflow passed on 2026-11-26: 110 tests passed, zero failed and zero skipped; the PostgreSQL 17 integration test executed rather than being skipped.
- This covers the runner against a test-owned schema and policy only. It does not configure the API server, verify the project's production RLS policies/grants, or complete runtime tenant isolation.

### Remaining integration blockers
The live database still has only the initial migration applied, so its persisted role/status vocabulary does not yet fully match the updated shared contracts. The follow-up migration must be reviewed and explicitly applied before the membership reader can safely be wired. The membership reader, transaction helper and PostgreSQL 17 role inspector have no configured production runtime query executor, pool or credential; the inspector has not examined a production role and is not wired into startup. The disposable PostgreSQL 17 CI suite does inspect temporary roles and verifies a test-owned RLS policy across two schools, but it does not validate the Supabase project's policy expressions, grants or application-schema isolation. Authentication architecture, secure identity mapping, tenant-scoped production database access, production RLS policies and cross-tenant integration against the approved application schema remain pending.

The database foundation is not a production-ready application data layer. Do not add real student or school data or enable browser access until authentication, a non-bypass least-privilege runtime role, tenant-scoped runtime access, resource relationship checks, production RLS policies and cross-tenant integration tests against the application schema are implemented and verified.

## Local development

Requirements: Node.js 22.12+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Run both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

Run checks with pnpm test, pnpm typecheck and pnpm build. GitHub Actions must pass before a branch is considered validated and merged.


### Verified frontend expansion — academic workspace preview
- The web preview now separates academic overview, classes/streams, subject catalogue and assessment schedule into navigable sections, with a school-year timeline, class summaries, level filtering and responsive layouts.
- All displayed academic records are illustrative client-side sample data. No academic API, persistence, grading, mark entry, learner result publication, or authorization capability is implied by this UI work; those items remain pending until the tenant-safe identity and persistence dependencies are complete.


### Verified frontend expansion — student directory preview
- The student directory preview now supports combined name/ID/class/guardian search with class and enrolment-status filters, a clear-filters action, and a read-only sample student profile dialog.
- These interactions operate only on illustrative in-browser sample records. Student editing, guardian verification, enrolment history, persistence, and school-scoped authorization remain unimplemented.


### Verified frontend expansion — staff directory preview
- The staff directory preview now includes combined name/employee ID/role/department/subject search, department and status filters, clear filters, and a read-only sample staff profile dialog.
- Staff invitation, identity verification, employment history, payroll, contacts, role grants, persistence and school-scoped authorization remain unimplemented; all displayed staff profiles are illustrative sample data.


### Verified frontend expansion — attendance register preview
- The attendance register now includes a date and session selector, combined student/ID/class search, class and status filters, clear filters, explicit per-student status selection, and a mark-all-present preview action.
- Counts and register summaries recalculate from the in-memory sample records. Date/session selections do not load historical registers; all changes remain temporary and are not persisted.
- Historical attendance, class rosters, staff verification, audit trails, and school-scoped storage remain pending.


### Verified frontend expansion — finance preview
- Expanded the finance screen into Overview, Fee structures, Student statements and Payments sections, with period selection, sample collection totals, fee breakdowns, searchable/filterable statements and recent transaction history.
- Statement balances are calculated from the in-memory illustrative billed and paid amounts. The sample data is not connected to a finance ledger; payment recording, fee schedule editing, receipts, exports and persistence remain disabled.
- Live finance work remains gated on authenticated school-scoped access, auditable ledger operations, reconciliation, adjustment/reversal controls and cross-school isolation verification.


### Frontend expansion — timetable workspace preview
- Added a dedicated Timetable navigation section with weekday switching, class and teacher filters, lesson search, and read-only lesson detail previews.
- Added an in-browser lesson creation flow with basic overlapping class, teacher and room checks. These checks are convenience validation only and are not authoritative scheduling controls.
- All timetable entries and newly added lessons are illustrative browser-session data. Publishing, substitutions, teacher availability, room capacity, persistence, school-scoped authorization and server-side conflict checks remain unimplemented.
- Pull request #43 is awaiting CI validation; this feature is not merged or deployed.


### Frontend expansion — notices and announcements preview
- Added a school communication workspace with searchable notices, category/status filters, pinned updates, detail views, and a compose/publish preview.
- Added in-browser archive and pin interactions. All changes are temporary preview state; no email, SMS, WhatsApp or in-app delivery is configured.
- Recipient targeting, consent, moderation, read receipts, delivery tracking, persistence and school-scoped authorization remain pending.
