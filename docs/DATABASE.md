# EduManager database foundation

## Supabase project

- Provider: Supabase
- Database: PostgreSQL 17
- Project reference: `rtcpeatxwuisefdymocp`
- Region: `eu-west-1`
- Project status at verification: `ACTIVE_HEALTHY`

The project URL is stored in `.env.example`. Database passwords and privileged API keys are not stored in this repository.

## Initial schema

Migration: `20261111174756_initial_school_tenancy_foundation.sql`

| Table | Purpose |
|---|---|
| `users` | Global application user profile; authentication-provider mapping remains pending |
| `schools` | School tenant and lifecycle state |
| `school_memberships` | User membership and school-scoped role/status |
| `school_domains` | Unique school hostnames and verification lifecycle |
| `audit_events` | Initial audit-event storage structure |

The migration adds constraints for role/status values, unique school slugs, one membership per user per school, unique hostnames and one primary domain per school. It also adds common lookup indexes and update timestamps for mutable records.

## Access boundary

RLS is enabled on all five tables. The migration revokes table privileges from `PUBLIC`, `anon` and `authenticated`, and grants table access to Supabase `service_role` only. No user-facing RLS policies exist yet.

This is a deliberate locked state, not a completed authorization implementation. Do not add real student or school data until all of the following exist:

1. A chosen authentication architecture and a secure mapping from authenticated identities to `public.users`.
2. A runtime database access strategy that preserves the caller's identity and tenant context.
3. RLS policies for school membership and tenant-owned records.
4. API-level authorization on every read and write.
5. Tests proving School A cannot read, create, update, delete or link records belonging to School B.
6. A restricted runtime credential. Do not use a service-role key in browser code or treat it as a user's authorization.

Migrations may use privileged database credentials in a controlled deployment environment. Application runtime credentials must be separate from migration credentials.

## Important modelling decisions

- A student is a school record, not necessarily a login account. Student profiles and login identities must remain separate.
- A guardian may be linked to multiple students. The link must be school-scoped and verified by the school.
- Teacher access must be derived from active teacher assignments, class/subject scope and the relevant academic period.
- School-owned records must carry `school_id` or be attached through a parent record with an enforceable school-scoped relationship.
- Use composite foreign keys such as `(school_id, student_id)` when modelling relationships between school-owned records.
- A hostname identifies a candidate tenant only. It is never proof of identity or authorization.

## Next database milestones

1. Decide Supabase Auth versus the existing proposed server-managed session architecture.
2. Design the secure identity mapping and runtime access strategy.
3. Add academic-year, term, class, student, guardian-link, staff and teacher-assignment tables.
4. Add RLS and database-level tenant isolation tests before connecting school-data routes.
5. Add backups, restore verification, audit retention and operational monitoring before pilot use.
