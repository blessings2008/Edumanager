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

## Important architecture note

The database, ORM and migration strategy are intentionally not wired in yet. We will confirm the database and hosting choices before creating the production data model. Tenant isolation will be enforced in the API and database, not only in the frontend.

## Documentation

- docs/PRODUCT_VISION.md
- docs/ARCHITECTURE.md
- docs/SECURITY_MODEL.md
- docs/ROADMAP.md
- docs/IMPLEMENTATION_STATUS.md

## License

All rights reserved. Licensing will be decided before public distribution.
