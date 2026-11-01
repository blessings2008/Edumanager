# Implementation status

## Current milestone: API foundation and hardening

### Added
- pnpm workspace for the web app, API and shared contracts.
- React + TypeScript + Vite web application.
- Fastify + TypeScript API split into app construction, configuration and server startup.
- Runtime configuration validation for API port and allowed web origins.
- Explicit CORS allowlist supporting multiple configured origins.
- Consistent 404 and safe 500 responses with request IDs.
- Initial API health and version endpoints.
- API tests using Fastify's in-memory injection interface.
- GitHub Actions workflow for tests, type-checking and builds.
- Shared role and school-membership contract types.
- Responsive public-facing foundation screen.

### Deliberately not added yet
- Database ORM or migrations.
- Authentication/session storage.
- Tenant resolution middleware.
- Student, staff, class or finance tables.
- Production deployment configuration.

The database provider and hosting decision still need confirmation. The recommended relational foundation is PostgreSQL, but no provider-specific code or schema has been committed. Tenant isolation must be enforced server-side and at the data layer, not merely by hiding data in the frontend.

## Local development

Requirements: Node.js 22.12+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Run both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

Run checks with pnpm test, pnpm typecheck and pnpm build.

GitHub Actions is configured to run these checks. They must pass before the branch is considered validated and merged.
