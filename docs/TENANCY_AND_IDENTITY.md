# Tenancy and identity foundation

EduManager is multi-tenant: each school is a tenant. A person may belong to multiple schools, and each membership carries its own school-scoped role.

## Identity model
- User: platform login identity.
- School: institution and lifecycle.
- School membership: user-to-school relationship, role and status.
- School domain: exact hostname mapped to one school.
- Platform owner: separate privileged platform role, never a school role.

## Request resolution
1. Read the hostname from the trusted server request. A client-supplied school ID is never proof of tenant identity.
2. Resolve a platform subdomain against the configured base domain.
3. Resolve custom domains only through an exact active and verified database mapping.
4. Authenticate the user independently of the hostname.
5. Load an active membership for that user and school.
6. Build a server-side tenant context from trusted records.
7. Scope every school-owned query to the context school ID. Missing tenant or membership fails closed.

## Authorization
- Roles belong to memberships, not global user records.
- Suspended memberships and schools cannot access school data.
- Guardians are linked to specific student records; teachers are linked to assigned classes and subjects for an academic period; students can access their own records only when an optional portal account is explicitly linked.
- Platform-owner access is a separate, audited privileged path.

## Data isolation
Every school-owned row must carry a non-null school_id. Foreign keys must prevent cross-school references. PostgreSQL row-level security may provide defence in depth, but does not replace server-side authorization and scoped queries.

## Domain safety
Platform subdomains use a configured base domain. Custom domains require ownership verification, TLS readiness and an exact active mapping. Host parsing rejects malformed values, ports, paths and unexpected nested subdomains. Reverse-proxy trust must be configured narrowly; do not blindly trust forwarded-host headers.

## Authentication adapter boundary

The API exposes a protected `GET /api/v1/me` endpoint behind an injected, provider-neutral authentication adapter. The adapter is the only source of an authenticated principal. Its result is runtime-validated and reduced to an active global user ID; tenant IDs, school roles and permissions are deliberately discarded at this boundary.

An adapter implementation must verify a signed or opaque session/token server-side and resolve the active user from trusted persistence. It must not treat request headers, query parameters, body fields, hostnames or client-supplied school IDs as identity. If no adapter is configured, or the adapter returns a malformed or inactive principal, the endpoint denies access with 401.

The current server entry point does not configure an adapter, so `/api/v1/me` remains closed by default. No authentication provider, session issuance, session revocation or account recovery flow has been selected or implemented. School membership and tenant context remain separate server-side checks after authentication.

## Tenant membership resolver boundary

The API also defines an injected tenant-context resolver for protected `GET /api/v1/schools/:schoolId/context`. The route first requires an authenticated global user, then passes only that user ID and the requested path school ID to the resolver. The path value selects the requested scope; it is not proof of access and cannot override the authenticated identity.

A resolver implementation must load the user, school and membership from trusted persistence, verify that all are active and agree, and construct the context using the shared `buildTenantRequestContext` policy. The API independently checks that the returned user and school IDs match the authenticated principal and requested scope, that the membership ID is nonblank, and that the role is in the shared school-role vocabulary. Unknown resolver fields are discarded.

No resolver is configured in the server entry point. The route returns 503 until a trusted resolver is supplied, 401 without authentication, and 403 for a malformed or mismatched context. This is an integration seam only: it does not query the database, establish RLS, or authorize school-data routes.

## Current boundary
The hostname resolver is a pure function for platform subdomains and does not query a database. The injected authentication adapter is a separate identity boundary; neither component currently resolves school memberships or custom-domain mappings. Custom-domain resolution remains database-backed future work.

## Acceptance criteria before school data routes ship
- Cross-tenant access tests for every school-owned resource.
- Multi-school users cannot mix records between schools.
- Missing, invited, suspended or revoked memberships are denied.
- Hostname spoofing and unverified custom domains are rejected.
- Database constraints prevent cross-school foreign-key relationships.
- Authorization and privileged access are audit logged.

## Initial authorization policy

The shared contracts package contains a fail-closed membership check. It requires an active user, active school, active membership, and exact agreement between the authenticated user, requested school and membership record.

The first coarse role-permission matrix is also defined:
- School administrators manage school settings, users and core school operations.
- School staff handle approved day-to-day student, attendance, academic and finance-read workflows.
- Teachers work with academic and attendance workflows, but cannot manage users or school finance.
- Students and guardians receive only a generic self-portal permission at this stage.

A role grant is not sufficient to expose a specific student's record. Guardian-student relationships, teacher-class assignments and student-self identity must be checked separately on each relevant resource. The current policy is a starting baseline for review, not a complete production authorization system.

## Trusted tenant context and resource relationships

The API policy package includes a context builder that accepts an authenticated user ID plus server-loaded user, school and membership records. It returns a tenant context only when the user, school and membership are all active and their IDs agree. A context must never be constructed from a client-supplied school or membership ID alone.

Student-record checks match relationship records against all relevant identifiers:
- Guardian link: active status, guardian user ID, student record ID and school ID must all match.
- Teacher access: active teacher/class/subject/academic-period assignment must match an active student enrolment in the same school, class and academic period.
- Student self-access: the authenticated account must have an explicit active portal-account link to the student record. The student record itself does not require or embed a user ID.
- Admin/staff access: the role must hold the corresponding student permission.

These functions accept relationship collections supplied by trusted server-side, tenant-scoped data queries. They do not perform database queries themselves. Production route middleware and database-backed relationship repositories remain future work.
