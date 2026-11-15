import {
  TENANT_SCHOOL_ROLES,
  type TenantRequestContext,
} from "../domain/tenant-authorization.js";

/**
 * Minimal node-postgres-compatible checked-out connection contract.
 * Keeping this structural avoids coupling the domain adapter to a pool package.
 */
export interface TenantTransactionConnection {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  release(error?: Error): void;
}

export interface TenantTransactionPool {
  connect(): Promise<TenantTransactionConnection>;
}

/**
 * These values are transaction-local PostgreSQL settings for future RLS
 * policies. The role is deliberately not copied into a setting: policies
 * must derive permissions from persisted school membership records.
 */
export const SET_TENANT_TRANSACTION_CONTEXT_SQL = `
  SELECT
    set_config('app.user_id', $1, true),
    set_config('app.school_id', $2, true),
    set_config('app.membership_id', $3, true)
`;

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isTenantRequestContext(value: unknown): value is TenantRequestContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return isNonBlankString(candidate.userId)
    && isNonBlankString(candidate.schoolId)
    && isNonBlankString(candidate.membershipId)
    && typeof candidate.role === "string"
    && TENANT_SCHOOL_ROLES.includes(candidate.role as TenantRequestContext["role"]);
}

/**
 * Executes tenant-owned database work on one checked-out connection.
 *
 * The validated context is installed with set_config(..., true) after BEGIN,
 * so PostgreSQL clears it automatically at COMMIT or ROLLBACK before the
 * connection returns to the pool. This helper does not itself enforce RLS:
 * the pool must use a least-privilege role without SUPERUSER/BYPASSRLS, and
 * tenant tables must have policies that validate these settings.
 */
export async function withTenantTransaction<T>(
  pool: TenantTransactionPool,
  context: TenantRequestContext,
  work: (connection: TenantTransactionConnection) => Promise<T>,
): Promise<T> {
  if (!isTenantRequestContext(context)) {
    throw new TypeError("A validated tenant request context is required.");
  }

  const connection = await pool.connect();
  let transactionOpen = false;
  let releaseError: Error | undefined;

  try {
    await connection.query("BEGIN");
    transactionOpen = true;

    await connection.query(SET_TENANT_TRANSACTION_CONTEXT_SQL, [
      context.userId,
      context.schoolId,
      context.membershipId,
    ]);

    const result = await work(connection);
    await connection.query("COMMIT");
    transactionOpen = false;
    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.query("ROLLBACK");
      } catch (rollbackError) {
        // Preserve the original failure, but discard a connection whose
        // transaction state could not be reset safely.
        releaseError = rollbackError instanceof Error
          ? rollbackError
          : new Error("Tenant transaction rollback failed.");
      }
    }
    throw error;
  } finally {
    connection.release(releaseError);
  }
}
