import type { RuntimeDatabaseRoleInspector } from "./database-runtime-role-safety.js";

/**
 * Minimal server-only PostgreSQL query boundary. The application supplies an
 * already-configured executor; this adapter never opens a connection or reads
 * credentials itself.
 */
export interface PostgresRuntimeRoleQueryExecutor {
  query(sql: string, values: unknown[]): Promise<{ rows: unknown[] }>;
}

/**
 * PostgreSQL 16+ role-membership inspection, targeting the repository's
 * documented PostgreSQL 17 database.
 *
 * session_user is the login identity that determines SET ROLE membership.
 * current_user is included explicitly because a pool may establish a role
 * before handing a connection to the application. For each role the session
 * can SET ROLE to, USAGE checks detect owner privileges inherited by that role.
 *
 * Required table names are supplied as a parameter, never interpolated as SQL.
 * Missing or non-table relations are omitted so the safety contract rejects
 * incomplete metadata.
 */
export const POSTGRES_RUNTIME_ROLE_INSPECTION_SQL = `
  WITH settable_roles AS MATERIALIZED (
    SELECT
      role.oid,
      role.rolname,
      role.rolsuper,
      role.rolbypassrls
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = current_user
       OR role.rolname = session_user
       OR pg_catalog.pg_has_role(session_user, role.oid, 'SET')
  ),
  tenant_tables AS (
    SELECT
      requested.qualified_name,
      relation.relrowsecurity,
      table_owner.rolname AS owner_role,
      EXISTS (
        SELECT 1
        FROM settable_roles AS settable
        WHERE settable.oid = table_owner.oid
           OR pg_catalog.pg_has_role(settable.oid, table_owner.oid, 'USAGE')
      ) AS runtime_can_use_owner_privileges
    FROM unnest($1::text[]) AS requested(qualified_name)
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.nspname = pg_catalog.split_part(requested.qualified_name, '.', 1)
    JOIN pg_catalog.pg_class AS relation
      ON relation.relnamespace = namespace.oid
     AND relation.relname = pg_catalog.split_part(requested.qualified_name, '.', 2)
     AND relation.relkind IN ('r', 'p')
    JOIN pg_catalog.pg_roles AS table_owner
      ON table_owner.oid = relation.relowner
  )
  SELECT
    current_user::text AS role_name,
    COALESCE(
      (
        SELECT pg_catalog.json_agg(
          pg_catalog.json_build_object(
            'name', settable.rolname,
            'isSuperuser', settable.rolsuper,
            'bypassesRowLevelSecurity', settable.rolbypassrls
          ) ORDER BY settable.rolname
        )
        FROM settable_roles AS settable
      ),
      '[]'::pg_catalog.json
    ) AS settable_roles,
    COALESCE(
      (
        SELECT pg_catalog.json_agg(
          pg_catalog.json_build_object(
            'qualifiedName', table_info.qualified_name,
            'rowLevelSecurityEnabled', table_info.relrowsecurity,
            'ownerRole', table_info.owner_role,
            'runtimeCanUseOwnerPrivileges', table_info.runtime_can_use_owner_privileges
          ) ORDER BY table_info.qualified_name
        )
        FROM tenant_tables AS table_info
      ),
      '[]'::pg_catalog.json
    ) AS tenant_tables
`;

const qualifiedTablePattern = /^[a-z_][a-z0-9_$]{0,62}\.[a-z_][a-z0-9_$]{0,62}$/;

export function snapshotRequiredPostgresTenantTables(value: readonly string[]): readonly string[] {
  let names: unknown[];
  try {
    if (!Array.isArray(value)) throw new TypeError();
    names = Array.prototype.slice.call(value) as unknown[];
  } catch {
    throw new TypeError("Required tenant tables must be unique, simple schema-qualified PostgreSQL identifiers.");
  }

  if (names.length === 0
    || !names.every((name) => typeof name === "string" && qualifiedTablePattern.test(name))
    || new Set(names).size !== names.length) {
    throw new TypeError("Required tenant tables must be unique, simple schema-qualified PostgreSQL identifiers.");
  }

  return Object.freeze(names.slice() as string[]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function readInspectionRow(value: unknown): unknown {
  if (!isRecord(value)) return null;

  try {
    const roleName = value.role_name;
    const settableRoles = value.settable_roles;
    const tenantTables = value.tenant_tables;

    if (typeof roleName !== "string"
      || !Array.isArray(settableRoles)
      || !Array.isArray(tenantTables)) {
      return null;
    }

    return { roleName, settableRoles, tenantTables };
  } catch {
    return null;
  }
}

/**
 * Creates a PostgreSQL catalog inspector for a fixed, server-configured set of
 * tenant tables. The required-table list and query method are snapshotted at
 * construction so later caller mutation cannot change what is inspected.
 */
export function createPostgresRuntimeRoleInspector(
  executor: PostgresRuntimeRoleQueryExecutor,
  requiredTenantTables: readonly string[],
): RuntimeDatabaseRoleInspector {
  const tableNames = snapshotRequiredPostgresTenantTables(requiredTenantTables);

  let query: PostgresRuntimeRoleQueryExecutor["query"];
  try {
    query = executor?.query;
  } catch {
    throw new TypeError("A PostgreSQL runtime-role query executor is required.");
  }
  if (typeof query !== "function") {
    throw new TypeError("A PostgreSQL runtime-role query executor is required.");
  }

  return {
    async inspect() {
      const result = await query.call(executor, POSTGRES_RUNTIME_ROLE_INSPECTION_SQL, [
        tableNames.slice(),
      ]);

      if (!isRecord(result)) return null;

      try {
        const rows = result.rows;
        if (!Array.isArray(rows) || rows.length !== 1) return null;
        return readInspectionRow(rows[0]);
      } catch {
        return null;
      }
    },
  };
}
