# Implementation status

## Current milestone: authorization policy foundation

### Added
- pnpm workspace for the web app, API and shared contracts.
- React + TypeScript + Vite web application.
- Fastify + TypeScript API with validated configuration, explicit CORS allowlist, safe error responses and request IDs.
- API tests for health/version routes, 404 handling and configuration validation.
- Shared identity contracts for users, schools, memberships, domains and trusted tenant request context.
- A pure platform-subdomain resolver with tests for valid slugs, platform hosts, malformed hosts, nested subdomains and unrelated domains.
- Tenancy and identity security documentation covering request resolution, membership-scoped roles, custom-domain verification and data isolation.
- Shared fail-closed membership validation requiring an active user, school and matching active membership.
- A first coarse role-permission matrix for school administrators, staff, teachers, students and guardians.
- Authorization tests for mismatched identities, wrong-school memberships, inactive states and role boundaries.\n- Resource-level student-record access policy: students are limited to their own record, guardians require a verified guardian link, teachers require a verified teaching assignment, and staff/admin access follows explicit permissions.\n- Hardened hostname parsing that rejects explicit ports (including default port 80), URL syntax, escapes, malformed labels and invalid host characters.
- GitHub Actions workflow for tests, type-checking and builds.

### Deliberately not added yet
- Database ORM or migrations.
- Authentication/session storage.
- Tenant resolution middleware wired into requests.
- Database-backed relationship lookups for guardian/student and teacher/class access (the policy accepts trusted relationship results but does not query a database).
- Database-backed custom-domain lookup.
- Student, staff, class, academic or finance persistence.
- Production deployment configuration.

The recommended relational foundation remains PostgreSQL, but the provider and hosting decision has not been confirmed. No provider-specific code or schema has been committed. The hostname resolver is not an authentication mechanism. The shared membership and permission functions are policy building blocks, not yet wired into route middleware. School data routes must wait for trusted authentication, resource-level relationship checks and tenant-scoped persistence.

## Local development
Requirements: Node.js 22.12+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Run both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

Run checks with pnpm test, pnpm typecheck and pnpm build. GitHub Actions must pass before the branch is considered validated and merged.
