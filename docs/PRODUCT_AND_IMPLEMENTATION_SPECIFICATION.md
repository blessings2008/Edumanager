# EduManager — Full Product and Technical Implementation Specification

**Status:** Founder-approved product direction; technical specification for implementation planning  
**Date:** 2026-11-19  
**Repository baseline:** `main` at `66607ce39f674d6db944787e21a5e5741a5d5163`  
**Product direction:** Complete school operating system + integrated learning platform + management intelligence  
**Architecture decisions:** Subscription-tier entitlements; integrated learning; multi-school SaaS from inception

This document is the implementation source of truth for the expanded product direction. It supersedes narrower MVP assumptions in earlier product/roadmap documents where they conflict with the decisions above. It does not claim that planned modules are already implemented.

---

## 1. Confirmed product decisions

1. **Subscription tiers control module availability.** A school's plan determines its enabled feature set and quantitative limits. User permissions remain a separate security layer.
2. **Learning is integrated.** Courses, lessons, assignments, quizzes and learning progress use the same school, student, teacher, class, subject and academic-period records as school administration.
3. **Multi-school SaaS is foundational.** The data model, identity model, authorization, billing and operations must support multiple isolated schools from the first production release.
4. **Malawi-first, extensible.** Default locale is English, default timezone is `Africa/Blantyre`, and the initial currency default is MWK. School academic calendars, grading, fee schedules and other policies remain configurable.
5. **Security is a release gate.** No real student data or school-data endpoints before authentication, trusted tenant resolution, least-privilege database access, tenant-aware RLS and live cross-tenant tests are proven.

## 2. Repository audit baseline

The audit was performed against the GitHub repository on 2026-11-19.

### 2.1 What exists on main

- pnpm monorepo with `apps/web`, `apps/api`, `packages/contracts`, documentation and Supabase migrations.
- Web: React 19, TypeScript, Vite 7. The current `App.tsx` is an application-style preview with local sample data and local component state. It has navigation for Overview, Students, Attendance, Academics, Finance, Staff, Reports and Settings, but no persistent school-data integration.
- API: Fastify 5 and TypeScript. Current routes are health/version, `GET /api/v1/me`, and `GET /api/v1/schools/:schoolId/context`. The server entry point does not configure authentication, a tenant resolver, a PostgreSQL pool or school-data repositories. Protected routes therefore remain closed/unavailable by default.
- Shared contracts: global user/school/membership types, role permission primitives, trusted tenant-context construction and student relationship policy helpers.
- PostgreSQL: initial migration creates `users`, `schools`, `school_memberships`, `school_domains` and `audit_events`. Repository documentation says this initial migration was applied and verified in Supabase; the five tables were last documented as empty, with RLS enabled and browser-role access revoked.
- A second identity/schema-alignment migration exists in the repository but is documented as not applied. It changes school/membership vocabulary, adds email verification time and adds school-domain kind. It intentionally aborts if existing domain rows have not been classified.
- CI runs tests, type-checking and builds. The repository tree audited did not contain a pnpm lockfile, and CI/deployment currently use `pnpm install --no-frozen-lockfile`; reproducible lockfile-based installs are a prerequisite to tighten.
- Render's checked-in blueprint defines a static frontend only. It does not define the API service.

### 2.2 What does not exist on main

- A live authentication provider, credential/session lifecycle or account recovery.
- A configured runtime database pool, restricted runtime role or tenant-aware RLS policies.
- Live database integration tests proving reads, inserts, updates, deletes and relationships are isolated across two schools.
- School-data tables, repositories or API routes for students, guardians, staff, classes, attendance, academics, finance or learning.
- A subscription, plan, entitlement, add-on or usage-metering model.
- A functioning LMS, parent portal, student portal, communications service or management analytics pipeline.
- Production API deployment configuration in the repository.

### 2.3 Open security-hardening PR chain

PRs #23–#30 are open draft PRs stacked in dependency order. They add defensive handling around authenticated-principal snapshots, tenant-context snapshots, transaction executor capabilities, in-flight query draining, SQL command restrictions, Unicode-escaped identifier rejection and query-parameter array snapshots. The latest head inspected was PR #30 (`2f032b4f0d012190949c0e9cecfeba2fb6840f68`); its associated GitHub Actions run #247 completed successfully.

These PRs are not part of `main`. They require sequential review/merge planning. The SQL guard explicitly is not a complete PostgreSQL parser and cannot prevent indirect side effects inside arbitrary database functions. It must not be treated as the tenant-isolation mechanism.

### 2.4 Audit conclusion

The repository is a credible, security-conscious application foundation, not yet a functioning school management product. The first engineering milestone is completing the live security/data-access foundation. Product feature implementation starts only after that milestone passes its acceptance tests.

---

## 3. Product surfaces

EduManager is one platform with four connected user surfaces:

1. **School Workspace:** administration, students, staff, academics, attendance, finance, HR and operations.
2. **Integrated Learning Workspace:** courses, lessons, resources, assignments, quizzes, assessments and progress.
3. **Parent and Student Portals:** narrowly scoped views into approved school and learning information.
4. **Platform Administration:** Tambala-operated school onboarding, subscription plans, entitlements, support, platform monitoring and audited privileged operations.

These are role-aware experiences over shared services and data, not independent databases or disconnected products.

## 4. Functional module catalogue

### 4.1 Platform and school setup
- School registration, onboarding, profile and branding.
- Campuses/branches, school year, terms and calendars.
- School-specific locale, timezone, currency, grading and report settings.
- Membership invitations, account activation and role assignment.
- Verified school subdomains and optional verified custom domains.

### 4.2 Admissions and student lifecycle
- Enquiries and applications; configurable admission stages.
- Student and guardian profiles, documents and contact relationships.
- Enrolment, class placement, transfers, withdrawals, graduation and alumni.
- Historical enrolments and promotion records.
- Optional student portal account linking; student records do not require login identities.

### 4.3 Staff and HR
- Staff profiles, qualifications, departments, job roles and employment documents.
- Teacher assignments by class, subject and academic period.
- Staff attendance, leave and schedules.
- Appraisals and payroll preparation.
- Full statutory payroll is a later, separately scoped capability.

### 4.4 Attendance and school operations
- Student and staff attendance registers, lateness and absence reasons.
- Corrections with actor, timestamp and reason.
- Attendance alerts and reports.
- Timetables, room allocation and scheduling conflict checks.
- Discipline and intervention records with restricted access.
- Later extensions: transport, boarding, facilities and maintenance.

### 4.5 Academic management
- Academic years, terms, classes, streams, subjects and curriculum configuration.
- Assessment categories, components and examination schedules.
- Mark entry, validation, moderation, approval and controlled publication.
- Versioned grading scales and reproducible report cards.
- Promotion, repetition, transcripts and academic history.
- Rankings only when a school explicitly enables and configures them.

### 4.6 Integrated learning management
- Courses linked to school subjects, classes, teachers and academic periods.
- Lessons and digital resources: notes, documents, presentations, audio and video.
- Assignments, due dates, submissions, attachments, feedback and resubmissions.
- Quizzes, question banks, attempts and automatic grading for supported question types.
- Online examinations/CBT as a later capability with explicit exam controls.
- Learning progress and completion reporting.
- Digital library and reusable learning resources.

**Gradebook boundary:** LMS assignment or quiz scores must not silently become official academic marks. A teacher must explicitly map a learning activity to an approved assessment component. The academic moderation and publication workflow remains authoritative for official results.

### 4.7 Finance
- Fee structures by school, class, academic period and fee category.
- Student invoices/statements, instalments and partial payments.
- Payment recording, allocations, receipts, arrears and reconciliation.
- Scholarships, discounts, waivers and approved adjustments.
- Income, expenditure and financial summaries.
- Payment gateway/mobile money confirmation only through verified provider integrations and idempotent callbacks. A screenshot or browser redirect is not proof of settlement.

### 4.8 Parent/student services and communications
- Parent account linked to one or more verified dependants.
- Student self-service portal with optional account link.
- Published attendance, results, timetable, assignments and feedback.
- Parent notices, class announcements and teacher communication.
- Email/SMS/WhatsApp adapters, consent/preferences, delivery status and history.
- Fee and attendance reminders.

### 4.9 Resources and intelligence
- Inventory, assets, textbooks, library borrowing and resource allocation.
- Management dashboards for enrolment, attendance, academics, finance and operations.
- Exportable reports with role checks and audit events.
- Later AI assistance for summarisation and anomaly surfacing. AI must not autonomously decide admissions, grades, discipline, employment or financial adjustments.

---

## 5. Subscription and entitlement architecture

### 5.1 Separate four different controls

Every protected feature request must pass independent checks:

1. **Authentication:** who is the signed-in global user?
2. **Tenant membership:** which school is the user accessing, and is the membership active?
3. **Permission/resource scope:** may this user perform this action on this record?
4. **Subscription entitlement:** has this school purchased access to this feature and is it within plan limits?

A plan cannot grant a user permission. A user role cannot unlock a paid module. Neither can override tenant isolation.

### 5.2 Proposed commercial tiers

Tier names and feature allocations below are a proposed product structure, not approved prices or final commercial terms.

| Capability | Starter | Standard | Professional | Enterprise |
|---|---:|---:|---:|---:|
| School profile and setup | Yes | Yes | Yes | Yes |
| Student, guardian and staff records | Yes | Yes | Yes | Yes |
| Classes and attendance | Yes | Yes | Yes | Yes |
| Core school reports | Yes | Yes | Yes | Yes |
| Exams, grading and report cards | — | Yes | Yes | Yes |
| Fee billing and payment records | Basic | Full | Full | Full |
| Parent portal and announcements | — | Yes | Yes | Yes |
| Integrated courses and lessons | — | — | Yes | Yes |
| Assignments and quizzes | — | — | Yes | Yes |
| Timetables and learning resources | — | Basic | Full | Full |
| Advanced analytics | — | — | Yes | Yes |
| HR and payroll preparation | — | Basic | Full | Full |
| Inventory and library | — | — | Yes | Yes |
| Multi-campus operations | — | — | — | Yes |
| Custom roles/workflows and integrations | — | — | Limited | Advanced |
| Custom domain and advanced audit exports | — | Add-on | Yes | Yes |

Security, privacy, account recovery, essential data export and auditability are platform-wide standards. They must never be paywalled.

### 5.3 Entitlement data model

Recommended platform-control entities:

- `subscription_plans`: stable plan identity and code.
- `subscription_plan_versions`: immutable, versioned commercial configuration.
- `plan_entitlements`: feature keys, enabled state and numeric limits per plan version.
- `school_subscriptions`: school, plan version, lifecycle status, start/renewal dates and grace period.
- `subscription_addons`: additional features or capacity.
- `subscription_events`: auditable plan changes, renewals, suspension and cancellation.
- `usage_counters`: metered quantities such as active students, staff seats, storage and message usage.
- `billing_invoices` and `billing_payments`: platform subscription billing records.

Use stable entitlement keys such as `students.records`, `attendance.registers`, `academics.examinations`, `finance.fee_billing`, `learning.assignments`, `learning.quizzes`, `analytics.advanced` and `campuses.multiple`. Do not scatter plan-name checks through UI or API code.

### 5.4 Entitlement enforcement

- Implement a server-side entitlement resolver and cache with explicit invalidation on subscription changes.
- Check entitlements in API/domain services for every protected module operation. Frontend hiding is presentation only.
- Enforce quantitative limits server-side, transactionally where races matter.
- Record the plan version used for each subscription so later plan edits do not silently rewrite existing contracts.
- Support approved add-ons and time-bounded founder/platform overrides with actor, reason, expiry and audit history.
- Define grace periods and downgrade behaviour before billing launch.
- On downgrade, preserve all school data. After any agreed grace period, restrict new writes to unavailable paid modules while retaining safe read/export paths; never silently delete data or sever core school records.
- Initially, subscription invoicing can be operationally managed/manual. Automated recurring collection is a later integration decision.

---

## 6. Technical architecture

### 6.1 Deployment shape

Use a **modular monolith** initially: clear domain modules, one primary API deployment and one shared PostgreSQL database. Do not start with microservices.

- Web: React + TypeScript + Vite SPA, deployed separately.
- API: Node.js + TypeScript + Fastify, deployed as a separate service.
- Database: Supabase-hosted PostgreSQL 17, with a dedicated least-privilege application runtime role and connection pooling.
- Shared contracts: request/response schemas, identity types, permissions and stable domain contracts.
- File storage: private object storage with school-scoped access and short-lived signed URLs.
- Background work: durable job/outbox pattern for notifications, exports, report generation and scheduled tasks.
- Monitoring: structured logs, request IDs, metrics, error reporting, database health and backup/restore checks.

Provider and hosting choices must be validated against current cost, availability, connection limits, backups, recovery, export and operational access before production launch.

### 6.2 Suggested source layout

Keep the current workspace and introduce domain boundaries incrementally:

```
apps/
  web/
    src/
      app/                 # routing, session, tenant and entitlement providers
      modules/
        platform/
        school/
        students/
        staff/
        attendance/
        academics/
        finance/
        learning/
        portals/
        communications/
        reports/
      shared/              # design system, forms, tables, API client
  api/
    src/
      platform/             # identity, subscriptions, entitlements, support
      modules/
        schools/
        students/
        guardians/
        staff/
        attendance/
        academics/
        finance/
        learning/
        communications/
        reports/
      persistence/          # PostgreSQL pool, repositories, transactions
      security/             # authentication, tenant and permission middleware
      jobs/                 # outbox workers and scheduled work
packages/
  contracts/
supabase/
  migrations/
docs/
```

A module owns its domain rules, schemas, repository interfaces, routes and tests. Cross-module dependencies go through explicit services/contracts rather than importing internal database tables arbitrarily.

### 6.3 API request pipeline

For every school-scoped request:

1. Validate request shape, size and content type.
2. Authenticate the session/token and resolve the active global user.
3. Resolve the requested school from a validated domain/path selector.
4. Load and validate active user, school and membership records from trusted persistence.
5. Construct an immutable tenant request context.
6. Check the required role permission and record-level relationship.
7. Check the school's subscription entitlement and plan limits.
8. Execute repository work in a transaction scoped to the validated tenant context.
9. Write audit/outbox events in the same transaction where required.
10. Return a safe response with request ID and appropriate no-store caching for private data.

The school ID in a URL is a selector, not proof of access. Never accept user ID, role, membership ID, permission or tenant context from client-controlled headers/body/query fields.

### 6.4 Authentication decision

Authentication provider and session lifecycle remain unresolved in the audited code. Supabase Auth is the leading candidate because the database is already on Supabase, but it must be confirmed through a short architecture spike.

The spike must compare:
- Server-side token verification and refresh/session handling.
- Secure HttpOnly cookie strategy for the browser.
- Identity mapping from the provider subject to `public.users`.
- Revocation, account recovery, invitation and email-verification flows.
- RLS integration and operational failure behaviour.

No school-data routes should be wired to a placeholder adapter. The selected provider must produce the same provider-neutral global identity contract already defined by the API.

### 6.5 Multi-tenant database rules

Use one shared PostgreSQL database/schema initially. Every tenant-owned row must contain a non-null `school_id`, or be attached through a parent with an enforceable school-scoped relationship.

- Use composite unique keys and foreign keys, e.g. `(school_id, student_id)`, to prevent cross-school relationships at the database layer.
- Add indexes beginning with `school_id` for common tenant-scoped queries.
- Apply RLS to all tenant-owned tables.
- Use a dedicated runtime role that is not superuser, does not have `BYPASSRLS`, and does not own tenant tables unless `FORCE ROW LEVEL SECURITY` is deliberately applied.
- Never use the Supabase `service_role` as the normal tenant-data runtime credential; it bypasses RLS.
- Keep migration credentials separate from runtime credentials.
- Use transaction-local tenant context only as one input to policies; validate active membership against persisted records. Custom PostgreSQL settings are not unforgeable identity tokens and do not replace a trusted API boundary.
- If policy helper functions require elevated execution, use narrowly scoped SECURITY DEFINER functions with pinned search paths, minimal grants and explicit review.
- Add real PostgreSQL integration tests for School A versus School B reads, inserts, updates, deletes, joins, foreign-key links and membership revocation.

The open tenant SQL guard is supplementary defence-in-depth, not a substitute for parameterized queries, trusted repository code, least privilege or RLS.

### 6.6 Core data domains

The following is the target domain model, not a claim that these tables exist today.

**Platform/control plane**
- users and auth identity mappings
- schools, campuses, school domains
- school memberships, invitations and custom role assignments
- subscription plans, versions, entitlements, subscriptions, add-ons and billing
- platform audit events, support access grants and usage metering

**School configuration**
- school settings, academic years, terms/periods, calendars
- classes, streams, subjects, curriculum structures
- grading-scale versions and assessment configuration

**People**
- student records, guardian records and verified guardian-student links
- optional student portal-account links
- staff profiles, teacher assignments and employment records
- enrolments and historical class progression

**Operations and academics**
- attendance sessions and attendance entries
- assessments, components, marks, moderation events and publication snapshots
- timetables, rooms, discipline and interventions
- report-card snapshots and transcript records

**Finance**
- fee schedules, invoices, invoice lines
- payments, payment allocations, receipts
- adjustments, reversals, reconciliation records
- expenses and financial reporting records

**Learning**
- courses, course/class/subject links, teacher assignments
- lessons, private resources and resource metadata
- assignments, submissions, feedback and resubmissions
- question banks, quizzes, attempts and results
- explicit mapping from learning activities to official assessment components

**Communications and resources**
- announcements, messages, notification preferences and delivery attempts
- inventory, assets, library items, loans and maintenance records

**Shared infrastructure**
- audit events, idempotency keys, outbox events, background jobs, file metadata and usage counters

### 6.7 Data integrity and privacy

- Money uses integer minor units (or an explicitly defined currency precision) plus a currency code; never use floating-point arithmetic.
- Store timestamps in UTC and render in the school's configured timezone.
- Version grading rules and preserve published result snapshots so historic report cards remain reproducible.
- Treat payments as immutable transactions; corrections use reversal/adjustment entries.
- Make audit events append-only to application roles; include actor, school, action, target and safe metadata.
- Keep student documents in private storage. Use short-lived signed access and verify tenant/record permissions before issuing a URL.
- Minimise collection of sensitive student information. Restrict medical/emergency or other sensitive fields separately.
- Define retention, export, correction and tenant-offboarding processes before onboarding real students.

---

## 7. Role and permission model

Roles are school-scoped. A global user may belong to multiple schools with different roles.

Initial built-in roles:
- school owner/proprietor
- school administrator
- headteacher/academic lead
- bursar/accountant
- HR officer
- teacher
- librarian/resource officer
- parent/guardian
- student

Use permission keys rather than role-name checks in domain logic. Example permissions include `students.read`, `students.manage`, `attendance.record`, `attendance.correct`, `academics.marks.enter`, `academics.results.approve`, `academics.results.publish`, `finance.payments.record`, `finance.adjustments.approve`, `learning.course.manage` and `users.memberships.manage`.

Support custom roles after the built-in permission catalogue is stable. Apply least privilege and separation of duties: entering marks is distinct from approving/publishing results; recording a payment is distinct from approving a financial adjustment.

Resource rules remain mandatory:
- Students: optional active self-account link.
- Guardians: active, verified, school-scoped dependant link.
- Teachers: active class/subject/academic-period assignment matching the student's active enrolment.
- Parents never gain access to another family's records through a shared class or school membership.

---

## 8. Implementation roadmap and acceptance gates

Dates are intentionally omitted until the audit backlog and available development capacity are verified.

### Phase 0 — Audit and specification
- [x] Confirm founder product direction and architecture decisions.
- [x] Audit main branch, migrations, frontend, API, docs and open PR chain.
- [x] Record actual implementation versus planned capabilities.
- [ ] Review and reconcile older product/roadmap documentation.
- [ ] Review stacked security PRs #23–#30 in dependency order.

**Exit:** agreed source-of-truth specification and reviewed security-hardening baseline.

### Phase 1 — Secure runtime foundation
- Complete the stacked PR review/merge sequence; do not merge merely because the latest head is green.
- Add reproducible dependency lockfile and frozen CI/deployment installs.
- Decide authentication provider/session architecture through an ADR and spike.
- Implement identity mapping and account/session lifecycle.
- Provision restricted PostgreSQL runtime role and connection pool.
- Review/apply schema-alignment migration with backup, preflight and clean-database verification.
- Wire trusted membership lookup and transaction-scoped repositories.
- Implement tenant-aware RLS and database-level relationship constraints.
- Add real two-school integration tests and membership revocation tests.

**Exit:** two schools and multi-school users work correctly; all cross-tenant access tests pass; no privileged service-role runtime access.

### Phase 2 — Subscription and entitlement foundation
- Define plan/version/entitlement schema and stable feature keys.
- Implement subscription state lifecycle and entitlement resolver.
- Implement server-side feature and quantitative limit checks.
- Add audited platform overrides and add-on model.
- Define grace, downgrade, cancellation and data-retention behaviour.
- Build platform admin plan/subscription controls.

**Exit:** test schools on different plans receive only entitled features, with API enforcement and no data loss on downgrade.

### Phase 3 — School configuration and identity operations
- School onboarding, campuses, branding and settings.
- Academic years, terms, calendars and school configuration.
- Invitations, memberships, built-in roles and permissions.
- Verified domain routing.
- Audit and support-access controls.

**Exit:** a school can be onboarded and configured without database/manual intervention outside controlled platform operations.

### Phase 4 — Core school records
- Admissions and student records.
- Guardian profiles and verified links.
- Staff profiles and teacher assignments.
- Classes, streams, subjects and enrolments.
- Historical progression, transfer and withdrawal.
- Private document handling.

**Exit:** authorised school users can manage complete school records through real API/database workflows.

### Phase 5 — Attendance and academic engine
- Student/staff attendance and correction workflow.
- Assessment structures and examination scheduling.
- Mark entry, validation, moderation and approval.
- Versioned grading and report-card snapshots.
- Controlled result publication and academic history.

**Exit:** a pilot school can complete a term's attendance and academic-result cycle with reproducible reports.

### Phase 6 — Finance and HR
- Fee structures, billing, payment records and receipts.
- Partial payments, allocations, arrears and reconciliation.
- Adjustments/reversals and audit controls.
- Expenses and finance reports.
- Staff attendance, leave and payroll preparation.

**Exit:** financial balances reconcile and sensitive finance operations are permissioned and auditable.

### Phase 7 — Integrated learning
- Courses connected to school classes, subjects, teachers and periods.
- Lessons and private learning resources.
- Assignments, submissions, feedback and resubmissions.
- Quizzes, question banks and attempts.
- Explicit gradebook mapping into academic assessments.
- Learning progress and digital library.

**Exit:** teachers and students can complete a learning cycle, while official academic marks remain controlled by the academic workflow.

### Phase 8 — Parent/student portals and communications
- Secure parent-child linking and student self-account linking.
- Parent and student dashboards.
- Published attendance, results, timetables and learning tasks.
- Announcements and messaging.
- Email/SMS/WhatsApp adapters with consent and delivery history.

**Exit:** families access only authorised dependants' records and notifications are traceable.

### Phase 9 — Advanced operations and intelligence
- Timetables, facilities, inventory and library.
- Transport/boarding extensions when validated by school demand.
- Management dashboards and exports.
- AI-assisted summaries with human approval and no autonomous high-impact decisions.

**Exit:** leadership reports are derived from verified source data and respect permissions.

### Phase 10 — Commercial launch and operations
- Subscription billing and provider integrations as approved.
- School onboarding, training and support.
- Documentation, exports, offboarding and retention.
- Monitoring, incident response and restore drills.
- Accessibility, performance, security and load testing.
- Pilot feedback and production readiness review.

**Exit:** multiple schools can be onboarded, supported, billed and operated safely.

---

## 9. First pilot release

The first real pilot should prove the core school operating workflows before attempting the entire advanced platform.

Required first usable release:
- secure school onboarding and administrator account
- academic year, terms, classes and subjects
- student and guardian records
- staff and teacher assignments
- student attendance
- assessments, grading and report cards
- fee structures, manual payment records and receipts
- basic dashboards and exports
- audited access, backups and tested restoration

Day Star Academy is a prospective pilot candidate (preschool through Primary Standard 6, with paper/spreadsheet workflows noted in earlier project context). Confirm workflows and consent before using any real student data.

The integrated LMS remains part of the product architecture and is implemented after the shared student/teacher/class/academic foundation is stable.

## 10. Engineering standards and release gates

A feature is not complete because a screen exists. Every feature must include:
- written business rules and acceptance criteria
- data model and migration review
- input validation and API contract
- permission and entitlement checks
- tenant-scoped repository implementation
- unit, API and database integration tests
- cross-tenant and relationship tests where applicable
- audit, idempotency and error handling as required
- accessible responsive UI and loading/empty/error states
- documentation and verified deployment

Required CI checks: dependency install from committed lockfile, tests, type-check, build, migration validation and security checks. Add browser end-to-end tests for critical user journeys and real PostgreSQL integration tests for tenant boundaries.

Track delivery states separately: **designed → implemented → tested → merged → deployed → production-verified**.

Production migrations and deployments remain explicit approval gates. A green CI run does not itself authorise production deployment.

## 11. Immediate engineering backlog

Priority order:
1. Review PR #23 through #30 as a stacked chain, identify any required changes, and merge only after individual review and CI verification.
2. Add and commit pnpm lockfile; move CI and Render installs to frozen lockfile mode.
3. Create an authentication/session architecture decision record and verify the selected provider integration.
4. Design the restricted runtime PostgreSQL role, connection strategy and RLS policy helper model.
5. Preflight and review the unapplied identity-alignment migration; do not apply without an explicit migration approval.
6. Build live two-school PostgreSQL isolation tests before any school-data route.
7. Implement plan/version/entitlement schema and middleware before tier-controlled product modules.
8. Begin school configuration and student lifecycle only after Phase 1 acceptance.

---

## 12. Non-negotiable product and security rules

- Never fabricate school data, implementation status, CI results or deployment verification.
- Never put privileged database credentials or service-role keys in browser code.
- Never rely on frontend-only permissions or subscription checks.
- Never treat a school ID in a URL, hostname or client payload as proof of access.
- Never let an LMS score silently overwrite an official academic result.
- Never silently delete or make school data inaccessible after a subscription downgrade.
- Never expose a guardian's access beyond verified dependants.
- Never deploy a schema or application change to production without its approval gate.
- Never onboard real student data until the security acceptance gates are proven.

**Ownership:** EduManager is a Tambala Technologies product. All implementation work should preserve maintainability, data portability, school privacy and a clear operational path for a small team.
