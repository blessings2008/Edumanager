import assert from "node:assert/strict";
import test from "node:test";
import type { TenantRequestContext } from "../src/domain/tenant-authorization.js";
import {
  RuntimeDatabaseRoleSafetyError,
} from "../src/persistence/database-runtime-role-safety.js";
import {
  POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
} from "../src/persistence/postgres-runtime-role-inspector.js";
import {
  createPostgresVerifiedTenantTransactionRunner,
} from "../src/persistence/postgres-verified-tenant-transaction.js";
import {
  SET_TENANT_TRANSACTION_CONTEXT_SQL,
  type TenantTransactionConnection,
} from "../src/persistence/tenant-transaction.js";

const context: TenantRequestContext = {
  userId: "user-a",
  schoolId: "school-a",
  membershipId: "membership-a",
  role: "teacher",
};

const requiredTables = [
  "public.users",
  "public.schools",
  "public.school_memberships",
];

const safeSnapshot = {
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
};

function makeConnection(
  snapshot: unknown = safeSnapshot,
  inspectionFailure?: Error,
) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const releaseErrors: Array<Error | undefined> = [];

  const connection: TenantTransactionConnection = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === POSTGRES_RUNTIME_ROLE_INSPECTION_SQL) {
        if (inspectionFailure) throw inspectionFailure;
        return { rows: [snapshot] };
      }
      return { rows: [] };
    },
    release(error) {
      releaseErrors.push(error);
    },
  };

  return { connection, calls, releaseErrors };
}

test("inspects the checked-out physical connection before using that same connection for tenant work", async () => {
  const fixture = makeConnection();
  const runner = createPostgresVerifiedTenantTransactionRunner({
    connect: async () => fixture.connection,
  }, requiredTables);

  const result = await runner.run(context, async (executor) => {
    await executor.query("SELECT 1");
    return "completed";
  });

  assert.equal(result, "completed");
  assert.deepEqual(fixture.calls.map((call) => call.sql), [
    POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT 1",
    "COMMIT",
  ]);
  assert.deepEqual(fixture.calls[0].values, [requiredTables]);
  assert.deepEqual(fixture.releaseErrors, [undefined]);
});

test("verifies every connection checkout and rejects a later unsafe pool connection before tenant work", async () => {
  const safe = makeConnection();
  const unsafe = makeConnection({
    ...safeSnapshot,
    settable_roles: [
      ...safeSnapshot.settable_roles,
      {
        name: "edumanager_bypass",
        isSuperuser: false,
        bypassesRowLevelSecurity: true,
      },
    ],
  });
  const connections = [safe.connection, unsafe.connection];
  let workCalls = 0;

  const runner = createPostgresVerifiedTenantTransactionRunner({
    async connect() {
      const connection = connections.shift();
      if (!connection) throw new Error("No test connection remains.");
      return connection;
    },
  }, requiredTables);

  await runner.run(context, async () => {
    workCalls += 1;
    return undefined;
  });

  await assert.rejects(
    runner.run(context, async () => {
      workCalls += 1;
      return undefined;
    }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
      assert.equal(error.code, "assumable_privileged_role");
      return true;
    },
  );

  assert.equal(workCalls, 1);
  assert.equal(safe.calls[0].sql, POSTGRES_RUNTIME_ROLE_INSPECTION_SQL);
  assert.equal(unsafe.calls.length, 1);
  assert.equal(unsafe.calls[0].sql, POSTGRES_RUNTIME_ROLE_INSPECTION_SQL);
  assert.equal(unsafe.releaseErrors.length, 1);
  assert.ok(unsafe.releaseErrors[0] instanceof RuntimeDatabaseRoleSafetyError);
});

test("discards a connection when its role inspection fails and never starts a tenant transaction", async () => {
  const fixture = makeConnection(safeSnapshot, new Error("private database detail"));
  let workCalled = false;
  const runner = createPostgresVerifiedTenantTransactionRunner({
    connect: async () => fixture.connection,
  }, requiredTables);

  await assert.rejects(
    runner.run(context, async () => {
      workCalled = true;
      return undefined;
    }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
      assert.equal(error.code, "inspection_failed");
      return true;
    },
  );

  assert.equal(workCalled, false);
  assert.deepEqual(fixture.calls.map((call) => call.sql), [
    POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
  ]);
  assert.equal(fixture.releaseErrors.length, 1);
  assert.ok(fixture.releaseErrors[0] instanceof RuntimeDatabaseRoleSafetyError);
});

test("snapshots the checked-out connection query and release methods for inspection and transaction use", async () => {
  const calls: string[] = [];
  let queryReads = 0;
  let releaseReads = 0;
  let originalReleaseCalls = 0;
  let replacementQueryCalls = 0;
  let replacementReleaseCalls = 0;

  const originalQuery = async (sql: string) => {
    calls.push(sql);
    if (sql === POSTGRES_RUNTIME_ROLE_INSPECTION_SQL) return { rows: [safeSnapshot] };
    return { rows: [] };
  };

  const rawConnection = {} as TenantTransactionConnection;
  Object.defineProperty(rawConnection, "query", {
    configurable: true,
    get() {
      queryReads += 1;
      return originalQuery;
    },
  });
  Object.defineProperty(rawConnection, "release", {
    configurable: true,
    get() {
      releaseReads += 1;
      return () => {
        originalReleaseCalls += 1;
      };
    },
  });

  const runner = createPostgresVerifiedTenantTransactionRunner({
    connect: async () => rawConnection,
  }, requiredTables);

  await runner.run(context, async (executor) => {
    Object.defineProperty(rawConnection, "query", {
      configurable: true,
      value: async () => {
        replacementQueryCalls += 1;
        return { rows: [] };
      },
    });
    Object.defineProperty(rawConnection, "release", {
      configurable: true,
      value: () => {
        replacementReleaseCalls += 1;
      },
    });
    await executor.query("SELECT 1");
  });

  assert.equal(queryReads, 1);
  assert.equal(releaseReads, 1);
  assert.equal(replacementQueryCalls, 0);
  assert.equal(originalReleaseCalls, 1);
  assert.equal(replacementReleaseCalls, 0);
  assert.deepEqual(calls, [
    POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT 1",
    "COMMIT",
  ]);
});

test("snapshots required tenant tables before any pool checkout", async () => {
  const mutableTables = [...requiredTables];
  const fixture = makeConnection();
  const runner = createPostgresVerifiedTenantTransactionRunner({
    connect: async () => fixture.connection,
  }, mutableTables);

  mutableTables[0] = "public.untrusted_replacement";
  await runner.run(context, async () => undefined);

  assert.deepEqual(fixture.calls[0].values, [requiredTables]);
});

test("rejects invalid tenant-table requirements before connecting to the pool", () => {
  let connectCalls = 0;

  assert.throws(
    () => createPostgresVerifiedTenantTransactionRunner({
      connect: async () => {
        connectCalls += 1;
        return makeConnection().connection;
      },
    }, ["public.users; SELECT 1"]),
    /unique, simple schema-qualified PostgreSQL identifiers/,
  );

  assert.equal(connectCalls, 0);
});


test("discards a checked-out connection when the catalog returns a malformed snapshot", async () => {
  const fixture = makeConnection(null);
  let workCalled = false;
  const runner = createPostgresVerifiedTenantTransactionRunner({
    connect: async () => fixture.connection,
  }, requiredTables);

  await assert.rejects(
    runner.run(context, async () => {
      workCalled = true;
      return undefined;
    }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
      assert.equal(error.code, "invalid_snapshot");
      return true;
    },
  );

  assert.equal(workCalled, false);
  assert.deepEqual(fixture.calls.map((call) => call.sql), [
    POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
  ]);
  assert.equal(fixture.releaseErrors.length, 1);
  assert.ok(fixture.releaseErrors[0] instanceof RuntimeDatabaseRoleSafetyError);
  assert.equal(
    (fixture.releaseErrors[0] as RuntimeDatabaseRoleSafetyError).code,
    "invalid_snapshot",
  );
});


test("discards a connection when the driver result exposes a throwing rows accessor", async () => {
  const calls: string[] = [];
  const releaseErrors: Array<Error | undefined> = [];
  let workCalled = false;
  const malformedResult = Object.defineProperty({}, "rows", {
    get() {
      throw new Error("private driver detail");
    },
  });
  const connection: TenantTransactionConnection = {
    async query(sql) {
      calls.push(sql);
      if (sql === POSTGRES_RUNTIME_ROLE_INSPECTION_SQL) return malformedResult;
      return { rows: [] };
    },
    release(error) {
      releaseErrors.push(error);
    },
  };
  const runner = createPostgresVerifiedTenantTransactionRunner({
    connect: async () => connection,
  }, requiredTables);

  await assert.rejects(
    runner.run(context, async () => {
      workCalled = true;
      return undefined;
    }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
      assert.equal(error.code, "invalid_snapshot");
      return true;
    },
  );

  assert.equal(workCalled, false);
  assert.deepEqual(calls, [POSTGRES_RUNTIME_ROLE_INSPECTION_SQL]);
  assert.equal(releaseErrors.length, 1);
  assert.ok(releaseErrors[0] instanceof RuntimeDatabaseRoleSafetyError);
  assert.equal(
    (releaseErrors[0] as RuntimeDatabaseRoleSafetyError).code,
    "invalid_snapshot",
  );
});
