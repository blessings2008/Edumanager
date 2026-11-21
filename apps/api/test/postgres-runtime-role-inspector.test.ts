import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeTenantDatabaseRole,
  RuntimeDatabaseRoleSafetyError,
} from "../src/persistence/database-runtime-role-safety.js";
import {
  createPostgresRuntimeRoleInspector,
  POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
} from "../src/persistence/postgres-runtime-role-inspector.js";

const requiredTables = [
  "public.users",
  "public.schools",
  "public.school_memberships",
];

const safeRows = [{
  role_name: "edumanager_runtime",
  settable_roles: [{
    name: "edumanager_runtime",
    isSuperuser: false,
    bypassesRowLevelSecurity: false,
  }],
  tenant_tables: requiredTables.map((qualifiedName) => ({
    qualifiedName,
    rowLevelSecurityEnabled: true,
    ownerRole: "edumanager_migrator",
    runtimeCanUseOwnerPrivileges: false,
  })),
}];

async function assertSafetyCode(
  run: () => Promise<void>,
  code: RuntimeDatabaseRoleSafetyError["code"],
): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
    assert.equal(error.code, code);
    assert.equal(error.message, "Database runtime role failed tenant-isolation safety checks.");
    return true;
  });
}

test("PostgreSQL inspector uses one parameterized catalog query and returns the safety snapshot", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const inspector = createPostgresRuntimeRoleInspector({
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: safeRows };
    },
  }, requiredTables);

  assert.deepEqual(await inspector.inspect(), {
    roleName: "edumanager_runtime",
    settableRoles: safeRows[0].settable_roles,
    tenantTables: safeRows[0].tenant_tables,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, POSTGRES_RUNTIME_ROLE_INSPECTION_SQL);
  assert.deepEqual(calls[0].values, [requiredTables]);
  assert.equal(calls[0].sql.includes("public.users"), false);
  assert.match(calls[0].sql, /pg_catalog\.pg_roles/);
  assert.match(calls[0].sql, /pg_catalog\.pg_class/);
  assert.match(calls[0].sql, /pg_catalog\.pg_has_role\(session_user, role\.oid, 'SET'\)/);
  assert.match(calls[0].sql, /pg_catalog\.pg_has_role\(settable\.oid, table_owner\.oid, 'USAGE'\)/);
  assert.match(calls[0].sql, /relation\.relrowsecurity/);
  assert.match(calls[0].sql, /relation\.relkind IN \('r', 'p'\)/);
});

test("PostgreSQL inspector snapshots the configured table list", async () => {
  const configuredTables = [...requiredTables];
  const calls: unknown[][] = [];
  const inspector = createPostgresRuntimeRoleInspector({
    query: async (_sql, values) => {
      calls.push(values);
      return { rows: safeRows };
    },
  }, configuredTables);

  configuredTables[0] = "public.untrusted_replacement";
  await inspector.inspect();

  assert.deepEqual(calls, [[requiredTables]]);
});

test("PostgreSQL inspector rejects unsafe or ambiguous table identifiers before querying", () => {
  let queryCount = 0;
  const executor = {
    query: async () => {
      queryCount += 1;
      return { rows: safeRows };
    },
  };

  for (const names of [
    [],
    ["public.users", "public.users"],
    ["public.users; SELECT 1"],
    ['public."Users"'],
    ["Public.users"],
    ["public.users.extra"],
  ]) {
    assert.throws(
      () => createPostgresRuntimeRoleInspector(executor, names),
      /unique, simple schema-qualified PostgreSQL identifiers/,
    );
  }

  assert.equal(queryCount, 0);
});

test("missing or non-table relations are omitted so the safety contract rejects them", async () => {
  const inspector = createPostgresRuntimeRoleInspector({
    query: async () => ({
      rows: [{
        ...safeRows[0],
        tenant_tables: safeRows[0].tenant_tables.slice(1),
      }],
    }),
  }, requiredTables);

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector, requiredTables),
    "missing_tenant_table",
  );
});

test("rejects owner privileges inherited by a role the connection can SET ROLE to", async () => {
  const inspector = createPostgresRuntimeRoleInspector({
    query: async () => ({
      rows: [{
        ...safeRows[0],
        tenant_tables: safeRows[0].tenant_tables.map((table, index) => (
          index === 0
            ? {
              ...table,
              ownerRole: "edumanager_owner",
              runtimeCanUseOwnerPrivileges: true,
            }
            : table
        )),
      }],
    }),
  }, requiredTables);

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector, requiredTables),
    "runtime_role_inherits_table_owner",
  );
});

test("rejects a privileged role in the PostgreSQL SET ROLE closure", async () => {
  const inspector = createPostgresRuntimeRoleInspector({
    query: async () => ({
      rows: [{
        ...safeRows[0],
        settable_roles: [
          ...safeRows[0].settable_roles,
          {
            name: "edumanager_privileged",
            isSuperuser: false,
            bypassesRowLevelSecurity: true,
          },
        ],
      }],
    }),
  }, requiredTables);

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector, requiredTables),
    "assumable_privileged_role",
  );
});

test("malformed catalog results fail closed", async () => {
  for (const rows of [[], [safeRows[0], safeRows[0]], [null], ["not-a-row"]]) {
    const inspector = createPostgresRuntimeRoleInspector({
      query: async () => ({ rows }),
    }, requiredTables);

    await assertSafetyCode(
      () => assertSafeTenantDatabaseRole(inspector, requiredTables),
      "invalid_snapshot",
    );
  }
});

test("catalog query failures are normalized by the safety contract", async () => {
  const inspector = createPostgresRuntimeRoleInspector({
    query: async () => {
      throw new Error("private database host and credentials");
    },
  }, requiredTables);

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector, requiredTables),
    "inspection_failed",
  );
});
