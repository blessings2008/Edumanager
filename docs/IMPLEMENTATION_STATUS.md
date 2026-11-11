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

### Supabase foundation applied and verified
- Supabase project provisioned with PostgreSQL 17.
- Migration `20261111174756_initial_school_tenancy_foundation` applied.
- Created `users`, `schools`, `school_memberships`, `school_domains` and `audit_events`.
- Added school/user membership uniqueness, status and role constraints, hostname uniqueness, lookup indexes and updated-at triggers.
- Enabled RLS on all five tables.
- Revoked browser-role access and granted table access only to the Supabase `service_role`; no end-user RLS policies are installed yet.
- Confirmed all five tables exist and RLS is enabled; all tables currently contain zero rows.
- Security advisor reports only the expected informational finding that RLS is enabled without policies. This is intentional until the auth and tenant policy model is implemented.
- Performance advisor reports unused indexes; the database is empty, so usage cannot yet be meaningfully evaluated.

### Deliberately not implemented yet
- Authentication provider and application-user identity mapping.
- Runtime database client, connection pooling and transaction-scoped tenant context.
- Tenant-aware RLS policies and cross-school database tests.
- Student, guardian, staff, class, academic or finance tables.
- Database-backed repositories and API routes.
- Production deployment configuration.

The database foundation is not a production-ready application data layer. Do not enable browser access or use a privileged service-role credential as a substitute for user authorization. Before student or school data is introduced, implement authentication, tenant-scoped runtime access, resource relationship checks, RLS policies and cross-tenant integration tests.

## Local development

Requirements: Node.js 22.12+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Run both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

Run checks with pnpm test, pnpm typecheck and pnpm build. GitHub Actions must pass before a branch is considered validated and merged.
