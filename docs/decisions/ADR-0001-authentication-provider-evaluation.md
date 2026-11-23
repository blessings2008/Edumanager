# ADR-0001: Authentication provider evaluation

- **Status:** Proposed evaluation plan; no provider selected
- **Date:** 2026-11-23
- **Decision owner:** Founder
- **Scope:** Global user authentication and browser session lifecycle for EduManager

## Context

The API currently exposes a provider-neutral `AuthenticationAdapter` seam. The server entry point does not configure an adapter, credential verifier, session lifecycle or persisted identity mapping, so protected identity routes intentionally fail closed. School membership and school roles are resolved separately from trusted school records.

The product specification requires a global user identity that can belong to multiple schools, with school-scoped memberships and permissions. A school ID, hostname, request header, query parameter or client payload must never establish identity or membership.

The database foundation currently uses Supabase-hosted PostgreSQL, but that does not by itself decide which authentication provider or session model should be used. Supabase Auth is a candidate, not an approved decision.

## Decision

**Do not select or integrate an authentication provider in this change.** Run a bounded architecture spike and return a recommendation to the Founder. Keep the API authentication contract provider-neutral until the Founder approves the provider and session design.

## Options to evaluate

1. **Supabase Auth:** evaluate server-side access-token verification, refresh/session behaviour, account recovery, invitation flows, email verification, revocation and the mapping from provider subject to the global `users` record.
2. **External managed OIDC provider:** evaluate standards-based issuer/audience/signature validation, key rotation, logout/revocation semantics, account lifecycle, operational dependency and integration with the current PostgreSQL identity mapping.
3. **Self-hosted identity service:** evaluate operational burden, patching, key/session management, recovery flows, availability and whether the small operating team can safely maintain it.

No option is preferred by this ADR.

## Required spike and acceptance criteria

The spike must document and demonstrate, without exposing real student data:

- Server-side verification of issuer, audience, signature, expiry and not-before claims; reject unsigned, malformed, expired and wrong-audience credentials.
- A stable provider-subject-to-global-user mapping with uniqueness constraints; email address alone must not be treated as a durable identity key.
- Explicit account lifecycle handling for disabled users, revoked sessions, recovery, invitation acceptance and verified email where applicable.
- Browser session strategy using Secure, HttpOnly cookies, an appropriate SameSite policy, CSRF protection for state-changing requests, and safe logout/refresh behaviour. If bearer tokens are proposed instead, document storage and XSS exposure trade-offs.
- Key rotation, provider outage, clock skew, token replay and session revocation behaviour.
- No tenant ID, school role, membership ID, permission or entitlement accepted from provider claims as a substitute for trusted school persistence.
- Generic client-facing authentication errors; secrets and provider internals must not appear in responses or routine logs.
- Tests proving unauthenticated, disabled, revoked, malformed and cross-user identity cases fail closed.
- A documented local-development and production configuration model that keeps credentials server-side and separates runtime from migration privileges.

## Security and integration constraints

- The authentication adapter must return only the validated active global user identity required by the API.
- Membership resolution remains a separate server-side step using the authenticated global user ID and requested school selector.
- The hostname and path school ID are selectors only, never authorization.
- Student records remain independent of optional student login accounts. Guardian access requires explicit school-scoped guardian/student links; teacher access requires explicit school-scoped assignments and matching enrolment.
- Do not wire school-data routes or enable browser database access until the least-privilege runtime role, tenant-aware RLS and live two-school isolation tests pass.
- Do not apply the pending schema-alignment migration or change production credentials as part of the spike.

## Consequences

The current provider-neutral adapter and fail-closed route behaviour remain in place. Authentication integration remains pending until the Founder reviews the spike, approves a provider/session decision, and a separate implementation change adds the verifier, identity mapping, lifecycle flows and tests.
