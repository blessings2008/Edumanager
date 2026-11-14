import assert from "node:assert/strict";
import test from "node:test";
import { createTenantContextResolver } from "../../../packages/contracts/src/authorization.js";
import {
  createPostgresTenantMembershipReader,
  POSTGRES_TENANT_MEMBERSHIP_SQL,
} from "../src/persistence/postgres-tenant-membership-reader.js";

const userId = "a0000000-0000-4000-8000-000000000001";
const schoolId = "00000000-0000-4000-8000-000000000002";

const persistedRow = {
  user_id: userId,
  user_status: "active",
  school_id: schoolId,
  school_status: "active",
  membership_id: "00000000-0000-4000-8000-000000000003",
  membership_user_id: userId,
  membership_school_id: schoolId,
  membership_role: "teacher",
  membership_status: "active",
};

test("PostgreSQL membership reader returns only persisted identity fields", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const reader = createPostgresTenantMembershipReader({
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [persistedRow] };
    },
  });

  assert.deepEqual(await reader.loadTenantMembership({
    authenticatedUserId: userId,
    requestedSchoolId: schoolId,
  }), {
    user: { id: userId, status: "active" },
    school: { id: schoolId, status: "active" },
    membership: {
      id: persistedRow.membership_id,
      userId,
      schoolId,
      role: "teacher",
      status: "active",
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, POSTGRES_TENANT_MEMBERSHIP_SQL);
  assert.deepEqual(calls[0].values, [userId, schoolId]);
  assert.match(calls[0].sql, /u\.id = \$1::uuid/);
  assert.match(calls[0].sql, /s\.id = \$2::uuid/);
  assert.match(calls[0].sql, /m\.user_id = u\.id/);
  assert.match(calls[0].sql, /m\.school_id = s\.id/);
  assert.match(calls[0].sql, /LIMIT 2/);
  assert.equal(calls[0].sql.includes(userId), false);
  assert.equal(calls[0].sql.includes(schoolId), false);
});

test("PostgreSQL membership reader rejects malformed UUIDs without querying", async () => {
  let queryCount = 0;
  const reader = createPostgresTenantMembershipReader({
    query: async () => {
      queryCount += 1;
      return { rows: [persistedRow] };
    },
  });

  for (const input of [
    { authenticatedUserId: "", requestedSchoolId: schoolId },
    { authenticatedUserId: "not-a-uuid", requestedSchoolId: schoolId },
    { authenticatedUserId: userId.toUpperCase(), requestedSchoolId: schoolId },
    { authenticatedUserId: userId, requestedSchoolId: "school-a" },
  ]) {
    assert.equal(await reader.loadTenantMembership(input), null);
  }
  assert.equal(queryCount, 0);
});

test("PostgreSQL membership reader fails closed for missing, duplicate or malformed rows", async () => {
  const results: unknown[][] = [
    [],
    [persistedRow, persistedRow],
    [null],
    ["not-a-row"],
  ];

  for (const rows of results) {
    const reader = createPostgresTenantMembershipReader({
      query: async () => ({ rows }),
    });
    assert.equal(await reader.loadTenantMembership({
      authenticatedUserId: userId,
      requestedSchoolId: schoolId,
    }), null);
  }
});

test("PostgreSQL membership reader preserves persisted inactive statuses for policy rejection", async () => {
  const reader = createPostgresTenantMembershipReader({
    query: async () => ({
      rows: [{
        ...persistedRow,
        user_status: "disabled",
        school_status: "suspended",
        membership_status: "revoked",
      }],
    }),
  });

  assert.deepEqual(await reader.loadTenantMembership({
    authenticatedUserId: userId,
    requestedSchoolId: schoolId,
  }), {
    user: { id: userId, status: "disabled" },
    school: { id: schoolId, status: "suspended" },
    membership: {
      id: persistedRow.membership_id,
      userId,
      schoolId,
      role: "teacher",
      status: "revoked",
    },
  });
});


test("PostgreSQL reader composes with the shared resolver and rejects inactive membership", async () => {
  const resolveActive = createTenantContextResolver(createPostgresTenantMembershipReader({
    query: async () => ({ rows: [persistedRow] }),
  }));

  assert.deepEqual(await resolveActive({
    authenticatedUserId: userId,
    requestedSchoolId: schoolId,
  }), {
    userId,
    schoolId,
    membershipId: persistedRow.membership_id,
    role: "teacher",
  });

  const resolveInactive = createTenantContextResolver(createPostgresTenantMembershipReader({
    query: async () => ({
      rows: [{ ...persistedRow, membership_status: "revoked" }],
    }),
  }));

  assert.equal(await resolveInactive({
    authenticatedUserId: userId,
    requestedSchoolId: schoolId,
  }), null);
});

test("PostgreSQL membership reader propagates persistence failures", async () => {
  const reader = createPostgresTenantMembershipReader({
    query: async () => {
      throw new Error("private database connection detail");
    },
  });

  await assert.rejects(
    reader.loadTenantMembership({
      authenticatedUserId: userId,
      requestedSchoolId: schoolId,
    }),
    /private database connection detail/,
  );
});
