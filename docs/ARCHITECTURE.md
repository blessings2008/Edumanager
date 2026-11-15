# EduManager — Initial Architecture

**Status:** Foundation in progress. The first managed PostgreSQL project is provisioned and the initial tenancy schema is applied.

## 1. Architecture goals

- Strong isolation between schools sharing one application.
- Clear separation between user identity, school membership, and school-specific roles.
- Maintainable code that a small team can operate.
- Good performance on mobile devices and slower connections.
- Auditable academic and financial workflows.
- Portable deployment without depending on the user's local server.

## 2. Proposed stack

| Layer | Initial choice | Reason |
|---|---|---|
| Web application | React + TypeScript + Vite | Familiar, responsive SPA foundation |
| UI | Tailwind CSS + accessible component primitives | Consistent design without sacrificing accessibility |
| API | Node.js + TypeScript + Fastify | Typed, lightweight API with schema validation |
| Database | Supabase-hosted PostgreSQL 17 | Managed PostgreSQL, backups and integrated database tooling |
| Data access | SQL-first migration history; ORM decision pending | Avoid locking schema decisions to an unreviewed data-access layer |
| Authentication | Supabase Auth vs server-managed sessions — decision pending | Must align identity, API session handling and database RLS |
| File storage | Supabase Storage vs S3-compatible storage — decision pending | Compare access policies, pricing, backup/export and operational needs |
| Hosting | Cloud deployment; API and web app can be deployed independently | No dependency on the user's local server |

Provider-specific choices must be checked against current pricing, regional availability, backup and recovery options, data export and operational requirements before production launch.

## 3. Application boundaries

Initial repository layout:

```
apps/
  web/                 # React application
  api/                 # Fastify API
packages/
  contracts/           # Shared request/response schemas and types
  config/              # Shared lint, TypeScript and environment conventions
supabase/
  migrations/          # Versioned SQL schema changes
docs/
  PRODUCT_VISION.md
  ARCHITECTURE.md
  SECURITY_MODEL.md
  ROADMAP.md
```

The browser is an untrusted client. It may display controls based on permissions, but the API must independently authenticate and authorise every protected operation.

## 4. Multi-tenancy model

Use a shared PostgreSQL database with a shared schema initially. Every school-owned record must carry a non-null `school_id` (or be linked through a school-scoped parent record).

Core identity concepts:
- `users`: global application identity record; mapping to the chosen authentication provider is not implemented yet.
- `schools`: tenant record.
- `school_memberships`: user-to-school relationship, membership status, and school-scoped role.
- `school_domains`: verified hostnames mapped to a school.
- School-owned business records: students, staff profiles, classes, subjects, attendance, assessments, invoices, payments, and so on.

Important rules:
1. Never trust a `school_id`, role, or owner identifier supplied by the browser.
2. Resolve the active school from a validated hostname or explicit school context, then verify the signed-in user's active membership.
3. Every database query for tenant-owned data must be scoped to the authorised school.
4. Use composite foreign keys or equivalent constraints where practical so records cannot be linked across schools accidentally.
5. Add automated tests that attempt cross-school reads, writes, updates, and relationship changes.
6. Platform support access must be separate, limited, justified, and audited; it must not be a hidden universal school-admin role.

A tenant ID in a URL is never a security boundary.

## 5. Domain routing

- Platform default: `{school-slug}.<platform-domain>`.
- Optional custom domain: a school-controlled hostname after DNS verification.
- Store normalised hostnames in `school_domains`, with a unique constraint.
- Reject unverified domains and prevent domain takeover/reassignment without an explicit verification process.
- Apply TLS before enabling a custom domain.
- Use the host only to identify the candidate school; authenticate and authorise the user independently.

## 6. Data and academic model

Academic structures must be configurable:
- Academic years / sessions.
- Terms / semesters.
- Classes and streams.
- Subjects and teacher assignments.
- Assessment categories and grading scales.
- Enrolment history and promotion history.

Do not overwrite historical enrolment or results when a student changes class. Keep dated history so past reports remain reproducible.

Result publication should be an explicit state transition (draft → reviewed → published, with correction/republication recorded). Published report data must not silently change when a grading configuration is edited later.

## 7. Financial integrity

- Store monetary values as integer minor units where the currency's precision is defined, alongside an explicit currency code.
- Never use floating-point arithmetic for money.
- Record payments as immutable transactions; corrections should use reversal/adjustment entries rather than silently editing settled records.
- Reconcile payment-provider callbacks using verified signatures and idempotency keys.
- Do not mark an invoice paid based solely on a client-side redirect or screenshot.

## 8. API conventions

- Version public API routes (initially `/api/v1`).
- Validate all input at the API boundary.
- Return consistent error shapes with safe messages and request IDs.
- Use pagination for potentially large collections.
- Make state-changing requests idempotent where appropriate.
- Keep business rules in the API/domain layer, not in React components.

## 9. Quality gates

Every meaningful change should pass:
- Formatting and lint checks.
- Type checking.
- Unit tests for domain rules.
- API integration tests.
- Tenant-isolation and role-permission tests for protected data.
- Production build.
- Migration review and clean-database migration test when schema changes.

## 10. Open decisions

- Authentication architecture and mapping of application users to authentication identities.
- Runtime database access strategy that preserves RLS (never expose privileged credentials to the browser).
- ORM/data-access layer and connection pooling.
- Email/SMS provider and message-consent policy.
- Data retention, backup schedule, and recovery objectives.
- School subscription and billing model.
- Legal/privacy requirements applicable to operating in Malawi and any future markets.
- Whether a school can self-register or must be provisioned after a sales/onboarding process.
