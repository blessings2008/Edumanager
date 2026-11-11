# EduManager

EduManager is a Malawi-first school management platform, designed to support multiple schools while keeping each school's records private and separate.

The product is being built to bring school administration, academic records, attendance, examinations, results, fees and school-community access into one dependable system.

## Project status

**Stage:** Application foundation  
**Primary market:** Malawi  
**Initial delivery target:** Secure multi-school web platform

## Repository structure

- apps/web — React + TypeScript web application
- apps/api — Fastify + TypeScript API
- packages/contracts — shared API and domain types
- docs — product, architecture, security and delivery documentation
- supabase/migrations — versioned database schema changes

## Core principles

- Each school is a separate tenant; school data must never leak across tenants.
- Staff, students and guardians only see information they are authorised to access.
- School portals should have readable school-specific URLs; verified custom domains are planned.
- Academic and financial records must be auditable.
- Mobile-first and low-bandwidth-aware user experience.
- No feature is complete without meaningful tests and documented acceptance criteria.

## Local development

Requirements: Node.js 22.12+ and pnpm 10+.

1. Copy .env.example to .env.
2. Install dependencies with pnpm install.
3. Start both applications with pnpm dev.
4. Web app: http://localhost:5173
5. API health: http://localhost:4000/health

## Database

EduManager's initial database is hosted on Supabase (PostgreSQL 17). The first migration establishes global user records, schools, school memberships, verified-domain records and audit-event scaffolding.

The initial tables have Row Level Security enabled and no browser-role policies or grants. This is deliberate: application access must not be enabled until authentication and tenant-scoped authorization are implemented and tested. Never put a Supabase service-role key or database password in browser code or commit either secret.

See [docs/DATABASE.md](docs/DATABASE.md) for the current schema and integration boundary.

## Documentation

- docs/PRODUCT_VISION.md
- docs/ARCHITECTURE.md
- docs/SECURITY_MODEL.md
- docs/ROADMAP.md
- docs/IMPLEMENTATION_STATUS.md
- docs/DATABASE.md

## License

All rights reserved. Licensing will be decided before public distribution.
