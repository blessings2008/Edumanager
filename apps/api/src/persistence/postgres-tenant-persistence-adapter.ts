import { createTenantContextResolver } from "../../../../packages/contracts/src/authorization.js";
import type { TenantContextResolver } from "../domain/tenant-authorization.js";
import {
  createPostgresRuntimeRoleInspector,
  type PostgresRuntimeRoleQueryExecutor,
} from "./postgres-runtime-role-inspector.js";
import {
  createPostgresTenantMembershipReader,
  type PostgresQueryExecutor,
} from "./postgres-tenant-membership-reader.js";

/**
 * One server-only query executor supplied by the application composition root.
 * It may represent a database client or a pool, but must use one consistent,
 * least-privilege runtime configuration for every query it dispatches.
 */
export interface PostgresTenantPersistenceQueryExecutor
  extends PostgresQueryExecutor, PostgresRuntimeRoleQueryExecutor {}

/** Shape accepted by Fastify's provider-neutral tenant persistence boundary. */
export interface PostgresTenantPersistenceAdapter {
  resolveTenantContext: TenantContextResolver;
  inspectDatabaseRole(): Promise<unknown>;
  requiredTenantTables: readonly string[];
}

function snapshotQueryExecutor(
  value: PostgresTenantPersistenceQueryExecutor,
): PostgresTenantPersistenceQueryExecutor {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("A PostgreSQL tenant persistence query executor is required.");
  }

  let query: PostgresTenantPersistenceQueryExecutor["query"];
  try {
    query = value.query;
  } catch {
    throw new TypeError("A PostgreSQL tenant persistence query executor is required.");
  }

  if (typeof query !== "function") {
    throw new TypeError("A PostgreSQL tenant persistence query executor is required.");
  }

  // Both adapters receive this same immutable facade. The original query
  // function and receiver are captured once, so later property replacement
  // cannot send membership reads and role inspection to different executors.
  return Object.freeze({
    query(sql: string, values: unknown[]) {
      return query.call(value, sql, values);
    },
  });
}

function snapshotRequiredTenantTables(value: readonly string[]): readonly string[] {
  let names: unknown[];
  try {
    if (!Array.isArray(value)) throw new TypeError();
    names = Array.prototype.slice.call(value) as unknown[];
  } catch {
    throw new TypeError("Required tenant tables must be a readable array of table names.");
  }

  if (names.length === 0 || !names.every((name) => typeof name === "string")) {
    throw new TypeError("Required tenant tables must be a non-empty array of table names.");
  }

  return Object.freeze(names as string[]);
}

/**
 * Compose PostgreSQL membership resolution and runtime-role inspection over
 * one snapshotted query executor.
 *
 * This factory does not create a pool, read credentials, provision roles, or
 * configure the API server. The caller remains responsible for supplying a
 * server-only executor whose connections use consistent restricted runtime
 * credentials and initialization.
 */
export function createPostgresTenantPersistenceAdapter(
  executor: PostgresTenantPersistenceQueryExecutor,
  requiredTenantTables: readonly string[],
): PostgresTenantPersistenceAdapter {
  const sharedExecutor = snapshotQueryExecutor(executor);
  const tableNames = snapshotRequiredTenantTables(requiredTenantTables);

  const membershipReader = createPostgresTenantMembershipReader(sharedExecutor);
  const resolveMembership = createTenantContextResolver(membershipReader);
  const roleInspector = createPostgresRuntimeRoleInspector(sharedExecutor, tableNames);

  const resolveTenantContext: TenantContextResolver = (input) => resolveMembership(input);
  const inspectDatabaseRole = () => roleInspector.inspect();

  return Object.freeze({
    resolveTenantContext,
    inspectDatabaseRole,
    requiredTenantTables: tableNames,
  });
}
