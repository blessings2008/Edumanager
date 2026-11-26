# EduManager — Delivery Roadmap

> **Scope update (2026-11-19):** Use [PRODUCT_AND_IMPLEMENTATION_SPECIFICATION.md](./PRODUCT_AND_IMPLEMENTATION_SPECIFICATION.md) as the current founder-approved delivery plan. This earlier roadmap records historical progress and partial foundations; its narrower phase ordering and deferred-module scope must not override the new specification.

This roadmap is dependency-aware. Dates will be added only after the scope and daily progress are verified.

## Phase 0 — Product and engineering foundation
- [x] Create repository overview.
- [x] Document product vision and MVP boundaries.
- [x] Document proposed architecture and tenant model.
- [x] Define security and privacy baseline.
- [ ] Confirm initial school workflows with at least one prospective school.
- [ ] Confirm stack and deployment constraints.
- [ ] Establish app workspace, linting, formatting, and test commands.

**Exit criteria:** the first implementation can begin without unresolved foundational decisions that would force a major rewrite.

## Phase 1 — Application foundation
- [x] Create web and API applications.
- [x] Add shared contracts and environment validation.
- [ ] Set up PostgreSQL and a repeatable migration workflow.
- [ ] Implement users, schools, memberships, and school onboarding.
- [ ] Implement authentication, sessions, and account recovery.
- [ ] Add role/permission checks and tenant-isolation tests.
- [ ] Build initial school setup wizard.
- [ ] Review and apply the schema-contract alignment migration, then verify it against a clean database before runtime integration.
- [ ] Wire the PostgreSQL 17 runtime-role inspector into fail-closed startup checks, provision and verify a least-privilege runtime role, and confirm the live connection cannot assume privileged or tenant-table-owner roles.

**Exit criteria:** two test schools can be created, users can be assigned to each, and cross-school access tests pass.

**Verified partial foundation (not phase-complete):** shared identity contracts, fail-closed membership/context checks, role-permission primitives, and student relationship policy functions exist with unit tests. Student records are independent of optional portal accounts; guardian links target student records; teacher access is derived from class/subject/academic-period assignments and active enrolment. These functions are not yet connected to authentication middleware, database repositories, or tenant-isolation integration tests.

**Verified partial authentication boundary (not authentication complete):** the API has an injected provider-neutral adapter seam and a protected `/api/v1/me` endpoint. Missing or invalid adapters fail closed, the accepted principal contains only an active global user ID, identity fields are snapshotted once (throwing accessors are rejected), and the identity response sets `Cache-Control: no-store`. No credential verifier, provider, session lifecycle, account recovery or school-membership middleware is configured; the authentication roadmap item remains pending.

**Verified partial tenant-membership boundary (not persistence integration):** a protected `/api/v1/schools/:schoolId/context` route now requires authentication and an injected resolver. The API validates that the returned user and school match the authenticated user and requested scope, snapshots each resolver field once, rejects throwing accessors, validates the membership ID and role, discards extra claims, and sets `Cache-Control: no-store` on successful school-context responses. Shared contracts now include a provider-neutral resolver factory that validates a server-loaded user, school and membership snapshot through `buildTenantRequestContext`. It snapshots every persisted record and field exactly once, rejects throwing accessors and revoked proxies, and passes detached values into the context builder to prevent role changes between validation and use. A PostgreSQL membership-reader adapter performs a single parameterized join and fails closed on malformed IDs or non-singleton results, with unit tests through an injected query executor. API integration tests now compose the authenticated school-context route with the shared resolver and trusted membership snapshots, proving a School A membership cannot obtain School B context even when query/header/principal extras are forged. A PostgreSQL transaction helper now pins the validated user, school and membership identifiers with transaction-local settings, runs repository callbacks through a frozen query-only executor that does not expose pooled-connection release, and limits that executor to the callback lifetime. A conservative SQL guard rejects multiple statements, top-level transaction/session commands, Unicode-escaped identifiers and direct `set_config` calls before forwarding callback SQL; it is defense-in-depth, not a complete SQL parser, and cannot prevent indirect side effects inside arbitrary database functions. The executor shallow-copies query parameter arrays at invocation so later slot/length mutation cannot alter dispatched arguments (nested parameter objects are not deep-cloned). It waits for callback-started queries to settle before commit/rollback, including when the callback itself rejects, and rejects later calls through retained executor references. These are adapter and policy-path tests only, not live database isolation. Neither adapter nor transaction helper is configured in the server entry point; no runtime pool, role validation, RLS policies, live membership lookup or school-data route is connected. Membership resolver exceptions are normalized to generic 503 responses regardless of status codes attached to persistence errors. The schema-alignment migration, school-membership integration and tenant-isolation roadmap items remain pending.

**Verified partial runtime-role safety foundation (not live startup enforcement):** a PostgreSQL 17 catalog inspector now supplies the provider-neutral safety contract through one parameterized query. It checks the current role, the login's complete `SET ROLE` closure, RLS enablement, table ownership and inherited owner privileges. Unit tests use an injected fake executor. A separate disposable PostgreSQL 17 CI integration test now exercises the per-checkout runner with real temporary roles and a test-owned RLS policy across two schools; it verifies connection-level role inspection and test-policy isolation, but not the Supabase project's policy expressions, grants or application-schema isolation. The inspector and runner are not wired to a production pool or startup path.


**Verified per-checkout PostgreSQL connection guard (not runtime wiring):** a provider-specific runner now inspects each physical connection immediately after pool checkout and before tenant work, using the same captured query/release methods for inspection and the transaction. Unsafe or unknown leases are discarded before transaction start. This is per-checkout verification, not proactive inspection of idle connections, and it adds one catalog query per tenant transaction. The runner is not configured in the server entry point; the Phase 1 startup, least-privilege production role, application-schema RLS and two-school isolation exit criteria remain pending.



**Verified disposable PostgreSQL 17 runner integration coverage (test-only):** an opt-in CI integration test now exercises the verified transaction runner with temporary roles, a test-owned RLS policy and two concurrent physical pool connections. It checks school-scoped reads, cross-school update/delete filtering, cross-school insert rejection and rejection of a runtime role that can assume the table owner. The CI workflow provisions an ephemeral PostgreSQL 17 service; the 2026-11-26 pull-request run passed all 110 tests with no skips. This does not configure the server entry point or verify the Supabase project's policies/grants; production runtime wiring and Phase 1 application-schema isolation exit criteria remain pending.

## Phase 2 — School administration
- [ ] School profile and branding.
- [ ] Academic years and terms.
- [ ] Classes, streams, and subjects. (Frontend preview sections exist; school-scoped persistence remains pending.)
- [ ] Staff profiles and teacher assignments.
- [ ] Student enrolment and student records.
- [ ] Guardian profiles and verified student links.
- [ ] Student promotion and historical class records.

**Exit criteria:** a school can configure its structure and maintain complete student/staff records.

## Phase 3 — Academic operations
- [ ] Attendance registers.
- [ ] Assessment categories.
- [ ] Grading scale configuration.
- [ ] Mark entry and validation.
- [ ] Review and approval workflow.
- [ ] Result calculation and report cards.
- [ ] Secure result publication.

**Exit criteria:** a school can complete a term's attendance and assessment workflow with reproducible results.

## Phase 4 — Role-based portals
- [ ] Administrator workspace.
- [ ] Teacher workspace.
- [ ] Student portal.
- [ ] Parent/guardian portal.
- [ ] Notices and school announcements.
- [ ] Responsive and low-bandwidth usability review.

**Exit criteria:** each role sees only its permitted functions and records on mobile and desktop.

## Phase 5 — Fees and finance
- [ ] Fee structures by academic period.
- [ ] Student fee statements/invoices.
- [ ] Manual payment recording.
- [ ] Receipts and payment history.
- [ ] Outstanding balance reports.
- [ ] Reversal and adjustment workflow.
- [ ] Financial audit tests.

**Exit criteria:** balances and receipts are traceable, consistent, and auditable.

## Phase 6 — School identity and domains
- [ ] School subdomains.
- [ ] School branding and portal identity.
- [ ] Custom-domain verification.
- [ ] TLS and domain lifecycle handling.
- [ ] Domain collision and tenant-routing tests.

**Exit criteria:** a school can use a readable platform subdomain and, after verification, its own domain without weakening tenant isolation.

## Phase 7 — Pilot and launch readiness
- [ ] Pilot with a small number of schools using test or consented data.
- [ ] Accessibility and performance checks.
- [ ] Security review and tenant-isolation retest.
- [ ] Backup and restore drill.
- [ ] Data export and offboarding procedure.
- [ ] Admin and school user documentation.
- [ ] Monitoring, alerting, and incident response notes.
- [ ] Production deployment and onboarding checklist.

**Exit criteria:** pilot feedback is addressed, critical security tests pass, and operational recovery is demonstrated.

## Later backlog

Admissions, online exams/CBT, timetables, assignments, library, payroll, transport, boarding, mobile applications, provider payment integrations, and advanced analytics will be evaluated after the MVP is proven.


### Verified frontend progress
- [x] Add an interactive academic workspace preview with overview, classes/streams, subject catalogue and assessment schedule sections.
- [x] Add sample academic-year timeline, class-level filtering and responsive academic summary cards.
- [ ] Connect academic workspace to authenticated, school-scoped repositories and APIs.
- [ ] Implement persistent academic years, terms, class/subject relationships, assessment setup, grading and results only after tenant isolation and identity boundaries are verified.


### Verified frontend preview progress
- [x] Add student directory search, class/status filters, and read-only sample profile details.
- [ ] Implement authenticated student records, guardian verification, enrolment history, and school-scoped persistence.


### Verified frontend preview progress — staff
- [x] Add searchable staff directory with department/status filters and read-only sample profiles.
- [ ] Implement verified staff identity, school-scoped access, employment records and authorised staff administration.


### Verified frontend preview progress — attendance
- [x] Add sample attendance date/session controls, student/class search, class/status filters and explicit status updates.
- [ ] Implement historical registers, school-scoped attendance persistence, authorised corrections and audit history.


### Verified frontend preview progress — finance
- [x] Add illustrative finance overview, fee schedule breakdowns, student fee statements, outstanding-balance filters and recent payment activity.
- [ ] Implement approved school-specific fee schedules, persistent student ledgers, payment reconciliation, receipts, adjustments/reversals and financial audit history after tenant-safe access is verified.
