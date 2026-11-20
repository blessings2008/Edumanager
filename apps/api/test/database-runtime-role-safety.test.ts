import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeTenantDatabaseRole,
  RuntimeDatabaseRoleSafetyError,
  type RuntimeDatabaseRoleInspector,
} from "../src/persistence/database-runtime-role-safety.js";

const requiredTables = ["public.users", "public.schools", "public.school_memberships"];

const safeSnapshot = {
  roleName: "edumanager_runtime",
  settableRoles: [
    {
      name: "edumanager_runtime",
      isSuperuser: false,
      bypassesRowLevelSecurity: false,
    },
  ],
  tenantTables: requiredTables.map((qualifiedName) => ({
    qualifiedName,
    rowLevelSecurityEnabled: true,
    ownerRole: "edumanager_migrator",
  })),
};

function inspector(snapshot: unknown): RuntimeDatabaseRoleInspector {
  return { inspect: async () => snapshot };
}

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

test("accepts a non-privileged role with RLS enabled and separate table ownership", async () => {
  let inspections = 0;
  await assertSafeTenantDatabaseRole({
    inspect: async () => {
      inspections += 1;
      return safeSnapshot;
    },
  }, requiredTables);

  assert.equal(inspections, 1);
});

test("rejects a superuser or BYPASSRLS current role", async () => {
  for (const change of [
    { isSuperuser: true, bypassesRowLevelSecurity: false },
    { isSuperuser: false, bypassesRowLevelSecurity: true },
  ]) {
    await assertSafetyCode(
      () => assertSafeTenantDatabaseRole(inspector({
        ...safeSnapshot,
        settableRoles: [{ ...safeSnapshot.settableRoles[0], ...change }],
      }), requiredTables),
      "privileged_runtime_role",
    );
  }
});

test("rejects any privileged role the connection can assume", async () => {
  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({
      ...safeSnapshot,
      settableRoles: [
        ...safeSnapshot.settableRoles,
        {
          name: "elevated_runtime",
          isSuperuser: false,
          bypassesRowLevelSecurity: true,
        },
      ],
    }), requiredTables),
    "assumable_privileged_role",
  );
});

test("rejects tenant tables without row-level security", async () => {
  const tenantTables = safeSnapshot.tenantTables.map((table, index) => (
    index === 1 ? { ...table, rowLevelSecurityEnabled: false } : table
  ));

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({ ...safeSnapshot, tenantTables }), requiredTables),
    "tenant_rls_disabled",
  );
});

test("rejects missing or duplicate tenant-table metadata", async () => {
  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({
      ...safeSnapshot,
      tenantTables: safeSnapshot.tenantTables.slice(0, 2),
    }), requiredTables),
    "missing_tenant_table",
  );

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({
      ...safeSnapshot,
      tenantTables: [...safeSnapshot.tenantTables, safeSnapshot.tenantTables[0]],
    }), requiredTables),
    "invalid_snapshot",
  );
});

test("rejects a runtime role that owns a tenant table or can assume its owner", async () => {
  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({
      ...safeSnapshot,
      tenantTables: safeSnapshot.tenantTables.map((table, index) => (
        index === 0 ? { ...table, ownerRole: "edumanager_runtime" } : table
      )),
    }), requiredTables),
    "runtime_role_can_assume_table_owner",
  );

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({
      ...safeSnapshot,
      settableRoles: [
        ...safeSnapshot.settableRoles,
        {
          name: "edumanager_migrator",
          isSuperuser: false,
          bypassesRowLevelSecurity: false,
        },
      ],
    }), requiredTables),
    "runtime_role_can_assume_table_owner",
  );
});

test("rejects incomplete snapshots and throwing accessors", async () => {
  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector({
      roleName: "edumanager_runtime",
      settableRoles: [],
      tenantTables: safeSnapshot.tenantTables,
    }), requiredTables),
    "invalid_snapshot",
  );

  const hostileSnapshot = Object.defineProperty({ ...safeSnapshot }, "roleName", {
    get() {
      throw new Error("private inspection detail");
    },
  });

  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole(inspector(hostileSnapshot), requiredTables),
    "invalid_snapshot",
  );
});

test("normalizes inspection failures without exposing database details", async () => {
  await assertSafetyCode(
    () => assertSafeTenantDatabaseRole({
      inspect: async () => {
        throw new Error("private connection string and credentials");
      },
    }, requiredTables),
    "inspection_failed",
  );
});

test("rejects invalid required-table configuration before inspection", async () => {
  let inspections = 0;
  const source = {
    inspect: async () => {
      inspections += 1;
      return safeSnapshot;
    },
  };

  for (const names of [[], ["public.users", "public.users"], [" "]]) {
    await assertSafetyCode(
      () => assertSafeTenantDatabaseRole(source, names),
      "invalid_requirements",
    );
  }

  assert.equal(inspections, 0);
});
