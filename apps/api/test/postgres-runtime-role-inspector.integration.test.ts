import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Client } from "pg";
import {
  assertSafeTenantDatabaseRole,
  RuntimeDatabaseRoleSafetyError,
} from "../src/persistence/database-runtime-role-safety.js";
import {
  createPostgresRuntimeRoleInspector,
  type PostgresRuntimeRoleQueryExecutor,
} from "../src/persistence/postgres-runtime-role-inspector.js";

const connectionString = process.env.EDUMANAGER_POSTGRES_TEST_URL;
const tableNames = ["users", "schools", "school_memberships"] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function withRuntimeInspector(
  runtimeRole: string,
  password: string,
  requiredTables: readonly string[],
  work: (inspector: ReturnType<typeof createPostgresRuntimeRoleInspector>) => Promise<void>,
  setRole?: string,
): Promise<void> {
  if (!connectionString) throw new Error("PostgreSQL integration test URL is not configured.");

  const client = new Client({
    connectionString,
    user: runtimeRole,
    password,
  });
  await client.connect();

  try {
    if (setRole) {
      await client.query(`SET ROLE ${quoteIdentifier(setRole)}`);
    }

    const executor: PostgresRuntimeRoleQueryExecutor = {
      query: async (sql, values) => {
        const result = await client.query(sql, values as unknown[]);
        return { rows: result.rows };
      },
    };
    const inspector = createPostgresRuntimeRoleInspector(executor, requiredTables);
    await work(inspector);
  } finally {
    await client.end();
  }
}

async function assertSafetyCode(
  run: () => Promise<void>,
  code: RuntimeDatabaseRoleSafetyError["code"],
): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
    assert.equal(error.code, code);
    return true;
  });
}

test("PostgreSQL 17 inspector reports real role membership, RLS and table ownership", {
  skip: !connectionString,
}, async () => {
  if (!connectionString) return;

  const suffix = randomBytes(8).toString("hex");
  const schema = `edumanager_role_test_${suffix}`;
  const runtimeRole = `edumanager_runtime_${suffix}`;
  const ownerRole = `edumanager_owner_${suffix}`;
  const intermediaryRole = `edumanager_group_${suffix}`;
  const delegatedRole = `edumanager_delegated_${suffix}`;
  const bypassRole = `edumanager_bypass_${suffix}`;
  const password = randomBytes(24).toString("hex");
  const qualifiedTables = tableNames.map((name) => `${schema}.${name}`);
  const admin = new Client({ connectionString });

  await admin.connect();

  try {
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(runtimeRole)} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`,
    );
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(ownerRole)} NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(intermediaryRole)} NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(delegatedRole)} NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(bypassRole)} NOLOGIN NOSUPERUSER BYPASSRLS`,
    );
    await admin.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);

    for (const tableName of tableNames) {
      const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
      await admin.query(`CREATE TABLE ${table} (id integer PRIMARY KEY)`);
      await admin.query(`ALTER TABLE ${table} OWNER TO ${quoteIdentifier(ownerRole)}`);
      await admin.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
    await admin.query(
      `GRANT USAGE ON SCHEMA ${quoteIdentifier(schema)} TO ${quoteIdentifier(runtimeRole)}`,
    );

    await withRuntimeInspector(runtimeRole, password, qualifiedTables, async (inspector) => {
      const snapshot = await inspector.inspect() as { roleName: string; settableRoles: Array<{ name: string }> };
      assert.equal(snapshot.roleName, runtimeRole);
      assert.ok(snapshot.settableRoles.some((role) => role.name === runtimeRole));
      await assertSafeTenantDatabaseRole(inspector, qualifiedTables);
    });

    // A pool may set a non-privileged role before handing a connection to the
    // application. The inspector must report that effective current_user too.
    await admin.query(
      `GRANT ${quoteIdentifier(delegatedRole)} TO ${quoteIdentifier(runtimeRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    await withRuntimeInspector(
      runtimeRole,
      password,
      qualifiedTables,
      async (inspector) => {
        const snapshot = await inspector.inspect() as { roleName: string; settableRoles: Array<{ name: string }> };
        assert.equal(snapshot.roleName, delegatedRole);
        assert.ok(snapshot.settableRoles.some((role) => role.name === delegatedRole));
        await assertSafeTenantDatabaseRole(inspector, qualifiedTables);
      },
      delegatedRole,
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(delegatedRole)} FROM ${quoteIdentifier(runtimeRole)}`,
    );

    // Direct SET ROLE access to a tenant-table owner must be rejected.
    await admin.query(
      `GRANT ${quoteIdentifier(ownerRole)} TO ${quoteIdentifier(runtimeRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    await assertSafetyCode(
      () => withRuntimeInspector(
        runtimeRole,
        password,
        qualifiedTables,
        (inspector) => assertSafeTenantDatabaseRole(inspector, qualifiedTables),
      ),
      "runtime_role_can_assume_table_owner",
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(ownerRole)} FROM ${quoteIdentifier(runtimeRole)}`,
    );

    // Inherited owner privileges are unsafe even when SET ROLE is disabled.
    await admin.query(
      `GRANT ${quoteIdentifier(ownerRole)} TO ${quoteIdentifier(runtimeRole)} WITH SET FALSE, INHERIT TRUE`,
    );
    await assertSafetyCode(
      () => withRuntimeInspector(
        runtimeRole,
        password,
        qualifiedTables,
        (inspector) => assertSafeTenantDatabaseRole(inspector, qualifiedTables),
      ),
      "runtime_role_inherits_table_owner",
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(ownerRole)} FROM ${quoteIdentifier(runtimeRole)}`,
    );

    // SET ROLE must be evaluated across the complete membership chain.
    await admin.query(
      `GRANT ${quoteIdentifier(ownerRole)} TO ${quoteIdentifier(intermediaryRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    await admin.query(
      `GRANT ${quoteIdentifier(intermediaryRole)} TO ${quoteIdentifier(runtimeRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    await assertSafetyCode(
      () => withRuntimeInspector(
        runtimeRole,
        password,
        qualifiedTables,
        (inspector) => assertSafeTenantDatabaseRole(inspector, qualifiedTables),
      ),
      "runtime_role_can_assume_table_owner",
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(intermediaryRole)} FROM ${quoteIdentifier(runtimeRole)}`,
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(ownerRole)} FROM ${quoteIdentifier(intermediaryRole)}`,
    );

    // A privileged role reachable through a nested SET ROLE grant is unsafe.
    await admin.query(
      `GRANT ${quoteIdentifier(bypassRole)} TO ${quoteIdentifier(intermediaryRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    await admin.query(
      `GRANT ${quoteIdentifier(intermediaryRole)} TO ${quoteIdentifier(runtimeRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    await assertSafetyCode(
      () => withRuntimeInspector(
        runtimeRole,
        password,
        qualifiedTables,
        (inspector) => assertSafeTenantDatabaseRole(inspector, qualifiedTables),
      ),
      "assumable_privileged_role",
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(intermediaryRole)} FROM ${quoteIdentifier(runtimeRole)}`,
    );
    await admin.query(
      `REVOKE ${quoteIdentifier(bypassRole)} FROM ${quoteIdentifier(intermediaryRole)}`,
    );

    const firstTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableNames[0])}`;
    await admin.query(`ALTER TABLE ${firstTable} DISABLE ROW LEVEL SECURITY`);
    await assertSafetyCode(
      () => withRuntimeInspector(
        runtimeRole,
        password,
        qualifiedTables,
        (inspector) => assertSafeTenantDatabaseRole(inspector, qualifiedTables),
      ),
      "tenant_rls_disabled",
    );
    await admin.query(`ALTER TABLE ${firstTable} ENABLE ROW LEVEL SECURITY`);

    const lastTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableNames[2])}`;
    await admin.query(`DROP TABLE ${lastTable}`);
    await assertSafetyCode(
      () => withRuntimeInspector(
        runtimeRole,
        password,
        qualifiedTables,
        (inspector) => assertSafeTenantDatabaseRole(inspector, qualifiedTables),
      ),
      "missing_tenant_table",
    );
  } finally {
    for (const [grantedRole, memberRole] of [
      [ownerRole, runtimeRole],
      [ownerRole, intermediaryRole],
      [intermediaryRole, runtimeRole],
      [delegatedRole, runtimeRole],
      [bypassRole, intermediaryRole],
    ]) {
      await admin.query(
        `REVOKE ${quoteIdentifier(grantedRole)} FROM ${quoteIdentifier(memberRole)}`,
      ).catch(() => undefined);
    }

    await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`).catch(() => undefined);
    await admin.query(
      `DROP ROLE IF EXISTS ${quoteIdentifier(runtimeRole)}, ${quoteIdentifier(ownerRole)}, ${quoteIdentifier(intermediaryRole)}, ${quoteIdentifier(delegatedRole)}, ${quoteIdentifier(bypassRole)}`,
    ).catch(() => undefined);
    await admin.end();
  }
});
