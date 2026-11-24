import type { TenantRequestContext } from "../domain/tenant-authorization.js";
import { assertSafeTenantDatabaseRole } from "./database-runtime-role-safety.js";
import {
  createPostgresRuntimeRoleInspector,
  snapshotRequiredPostgresTenantTables,
  type PostgresRuntimeRoleQueryExecutor,
} from "./postgres-runtime-role-inspector.js";
import {
  withTenantTransaction,
  type TenantTransactionConnection,
  type TenantTransactionExecutor,
  type TenantTransactionPool,
} from "./tenant-transaction.js";

export interface PostgresVerifiedTenantTransactionRunner {
  run<T>(
    context: TenantRequestContext,
    work: (executor: TenantTransactionExecutor) => Promise<T>,
  ): Promise<T>;
}

function toReleaseError(value: unknown): Error {
  return value instanceof Error
    ? value
    : new Error("PostgreSQL tenant connection could not be verified.");
}

/**
 * Capture the checked-out connection methods once and preserve their receiver.
 * The same frozen lease is used for catalog inspection and tenant work, so a
 * mutable pool/client wrapper cannot swap the query implementation after the
 * safety check.
 */
function snapshotConnection(
  connection: TenantTransactionConnection,
): TenantTransactionConnection {
  let release: TenantTransactionConnection["release"];
  try {
    release = connection.release;
  } catch (error) {
    throw error;
  }

  if (typeof release !== "function") {
    throw new TypeError("A PostgreSQL tenant connection is required.");
  }

  let query: TenantTransactionConnection["query"];
  try {
    query = connection.query;
  } catch (error) {
    try {
      release.call(connection, toReleaseError(error));
    } catch {
      // Preserve the original connection-access failure.
    }
    throw error;
  }

  if (typeof query !== "function") {
    const error = new TypeError("A PostgreSQL tenant connection is required.");
    try {
      release.call(connection, error);
    } catch {
      // Preserve the invalid-connection failure.
    }
    throw error;
  }

  const lease: TenantTransactionConnection = {
    query: (sql, values) => query.call(connection, sql, values),
    release: (error) => release.call(connection, error),
  };

  return Object.freeze(lease);
}

function createConnectionInspector(
  connection: TenantTransactionConnection,
  requiredTenantTables: readonly string[],
) {
  const executor: PostgresRuntimeRoleQueryExecutor = Object.freeze({
    async query(sql: string, values: unknown[]) {
      const result = await connection.query(sql, values);

      try {
        if (typeof result !== "object" || result === null || Array.isArray(result)) {
          return { rows: [] };
        }

        const rows = (result as Record<string, unknown>).rows;
        return Array.isArray(rows) ? { rows } : { rows: [] };
      } catch {
        // Malformed driver results become an invalid snapshot and fail closed.
        return { rows: [] };
      }
    },
  });

  return createPostgresRuntimeRoleInspector(executor, requiredTenantTables);
}

/**
 * Creates a runner that inspects each physical PostgreSQL connection on
 * checkout, immediately before that connection can begin tenant work.
 *
 * Inspection and the tenant transaction use the same captured connection
 * methods. A failed or malformed inspection discards the lease and never
 * invokes the repository callback. The pool itself remains private to this
 * runner; callers receive only the transaction-scoped query executor.
 *
 * This is per-checkout verification, not proactive enumeration of idle pool
 * connections. It adds one catalog inspection query per tenant transaction.
 * The application must still configure a least-privilege pool and correct RLS
 * policies; this factory does not wire production credentials or prove policy
 * expressions or cross-school data isolation.
 */
export function createPostgresVerifiedTenantTransactionRunner(
  pool: TenantTransactionPool,
  requiredTenantTables: readonly string[],
): PostgresVerifiedTenantTransactionRunner {
  const tableNames = snapshotRequiredPostgresTenantTables(requiredTenantTables);

  let connect: TenantTransactionPool["connect"];
  try {
    connect = pool?.connect;
  } catch {
    throw new TypeError("A PostgreSQL tenant transaction pool is required.");
  }

  if (typeof connect !== "function") {
    throw new TypeError("A PostgreSQL tenant transaction pool is required.");
  }

  const verifiedPool: TenantTransactionPool = Object.freeze({
    async connect() {
      const rawConnection = await connect.call(pool);
      const connection = snapshotConnection(rawConnection);

      try {
        const inspector = createConnectionInspector(connection, tableNames);
        await assertSafeTenantDatabaseRole(inspector, tableNames);
        return connection;
      } catch (error) {
        try {
          connection.release(toReleaseError(error));
        } catch {
          // Preserve the inspection failure; the connection must not be reused.
        }
        throw error;
      }
    },
  });

  return Object.freeze({
    run<T>(
      context: TenantRequestContext,
      work: (executor: TenantTransactionExecutor) => Promise<T>,
    ): Promise<T> {
      // withTenantTransaction snapshots the validated tenant context before
      // it awaits verifiedPool.connect().
      return withTenantTransaction(verifiedPool, context, work);
    },
  });
}
