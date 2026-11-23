import assert from "node:assert/strict";
import test from "node:test";
import { createTenantContextResolver } from "../../../packages/contracts/src/authorization.js";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import {
  createPostgresTenantPersistenceAdapter,
  type PostgresTenantPersistenceQueryExecutor,
} from "../src/persistence/postgres-tenant-persistence-adapter.js";
import { POSTGRES_RUNTIME_ROLE_INSPECTION_SQL } from "../src/persistence/postgres-runtime-role-inspector.js";
import { POSTGRES_TENANT_MEMBERSHIP_SQL } from "../src/persistence/postgres-tenant-membership-reader.js";

const userId = "a0000000-0000-4000-8000-000000000001";
const schoolId = "00000000-0000-4000-8000-000000000002";
const requiredTables = [
  "public.users",
  "public.schools",
  "public.school_memberships",
];

test("PostgreSQL tenant adapter uses one snapshotted executor for inspection and membership resolution", async () => {
  const calls: Array<{
    receiver: unknown;
    connectionLabel: unknown;
    sql: string;
    values: unknown[];
  }> = [];
  const executor = {
    connectionLabel: "shared-runtime-executor",
  } as unknown as PostgresTenantPersistenceQueryExecutor & { connectionLabel: string };

  let queryReads = 0;
  const originalQuery = async function (
    this: unknown,
    sql: string,
    values: unknown[],
  ): Promise<{ rows: unknown[] }> {
    const receiver = this as { connectionLabel?: string };
    calls.push({
      receiver: this,
      connectionLabel: receiver.connectionLabel,
      sql,
      values: values.map((value) => Array.isArray(value) ? value.slice() : value),
    });

    if (sql === POSTGRES_RUNTIME_ROLE_INSPECTION_SQL) {
      return {
        rows: [{
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
        }],
      };
    }

    if (sql === POSTGRES_TENANT_MEMBERSHIP_SQL) {
      return {
        rows: [{
          user_id: userId,
          user_status: "active",
          school_id: schoolId,
          school_status: "active",
          membership_id: "00000000-0000-4000-8000-000000000003",
          membership_user_id: userId,
          membership_school_id: schoolId,
          membership_role: "teacher",
          membership_status: "active",
        }],
      };
    }

    throw new Error("Unexpected SQL reached the shared test executor.");
  };

  Object.defineProperty(executor, "query", {
    configurable: false,
    enumerable: true,
    get() {
      queryReads += 1;
      return queryReads === 1
        ? originalQuery
        : async () => {
          throw new Error("The executor query method was unexpectedly re-read.");
        };
    },
  });

  const configuredTables = [...requiredTables];
  const adapter = createPostgresTenantPersistenceAdapter(
    executor,
    configuredTables,
    createTenantContextResolver,
  );

  // Mutating caller-owned configuration after construction cannot redirect
  // either operation or narrow the startup inspection requirements.
  configuredTables[0] = "public.untrusted_replacement";

  const app = buildApp(readConfig({}), false, {
    authenticateRequest: async () => ({ userId, userStatus: "active" }),
    tenantPersistence: adapter,
  });

  try {
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/schools/${schoolId}/context`,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { schoolId, role: "teacher" });
    assert.equal(response.headers["cache-control"], "no-store");

    assert.equal(queryReads, 1);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.sql), [
      POSTGRES_RUNTIME_ROLE_INSPECTION_SQL,
      POSTGRES_TENANT_MEMBERSHIP_SQL,
    ]);
    assert.ok(calls.every((call) => call.receiver === executor));
    assert.deepEqual(calls.map((call) => call.connectionLabel), [
      "shared-runtime-executor",
      "shared-runtime-executor",
    ]);

    const inspectionCall = calls[0];
    const membershipCall = calls[1];
    assert.ok(inspectionCall);
    assert.ok(membershipCall);
    assert.deepEqual(inspectionCall.values, [requiredTables]);
    assert.deepEqual(membershipCall.values, [userId, schoolId]);

    assert.deepEqual(adapter.requiredTenantTables, requiredTables);
    assert.equal(Object.isFrozen(adapter), true);
    assert.equal(Object.isFrozen(adapter.requiredTenantTables), true);
  } finally {
    await app.close();
  }
});

test("PostgreSQL tenant adapter rejects an executor whose query accessor throws", () => {
  const executor = Object.defineProperty({}, "query", {
    get() {
      throw new Error("private executor detail");
    },
  });

  assert.throws(
    () => createPostgresTenantPersistenceAdapter(
      executor as unknown as PostgresTenantPersistenceQueryExecutor,
      requiredTables,
      createTenantContextResolver,
    ),
    {
      name: "TypeError",
      message: "A PostgreSQL tenant persistence query executor is required.",
    },
  );
});

test("PostgreSQL tenant adapter rejects invalid required tables before querying", () => {
  let queryCount = 0;
  const executor: PostgresTenantPersistenceQueryExecutor = {
    async query() {
      queryCount += 1;
      return { rows: [] };
    },
  };

  assert.throws(
    () => createPostgresTenantPersistenceAdapter(
      executor,
      ["public.users; SELECT 1"],
      createTenantContextResolver,
    ),
    /unique, simple schema-qualified PostgreSQL identifiers/,
  );
  assert.equal(queryCount, 0);
});

test("PostgreSQL tenant adapter requires a resolver factory", () => {
  const executor: PostgresTenantPersistenceQueryExecutor = {
    async query() {
      return { rows: [] };
    },
  };

  assert.throws(
    () => createPostgresTenantPersistenceAdapter(
      executor,
      requiredTables,
      null as unknown as typeof createTenantContextResolver,
    ),
    /trusted tenant-context resolver factory/,
  );
});
