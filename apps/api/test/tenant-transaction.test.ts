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

test("waits for callback-started queries to settle before rolling back callback failures", async () => {
  const calls: string[] = [];
  const callbackFailure = new Error("repository callback failed");
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
    // Deliberately leave the query in flight while the callback rejects.
    void executor.query("SELECT delayed");
    await started;
    throw callbackFailure;
  });

  await started;
  // Give the callback rejection and transaction catch path a turn to run.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT delayed",
  ]);

  finishQuery();
  await assert.rejects(transaction, (error) => error === callbackFailure);
  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "SELECT delayed",
    "ROLLBACK",
  ]);
});


test("rejects transaction and session control statements before forwarding SQL", async () => {
  const blockedStatements = [
    "BEGIN",
    "START TRANSACTION",
    "COMMIT",
    "END",
    "ROLLBACK",
    "ABORT",
    "SAVEPOINT nested_work",
    "RELEASE SAVEPOINT nested_work",
    "SET LOCAL app.school_id = 'school-b'",
    "RESET ALL",
    "DISCARD ALL",
    "PREPARE tenant_query AS SELECT 1",
    "CALL unsafe_procedure()",
    "DO $$ BEGIN COMMIT; END $$",
  ];

  for (const sql of blockedStatements) {
    const calls: string[] = [];
    const connection: TenantTransactionConnection = {
      query: async (statement) => {
        calls.push(statement);
        return { rows: [] };
      },
      release: () => undefined,
    };

    const transaction = withTenantTransaction(
      { connect: async () => connection },
      context,
      async (executor) => {
        await assert.rejects(
          executor.query(sql),
          /one data statement/,
        );
        return "callback completed";
      },
    );

    await assert.rejects(
      transaction,
      /one data statement/,
    );
    assert.deepEqual(calls, [
      "BEGIN",
      SET_TENANT_TRANSACTION_CONTEXT_SQL,
      "ROLLBACK",
    ], "blocked SQL must never reach the checked-out connection");
  }
});

test("rejects multiple SQL statements even when the first statement is data-only", async () => {
  const blockedStatements = [
    "SELECT 1; COMMIT",
    "SELECT 1; SELECT 2",
    "WITH rows AS (SELECT 1) SELECT * FROM rows; DELETE FROM students",
  ];

  for (const sql of blockedStatements) {
    const calls: string[] = [];
    const connection: TenantTransactionConnection = {
      query: async (statement) => {
        calls.push(statement);
        return { rows: [] };
      },
      release: () => undefined,
    };

    await assert.rejects(
      withTenantTransaction(
        { connect: async () => connection },
        context,
        async (executor) => {
          await assert.rejects(
            executor.query(sql),
            /one data statement/,
          );
        },
      ),
      /one data statement/,
    );

    assert.deepEqual(calls, [
      "BEGIN",
      SET_TENANT_TRANSACTION_CONTEXT_SQL,
      "ROLLBACK",
    ]);
  }
});

test("rejects direct set_config calls that could overwrite transaction-local tenant identity", async () => {
  const blockedStatements = [
    "SELECT set_config('app.school_id', 'school-b', true)",
    "SELECT pg_catalog.set_config('app.school_id', $1, true)",
    'SELECT pg_catalog."set_config"($1, $2, true)',
    "SELECT set_config /* hidden between name and call */ ('app.user_id', $1, true)",
    "WITH identity AS (SELECT 1) SELECT set_config('app.membership_id', $1, true)",
  ];

  for (const sql of blockedStatements) {
    const calls: string[] = [];
    const connection: TenantTransactionConnection = {
      query: async (statement) => {
        calls.push(statement);
        return { rows: [] };
      },
      release: () => undefined,
    };

    await assert.rejects(
      withTenantTransaction(
        { connect: async () => connection },
        context,
        async (executor) => {
          await assert.rejects(
            executor.query(sql),
            /one data statement/,
          );
        },
      ),
      /one data statement/,
    );

    assert.deepEqual(calls, [
      "BEGIN",
      SET_TENANT_TRANSACTION_CONTEXT_SQL,
      "ROLLBACK",
    ]);
  }
});

test("rejects Unicode-escaped identifiers before forwarding SQL", async () => {
  const blockedStatements = [
    "SELECT U&\"set\\005fconfig\"('app.school_id', 'school-b', true)",
    "SELECT u&\"set\\+00005fconfig\"('app.school_id', 'school-b', true)",
  ];

  for (const sql of blockedStatements) {
    const calls: string[] = [];
    const connection: TenantTransactionConnection = {
      query: async (statement) => {
        calls.push(statement);
        return { rows: [] };
      },
      release: () => undefined,
    };

    await assert.rejects(
      withTenantTransaction(
        { connect: async () => connection },
        context,
        async (executor) => {
          await executor.query(sql);
        },
      ),
      /one data statement/,
    );

    assert.deepEqual(calls, [
      "BEGIN",
      SET_TENANT_TRANSACTION_CONTEXT_SQL,
      "ROLLBACK",
    ], "Unicode-escaped function names must never reach the connection");
  }
});

test("allows one data statement when control words occur only in comments or literals", async () => {
  const calls: string[] = [];
  const connection: TenantTransactionConnection = {
    query: async (statement) => {
      calls.push(statement);
      return { rows: [] };
    },
    release: () => undefined,
  };

  await withTenantTransaction(
    { connect: async () => connection },
    context,
    async (executor) => {
      await executor.query("/* COMMIT */ SELECT 'ROLLBACK; set_config(''app.school_id'', ''school-b'', true)'");
      await executor.query("WITH rows AS (SELECT 1) SELECT * FROM rows;");
      await executor.query("SELECT $$COMMIT; SELECT set_config('app.school_id', 'school-b', true)$$;");
    },
  );

  assert.deepEqual(calls, [
    "BEGIN",
    SET_TENANT_TRANSACTION_CONTEXT_SQL,
    "/* COMMIT */ SELECT 'ROLLBACK; set_config(''app.school_id'', ''school-b'', true)'",
    "WITH rows AS (SELECT 1) SELECT * FROM rows;",
    "SELECT $$COMMIT; SELECT set_config('app.school_id', 'school-b', true)$$;",
    "COMMIT",
  ]);
});
