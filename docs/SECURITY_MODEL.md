# EduManager — Security and Privacy Baseline

This document defines minimum expectations for the first implementation. It is not a substitute for a formal security review before launch.

## Identity and sessions

- Use established password hashing (Argon2id or a maintained equivalent).
- Use secure, HttpOnly, SameSite cookies for browser sessions.
- Enforce HTTPS in production.
- Rotate session identifiers after login and privilege changes.
- Provide logout, session revocation, and account recovery flows.
- Rate-limit authentication and recovery endpoints.
- Never log passwords, session tokens, one-time codes, or secrets.
- A provider-neutral API authentication adapter must verify credentials server-side and resolve an active global user from trusted persistence.
- The adapter must not trust user IDs, roles, school IDs, or tenant claims supplied through headers, query parameters, request bodies, or hostnames.
- The API validates the adapter result and retains only the active global user ID. School membership and tenant context must be resolved separately from trusted records.
- If no adapter is configured or its result is invalid/inactive, protected endpoints deny access. Do not add a permissive development fallback.
- A school ID in a route path is only a requested scope. Resolve membership using the authenticated global user ID and trusted user, school and membership records; never accept a client-supplied role or membership ID.
- The API must reject a tenant context unless its user and school IDs match the authenticated principal and requested scope, and its membership ID and role are valid. If the membership resolver is absent, the route remains unavailable rather than granting access.

## Authorisation

- Deny by default.
- Check school membership and permission on the server for every tenant-scoped request.
- Scope every query and mutation to the authorised school.
- Check record-level relationships for student and guardian access.
- A guardian must only see dependants explicitly linked and approved by the school.
- A teacher must only access assigned classes/subjects and permitted academic periods.
- Platform operator permissions must be narrow and separately audited.

## Student privacy

Student records are sensitive. Collect only what the school needs for the stated purpose. Avoid exposing student names, dates of birth, contacts, results, or documents in public URLs, analytics, logs, or error messages.

Result links must require authentication or use a carefully designed, expiring, revocable access mechanism. Guessable student identifiers are not access credentials.

## Auditability

Record security-relevant actions, including:
- User and role changes.
- Student and guardian record changes.
- Attendance corrections.
- Mark entry, approval, publication, and correction.
- Fee adjustments, payment reversals, and receipt changes.
- School-domain changes and privileged support access.

Audit entries should identify actor, school, action, target, timestamp, and a safe summary of the change. Avoid copying unnecessary personal data into audit logs.

## Data protection

- Keep secrets in deployment environment variables or a secret manager.
- Never commit production credentials or private keys.
- Encrypt transport and use managed encrypted storage where available.
- Back up the database and periodically test restoration.
- Define retention and deletion policies before onboarding real students.
- Provide a school data export process and a controlled tenant offboarding process.

## Security test cases

At minimum, automated tests must prove:
1. A user from School A cannot read School B's students.
2. A user from School A cannot create or modify records under School B by changing request payloads.
3. A teacher cannot edit marks outside assigned classes/subjects.
4. A guardian cannot access a student who is not linked to their account.
5. A disabled or removed membership immediately loses access.
6. A school admin cannot grant platform-level privileges.
7. An unverified custom domain cannot route users into a school workspace.
8. Replayed payment callbacks do not create duplicate payments.

Any failure in tenant isolation is a release blocker.
