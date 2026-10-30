# EduManager — Product Vision

## 1. Purpose

EduManager is a cloud-based school operations platform that helps schools manage their administrative and academic work in one place. It is being designed for the realities of Malawian schools first: mixed levels of digital access, mobile-first usage, school-year workflows, local fee practices, and the need for clear communication with parents and guardians.

The platform should be useful to a small school without feeling limited, and capable of supporting larger institutions without needing a separate product.

## 2. Target institutions

Initial focus:
- Private primary and secondary schools in Malawi.
- Schools that currently depend on paper registers, spreadsheets, and messaging apps.
- Schools that need parents and learners to access approved information remotely.

The data model should not assume one national curriculum or grading scheme. Each school must be able to configure its academic structure and grading rules.

## 3. Product outcomes

1. Reduce repetitive administration and duplicated records.
2. Keep student, guardian, staff, class, and academic records organised.
3. Make attendance and academic progress easier to track.
4. Give schools controlled ways to publish results and notices.
5. Improve fee tracking and payment accountability.
6. Provide a secure portal experience for administrators, teachers, learners, and guardians.

## 4. User roles

Roles are scoped to a school. A person may have different roles in different schools.

- **Platform operator:** manages the SaaS platform, tenant provisioning, subscription state, and platform-level support. This role must not automatically grant unrestricted access to school records.
- **School owner / proprietor:** manages school-level settings and oversight.
- **School administrator:** manages day-to-day school operations and user access.
- **Head teacher / academic lead:** oversees classes, subjects, academic sessions, assessments, and results.
- **Teacher:** accesses assigned classes and subjects, records attendance and assessment marks, and manages permitted learning activities.
- **Bursar / accountant:** manages fee structures, invoices, payments, balances, and financial reports.
- **Student:** views their own permitted timetable, attendance, notices, and published results.
- **Parent / guardian:** views information only for linked dependants and receives school communications.

Permissions must be explicit and testable. A role name alone must never be treated as proof that a user belongs to a particular school.

## 5. MVP scope

### Foundation
- Tenant-aware account and school onboarding.
- Secure authentication and school membership.
- Role-based permissions.
- School profile, branding, academic year, and configurable terms.
- Audit trail for sensitive administrative actions.

### School administration
- Student records and enrolment.
- Guardian relationships and contact details.
- Staff records.
- Classes, class streams/arms, and subjects.
- Student promotion and class history.

### Academic operations
- Attendance registers.
- Assessment categories and grading configuration.
- Mark entry with validation and review.
- Result calculation and report cards.
- Controlled result publication.

### Portals
- School administrator dashboard.
- Teacher workspace.
- Student portal.
- Parent/guardian portal with linked-student switching where applicable.

### Finance
- Fee structures by class/session/term.
- Student invoices or fee statements.
- Payments and receipts.
- Outstanding balance tracking.
- Manual payment recording in the first release; integrations can follow after provider and reconciliation requirements are confirmed.

## 6. Later capabilities

- Online admissions and application review.
- Timetables and lesson planning.
- SMS, email, and WhatsApp notifications where providers and consent rules allow.
- Online examinations / CBT.
- Library and inventory.
- Payroll.
- Transport and boarding management.
- Advanced analytics and multi-campus operations.
- Payment gateway integrations.

These are not MVP commitments. They should be prioritised using feedback from pilot schools.

## 7. School portals and domains

Every school should receive a stable, human-readable portal address, for example:

- `greenvalley.edumanager.example` (school subdomain)
- `portal.greenvalleyschool.mw` (school-owned custom domain, when configured)

The school identifier in the URL is a routing hint, not an authorisation mechanism. The server must still verify the authenticated user's active membership and permissions for every protected request.

Custom domains require DNS ownership verification, TLS provisioning, domain-to-school mapping, and protection against one domain being attached to multiple schools.

## 8. Malawi-first product decisions

- Default locale: English, with room for additional languages later.
- Default timezone: Africa/Blantyre; store timestamps in UTC and render in the school's configured timezone.
- Default currency: MWK, while allowing a school-specific currency setting if expansion requires it.
- Academic years, terms, grading, class naming, and fee schedules must be configurable rather than hard-coded.
- Interfaces should work well on lower-cost Android phones and constrained connections.

## 9. Non-goals for the first release

- Replacing a school's statutory accounting system.
- Guaranteeing integrations with mobile-money providers before API access and settlement workflows are verified.
- Assuming every school follows the same term dates, grade boundaries, or promotion rules.
- Publicly exposing student results through guessable IDs or unprotected links.

## 10. MVP acceptance standard

A pilot school should be able to:
1. Create its school workspace and invite staff.
2. Configure its academic year, terms, classes, and subjects.
3. Enrol students and link guardians.
4. Assign teachers to classes and subjects.
5. Record attendance and assessment marks.
6. Review and publish results securely.
7. Let a learner or guardian sign in and see only authorised records.
8. Record fees and payments with traceable receipts.

A feature is not ready merely because its screen exists. It must have server-side validation, permission checks, tenant-isolation tests, error handling, and user-facing documentation.
