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
- [ ] Create web and API applications.
- [ ] Add shared contracts and environment validation.
- [ ] Set up PostgreSQL and migration workflow.
- [ ] Implement users, schools, memberships, and school onboarding.
- [ ] Implement authentication, sessions, and account recovery.
- [ ] Add role/permission checks and tenant-isolation tests.
- [ ] Build initial school setup wizard.
- [ ] Reconcile database schema vocabulary with shared identity contracts before runtime integration.

**Exit criteria:** two test schools can be created, users can be assigned to each, and cross-school access tests pass.

**Verified partial foundation (not phase-complete):** shared identity contracts, fail-closed membership/context checks, role-permission primitives, and student relationship policy functions exist with unit tests. Student records are independent of optional portal accounts; guardian links target student records; teacher access is derived from class/subject/academic-period assignments and active enrolment. These functions are not yet connected to authentication middleware, database repositories, or tenant-isolation integration tests.

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
