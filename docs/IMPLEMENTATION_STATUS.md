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
- Protected `GET /api/v1/me` accepts only a runtime-validated active global user identity from that adapter.
- Tenant IDs, school roles and permissions are not accepted as authenticated-principal claims; they must be resolved separately from trusted school records.
- With no adapter configured in the server entry point, the endpoint fails closed with 401.
- API tests cover missing adapters, forged identity headers, malformed/inactive principals, discarded tenant/role claims and sanitized adapter failures.
- This is an integration seam only: no credential verifier, authentication provider, session lifecycle, account recovery or persisted identity mapping is implemented.

### Verified partial school-membership boundary
- Added a provider-neutral tenant-context resolver seam after authentication.
- Protected `GET /api/v1/schools/:schoolId/context` passes only the authenticated global user ID and the requested path school ID to the resolver.
- The API rejects resolver contexts whose user or school IDs do not exactly match the request, whose membership ID is blank, or whose role is outside the shared school-role vocabulary. Unknown resolver fields are discarded.
- A missing resolver returns 503; missing authentication returns 401; a mismatched or malformed context returns 403.
- Shared contracts now provide `createTenantContextResolver`, which adapts a server-only membership reader, validates the actual persisted user/school/membership IDs and statuses, and delegates the final active-state and relationship checks to `buildTenantRequestContext`.
- The server entry point does not configure a reader or resolver. No database membership query or school-data route is connected yet.

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
- Confirmed all five tables exist and RLS is enabled; all tables currently contain zero rows.
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
- Runtime database client, connection pooling and transaction-scoped tenant context.
- Tenant-aware RLS policies and cross-school database integration tests.
- Student, guardian, staff, class, academic or finance tables.
- Database-backed repositories and API routes.
- Production deployment configuration.

### Remaining integration blockers
The live database still has only the initial migration applied, so its persisted values do not yet match the updated shared contracts. The follow-up migration must be reviewed and explicitly applied before runtime integration. Authentication architecture, secure identity mapping, tenant-scoped database access, RLS policies and cross-tenant integration tests also remain pending.

The database foundation is not a production-ready application data layer. Do not add real student or school data or enable browser access until authentication, tenant-scoped runtime access, resource relationship checks, RLS policies and cross-tenant integration tests are implemented and verified.

## Local development

Requirements: Node.js 22.12+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Run both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

Run checks with pnpm test, pnpm typecheck and pnpm build. GitHub Actions must pass before a branch is considered validated and merged.
