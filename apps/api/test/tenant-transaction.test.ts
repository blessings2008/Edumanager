import assert from "node:assert/strict";
import test from "node:test";
import type { TenantRequestContext } from "../src/domain/tenant-authorization.js";
import {
  SET_TENANT_TRANSACTION_CONTEXT_SQL,
  withTenantTransaction,
  type TenantTransactionConnection,
} from "../src/persistence/tenant-transaction.js";

const context: TenantRequestContext = {
  userId: "user-a",
  schoolId: "school-a",
  membershipId: "membership-a",
  role: "teacher",
};

test("runs tenant work in one transaction with transaction-local identity settings", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = false;
  let callbackConnection: TenantTransactionConnection | undefined;
  const connection: TenantTransactionConnection = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [] };
    },
    release: () => { released = true; },
  };

  const result = await withTenantTransaction({
    connect: async () => connection,
  }, context, async (activeConnection) => {
    callbackConnection = activeConnection;
    await activeConnection.query("SELECT 1");
    return "completed";
  });

  assert.equal(result, "completed");
  assert.equal(callbackConnection, connection);
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
