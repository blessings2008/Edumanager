/**
 * Structural contract shared with createTenantContextResolver. Kept local to
 * the API source tree so the API's TypeScript rootDir does not pull contract
 * package source files into the API compilation unit.
 */
export interface PostgresTenantMembershipReader {
  loadTenantMembership(input: {
    authenticatedUserId: string;
    requestedSchoolId: string;
  }): Promise<unknown>;
}

/**
 * Minimal node-postgres-compatible query boundary. The application supplies a
 * server-only executor; this module does not create a pool or read credentials.
 */
export interface PostgresQueryExecutor {
  query(sql: string, values: unknown[]): Promise<{ rows: unknown[] }>;
}

/**
 * One SQL statement gives the reader a consistent PostgreSQL statement
 * snapshot and loads only the persisted identity and membership fields needed
 * by createTenantContextResolver. Statuses are intentionally not filtered:
 * the shared policy must see inactive records and reject them itself.
 *
 * LIMIT 2 makes an unexpected duplicate relationship fail closed, even if a
 * future schema change accidentally removes the current uniqueness constraint.
 */
export const POSTGRES_TENANT_MEMBERSHIP_SQL = `
  SELECT
    u.id::text AS user_id,
    u.status AS user_status,
    s.id::text AS school_id,
    s.status AS school_status,
    m.id::text AS membership_id,
    m.user_id::text AS membership_user_id,
    m.school_id::text AS membership_school_id,
    m.role AS membership_role,
    m.status AS membership_status
  FROM public.users AS u
  JOIN public.schools AS s
    ON s.id = $2::uuid
  JOIN public.school_memberships AS m
    ON m.user_id = u.id
   AND m.school_id = s.id
  WHERE u.id = $1::uuid
  LIMIT 2
`;

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Creates a provider-independent membership reader for a PostgreSQL executor.
 *
 * The executor must be server-only and configured with a credential suitable
 * for this narrowly scoped lookup. Do not expose it to the browser or reuse a
 * privileged/bypass-RLS connection for tenant-owned application queries.
 */
export function createPostgresTenantMembershipReader(
  executor: PostgresQueryExecutor,
): PostgresTenantMembershipReader {
  return {
    async loadTenantMembership(input) {
      if (!isCanonicalUuid(input.authenticatedUserId)
        || !isCanonicalUuid(input.requestedSchoolId)) return null;

      const result = await executor.query(POSTGRES_TENANT_MEMBERSHIP_SQL, [
        input.authenticatedUserId,
        input.requestedSchoolId,
      ]);

      if (!result || !Array.isArray(result.rows) || result.rows.length !== 1) return null;
      const row = result.rows[0];
      if (!isRecord(row)) return null;

      return {
        user: {
          id: row.user_id,
          status: row.user_status,
        },
        school: {
          id: row.school_id,
          status: row.school_status,
        },
        membership: {
          id: row.membership_id,
          userId: row.membership_user_id,
          schoolId: row.membership_school_id,
          role: row.membership_role,
          status: row.membership_status,
        },
      };
    },
  };
}
