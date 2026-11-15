# Implementation status

## Current milestone: application foundation

### Added
- pnpm workspace for the web app, API and shared contracts.
- React + TypeScript + Vite web application.
- Fastify + TypeScript API with health and version endpoints.
- Shared role and school-membership contract types.
- Environment template and repository hygiene files.
- Responsive public-facing foundation screen.

### Deliberately not added yet
- Database ORM or migrations.
- Authentication/session storage.
- Tenant resolution middleware.
- Student, staff, class or finance tables.
- Production deployment configuration.

These depend on validating the database and hosting choices. Tenant isolation must be enforced in the API and database, not merely by hiding data in the frontend.

## Local development

Requirements: Node.js 22+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Run both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

The GitHub connector can write and inspect repository files, but it has not run install, build or type-check commands. Run those locally or in CI before merging.
