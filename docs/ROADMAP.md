# EduManager — Delivery Roadmap

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
- [x] Implement PostgreSQL 17 runtime-role catalog inspection and exercise it against a disposable PostgreSQL 17 CI service.
- [x] Require runtime-role inspection before a server-side school-membership resolver can be configured; fail app readiness when the inspector reports an unsafe or incomplete role.
- [ ] Wire a real least-privilege runtime pool and inspector into the server entry point, provision/verify the runtime role, and confirm the live connection cannot assume privileged or tenant-table-owner roles.

**Exit criteria:** two test schools can be created, users can be assigned to each, and cross-school access tests pass.

**Verified partial foundation (not phase-complete):** shared identity contracts, fail-closed membership/context checks, role-permission primitives, and student relationship policy functions exist with unit tests. Student records are independent of optional portal accounts; guardian links target student records; teacher access is derived from class/subject/academic-period assignments and active enrolment. These functions are not yet connected to authentication middleware, database repositories, or tenant-isolation integration tests.

**Verified partial authentication boundary (not authentication complete):** the API has an injected provider-neutral adapter seam and a protected `/api/v1/me` endpoint. Missing or invalid adapters fail closed, the accepted principal contains only an active global user ID, identity fields are snapshotted once (throwing accessors are rejected), and the identity response sets `Cache-Control: no-store`. No credential verifier, provider, session lifecycle, account recovery or school-membership middleware is configured; the authentication roadmap item remains pending.

**Verified partial tenant-membership boundary (not persistence integration):** a protected `/api/v1/schools/:schoolId/context` route now requires authentication and an injected resolver. The API validates that the returned user and school match the authenticated user and requested scope, snapshots each resolver field once, rejects throwing accessors, validates the membership ID and role, discards extra claims, and sets `Cache-Control: no-store` on successful school-context responses. Shared contracts now include a provider-neutral resolver factory that validates a server-loaded user, school and membership snapshot through `buildTenantRequestContext`. A PostgreSQL membership-reader adapter performs a single parameterized join and fails closed on malformed IDs or non-singleton results, with unit tests through an injected query executor. API integration tests now compose the authenticated school-context route with the shared resolver and trusted membership snapshots, proving a School A membership cannot obtain School B context even when query/header/principal extras are forged. A PostgreSQL transaction helper now pins the validated user, school and membership identifiers with transaction-local settings, runs repository callbacks through a frozen query-only executor that does not expose pooled-connection release, and limits that executor to the callback lifetime. A conservative SQL guard rejects multiple statements, top-level transaction/session commands, Unicode-escaped identifiers and direct `set_config` calls before forwarding callback SQL; it is defense-in-depth, not a complete SQL parser, and cannot prevent indirect side effects inside arbitrary database functions. The executor shallow-copies query parameter arrays at invocation so later slot/length mutation cannot alter dispatched arguments (nested parameter objects are not deep-cloned). It waits for callback-started queries to settle before commit/rollback, including when the callback itself rejects, and rejects later calls through retained executor references. These are adapter and policy-path tests only, not live database isolation. Neither adapter nor transaction helper is configured in the server entry point; no runtime pool, role validation, RLS policies, live membership lookup or school-data route is connected. Membership resolver exceptions are normalized to generic 503 responses regardless of status codes attached to persistence errors. The schema-alignment migration, school-membership integration and tenant-isolation roadmap items remain pending. The provider-neutral runtime-role safety contract now has unit coverage for privileged roles, assumable roles, missing RLS metadata, tenant-table ownership and inspection failures. A PostgreSQL 17 catalog inspector now supplies the contract through one parameterized query and checks both `SET ROLE` capability and inherited owner privileges. Its unit tests use an injected fake executor, and GitHub Actions also runs the inspector against a disposable PostgreSQL 17 service with real role memberships and tenant-table metadata. Coverage includes direct/transitive `SET ROLE`, inherited owner privileges, `BYPASSRLS`, disabled RLS and missing tables. This validates catalog inspection only. The Fastify application now requires one server-only tenant-persistence adapter that groups the membership resolver, role-inspection method and required-table list. Adapter implementations must build both operations from the same runtime executor/pool; the app snapshots both methods and the table list before running the fail-closed check during readiness. This prevents independent resolver/inspector wiring at the API dependency boundary. The app invokes the captured operations without the mutable adapter object as their `this` receiver, so receiver-field mutation cannot redirect dispatch. It still cannot prove that closure-captured state is immutable or that both operations share one underlying executor. The server entry point still configures neither resolver nor inspector/pool, so no live role is inspected; RLS policy expressions, effective grants and cross-school row isolation remain unverified.

## Phase 2 — School administration
- [ ] School profile and branding.
- [ ] Academic years and terms.
- [ ] Classes, streams, and subjects.
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
