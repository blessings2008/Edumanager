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
 * Creates the shared membership-reader contract implementation for any PostgreSQL executor.
 *
 * The executor must be server-only and configured with a credential suitable
 * for this narrowly scoped lookup. Do not expose it to the browser or reuse a
 * privileged/bypass-RLS connection for tenant-owned application queries.
 */
function snapshotQueryExecutor(
  executor: PostgresQueryExecutor,
): (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }> {
  let query: PostgresQueryExecutor["query"];
  try {
    query = executor.query;
  } catch {
    throw new TypeError("A PostgreSQL membership query executor is required.");
  }

  if (typeof query !== "function") {
    throw new TypeError("A PostgreSQL membership query executor is required.");
  }

  // Capture the operation once but preserve the executor as its receiver.
  return (sql, values) => query.call(executor, sql, values);
}

export function createPostgresTenantMembershipReader(
  executor: PostgresQueryExecutor,
): PostgresTenantMembershipReader {
  const query = snapshotQueryExecutor(executor);

  return {
    async loadTenantMembership(input) {
      let authenticatedUserId: unknown;
      let requestedSchoolId: unknown;
      try {
        authenticatedUserId = input.authenticatedUserId;
        requestedSchoolId = input.requestedSchoolId;
      } catch {
        return null;
      }

      if (!isCanonicalUuid(authenticatedUserId)
        || !isCanonicalUuid(requestedSchoolId)) return null;

      const result = await query(POSTGRES_TENANT_MEMBERSHIP_SQL, [
        authenticatedUserId,
        requestedSchoolId,
      ]);

      try {
        if (!isRecord(result)) return null;
        const rows = result.rows;
        if (!Array.isArray(rows) || rows.length !== 1) return null;

        const row = rows[0];
        if (!isRecord(row)) return null;

        // Detach every persisted value once before returning the snapshot.
        const userId = row.user_id;
        const userStatus = row.user_status;
        const schoolId = row.school_id;
        const schoolStatus = row.school_status;
        const membershipId = row.membership_id;
        const membershipUserId = row.membership_user_id;
        const membershipSchoolId = row.membership_school_id;
        const membershipRole = row.membership_role;
        const membershipStatus = row.membership_status;

        return {
          user: { id: userId, status: userStatus },
          school: { id: schoolId, status: schoolStatus },
          membership: {
            id: membershipId,
            userId: membershipUserId,
            schoolId: membershipSchoolId,
            role: membershipRole,
            status: membershipStatus,
          },
        };
      } catch {
        // Accessor-backed or malformed driver results fail closed.
        return null;
      }
    },
  };
}
