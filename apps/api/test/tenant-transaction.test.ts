import assert from "node:assert/strict";
import test from "node:test";
import type { TenantRequestContext } from "../src/domain/tenant-authorization.js";
import {
  SET_TENANT_TRANSACTION_CONTEXT_SQL,
  withTenantTransaction,
  type TenantTransactionConnection,
  type TenantTransactionExecutor,
} from "../src/persistence/tenant-transaction.js";

const context: TenantRequestContext = {
  userId: "user-a",
  schoolId: "school-a",
  membershipId: "membership-a",
  role: "teacher",
};

test("runs tenant work through a frozen query-only executor and keeps release control private", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = false;
  let callbackExecutor: TenantTransactionExecutor | undefined;
  const connection: TenantTransactionConnection = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [] };
    },
    release: () => { released = true; },
  };

  const result = await withTenantTransaction({
    connect: async () => connection,
  }, context, async (activeExecutor) => {
    callbackExecutor = activeExecutor;
    await activeExecutor.query("SELECT 1");
    return "completed";
  });

  assert.equal(result, "completed");
  assert.ok(callbackExecutor);
  assert.notEqual(callbackExecutor, connection);
  assert.equal(Object.isFrozen(callbackExecutor), true);
  assert.equal("release" in callbackExecutor, false);
  await assert.rejects(
    callbackExecutor.query("SELECT after completion"),
    /Tenant transaction executor is no longer active/,
  );
  assert.deepEqual(calls.map((call) => call.sql), [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT 1",
    "COMMIT",
  ]);
  assert.deepEqual(calls[1].values, ["user-a", "school-a", "membership-a"]);
  assert.match(SET_TENANT_TRANSACTION_CONTEXT_SQL, /set_config\('app\.user_id', \$1, true\)/);
  assert.match(SET_TENANT_TRANSACTION_CONTEXT_SQL, /set_config\('app\.school_id', \$2, true\)/);
  assert.match(SET_TENANT_TRANSACTION_CONTEXT_SQL, /set_config\('app\.membership_id', \$3, true\)/);
  assert.equal(released, true);
});

test("waits for callback-started queries to settle before committing", async () => {
  const calls: string[] = [];
  let queryStarted!: () => void;
  let finishQuery!: () => void;
  const started = new Promise<void>((resolve) => { queryStarted = resolve; });
  const queryGate = new Promise<void>((resolve) => { finishQuery = resolve; });
  const connection: TenantTransactionConnection = {
    query: async (sql) => {
      calls.push(sql);
      if (sql === "SELECT delayed") {
        queryStarted();
        await queryGate;
      }
      return { rows: [] };
    },
    release: () => undefined,
  };

  const transaction = withTenantTransaction({
    connect: async () => connection,
  }, context, async (executor) => {
    // Deliberately omit await to prove transaction finalization drains it.
    void executor.query("SELECT delayed");
    return "completed";
  });

  await started;
  assert.equal(calls.includes("COMMIT"), false);
  finishQuery();

  assert.equal(await transaction, "completed");
  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT delayed",
    "COMMIT",
  ]);
});

test("rolls back when a callback-started query fails before transaction finalization", async () => {
  const calls: string[] = [];
  const failure = new Error("delayed query failed");
  let queryStarted!: () => void;
  let finishQuery!: () => void;
  const started = new Promise<void>((resolve) => { queryStarted = resolve; });
  const queryGate = new Promise<void>((resolve) => { finishQuery = resolve; });
  const connection: TenantTransactionConnection = {
    query: async (sql) => {
      calls.push(sql);
      if (sql === "SELECT delayed") {
        queryStarted();
        await queryGate;
        throw failure;
      }
      return { rows: [] };
    },
    release: () => undefined,
  };

  const transaction = withTenantTransaction({
    connect: async () => connection,
  }, context, async (executor) => {
    void executor.query("SELECT delayed");
    return "completed";
  });

  await started;
  finishQuery();

  await assert.rejects(transaction, (error) => error === failure);
  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT delayed",
    "ROLLBACK",
  ]);
});

test("snapshots validated tenant identity before awaiting a pooled connection", async () => {
  const mutableContext: TenantRequestContext = { ...context };
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let resolveConnection!: (connection: TenantTransactionConnection) => void;
  const pendingConnection = new Promise<TenantTransactionConnection>((resolve) => {
    resolveConnection = resolve;
  });
  const connection: TenantTransactionConnection = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [] };
    },
    release: () => undefined,
  };

  const transaction = withTenantTransaction({
    connect: () => pendingConnection,
  }, mutableContext, async () => "completed");

  // Mutate the caller-owned object while pool acquisition is suspended.
  mutableContext.userId = "user-b";
  mutableContext.schoolId = "school-b";
  mutableContext.membershipId = "membership-b";

  resolveConnection(connection);
  assert.equal(await transaction, "completed");
  assert.deepEqual(calls[1].values, ["user-a", "school-a", "membership-a"]);
});

test("rolls back tenant work failures and preserves the original error", async () => {
  const calls: string[] = [];
  let released = false;
  const failure = new Error("repository operation failed");
  const connection: TenantTransactionConnection = {
    query: async (sql) => { calls.push(sql); return { rows: [] }; },
    release: () => { released = true; },
  };

  await assert.rejects(
    withTenantTransaction({ connect: async () => connection }, context, async () => {
      throw failure;
    }),
    (error) => error === failure,
  );

  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "ROLLBACK",
  ]);
  assert.equal(released, true);
});

test("discards a connection when rollback itself fails without masking the work error", async () => {
  const failure = new Error("work failed");
  const rollbackFailure = new Error("rollback failed");
  let releaseError: Error | undefined;
  const connection: TenantTransactionConnection = {
    query: async (sql) => {
      if (sql === "ROLLBACK") throw rollbackFailure;
      return { rows: [] };
    },
    release: (error) => { releaseError = error; },
  };

  await assert.rejects(
    withTenantTransaction({ connect: async () => connection }, context, async () => {
      throw failure;
    }),
    (error) => error === failure,
  );

  assert.equal(releaseError, rollbackFailure);
});

test("rolls back when transaction-local context cannot be installed", async () => {
  const calls: string[] = [];
  const failure = new Error("set_config failed");
  let released = false;
  const connection: TenantTransactionConnection = {
    query: async (sql) => {
      calls.push(sql);
      if (sql === SET_TENANT_TRANSACTION_CONTEXT_SQL) throw failure;
      return { rows: [] };
    },
    release: () => { released = true; },
  };

  await assert.rejects(
    withTenantTransaction({ connect: async () => connection }, context, async () => {
      assert.fail("tenant work must not run without transaction context");
    }),
    (error) => error === failure,
  );

  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "ROLLBACK",
  ]);
  assert.equal(released, true);
});

test("rejects malformed tenant contexts before checking out a connection", async () => {
  let connectCount = 0;
  const invalidContext = {
    ...context,
    schoolId: " ",
  } as TenantRequestContext;

  await assert.rejects(
    withTenantTransaction({
      connect: async () => {
        connectCount += 1;
        throw new Error("must not connect");
      },
    }, invalidContext, async () => "unreachable"),
    /validated tenant request context/,
  );

  assert.equal(connectCount, 0);
});

test("discards a connection when BEGIN fails before tenant work starts", async () => {
  const failure = new Error("connection lost during BEGIN");
  let workCalled = false;
  let releaseError: Error | undefined;
  const connection: TenantTransactionConnection = {
    query: async (sql) => {
      if (sql === "BEGIN") throw failure;
      return { rows: [] };
    },
    release: (error) => { releaseError = error; },
  };

  await assert.rejects(
    withTenantTransaction({ connect: async () => connection }, context, async () => {
      workCalled = true;
      return "unreachable";
    }),
    (error) => error === failure,
  );

  assert.equal(workCalled, false);
  assert.equal(releaseError, failure);
});
