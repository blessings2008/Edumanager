import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { createTenantContextResolver } from "../../../packages/contracts/src/authorization.js";
import { SCHOOL_ROLES } from "../../../packages/contracts/src/identity.js";
import { TENANT_SCHOOL_ROLES } from "../src/domain/tenant-authorization.js";
import { RuntimeDatabaseRoleSafetyError } from "../src/persistence/database-runtime-role-safety.js";

const config = {
  port: 4000,
  host: "127.0.0.1",
  webOrigins: ["http://localhost:5173"],
  trustedProxies: [],
};

const requiredTenantTables = [
  "public.users",
  "public.schools",
  "public.school_memberships",
];

function createSafeTenantDatabaseSafety() {
  return {
    inspector: {
      inspect: async (): Promise<unknown> => ({
        roleName: "edumanager_runtime",
        settableRoles: [{
          name: "edumanager_runtime",
          isSuperuser: false,
          bypassesRowLevelSecurity: false,
        }],
        tenantTables: requiredTenantTables.map((qualifiedName) => ({
          qualifiedName,
          rowLevelSecurityEnabled: true,
          ownerRole: "edumanager_migrator",
          runtimeCanUseOwnerPrivileges: false,
        })),
      }),
    },
    requiredTenantTables: [...requiredTenantTables],
  };
}


test("GET /health returns a healthy API response", async () => {
  const app = buildApp(config, false);
  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "edumanager-api");
    assert.ok(Number.isNaN(Date.parse(body.timestamp)) === false);
  } finally {
    await app.close();
  }
});

test("GET /api/v1 returns API identity and version", async () => {
  const app = buildApp(config, false);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      name: "EduManager API", version: "0.1.0", status: "foundation",
    });
  } finally {
    await app.close();
  }
});

test("unknown routes return a consistent 404 response", async () => {
  const app = buildApp(config, false);
  try {
    const response = await app.inject({ method: "GET", url: "/does-not-exist" });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error, "Not Found");
  } finally {
    await app.close();
  }
});

test("readConfig parses comma-separated allowed web origins and trusted proxies", () => {
  const parsed = readConfig({
    API_PORT: "4100",
    API_HOST: "127.0.0.1",
    WEB_ORIGIN: "http://localhost:5173,https://school.example",
    TRUSTED_PROXIES: "127.0.0.1,10.0.0.0/8,2001:db8::/32",
  });
  assert.equal(parsed.port, 4100);
  assert.deepEqual(parsed.webOrigins, ["http://localhost:5173", "https://school.example"]);
  assert.deepEqual(parsed.trustedProxies, ["127.0.0.1", "10.0.0.0/8", "2001:db8::/32"]);
});

test("readConfig rejects an invalid API port", () => {
  assert.throws(() => readConfig({ API_PORT: "70000" }), /API_PORT/);
});

test("readConfig rejects non-HTTP web origins", () => {
  assert.throws(() => readConfig({ WEB_ORIGIN: "javascript:alert(1)" }), /WEB_ORIGIN/);
});

test("readConfig rejects web URLs that are not bare origins", () => {
  for (const value of [
    "https://school.example/path",
    "https://school.example/?next=/admin",
    "https://user:pass@school.example",
    "https://school.example/#fragment",
  ]) {
    assert.throws(() => readConfig({ WEB_ORIGIN: value }), /WEB_ORIGIN/);
  }
});

test("readConfig rejects invalid trusted proxy entries", () => {
  assert.throws(() => readConfig({ TRUSTED_PROXIES: "proxy.internal" }), /TRUSTED_PROXIES/);
  assert.throws(() => readConfig({ TRUSTED_PROXIES: "192.168.1.1/33" }), /TRUSTED_PROXIES/);
});

test("readConfig defaults to trusting no forwarded proxy headers", () => {
  assert.deepEqual(readConfig({}).trustedProxies, []);
});

test("unapproved CORS origins do not receive credentialed CORS permission", async () => {
  const app = buildApp(config, false);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://attacker.example" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  } finally {
    await app.close();
  }
});

test("GET /api/v1/me denies identity headers when no trusted auth adapter is configured", async () => {
  const app = buildApp(config, false);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { "x-user-id": "forged-user", "x-school-id": "school-a" },
    });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      error: "Unauthorized",
      message: "Authentication is required.",
    });
  } finally {
    await app.close();
  }
});

test("GET /api/v1/me exposes only the global identity returned by the trusted adapter", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({
      userId: "user-a",
      userStatus: "active",
      schoolId: "untrusted-extra-school",
      role: "school_owner",
    }),
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/me" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { userId: "user-a" });
    assert.equal(response.headers["cache-control"], "no-store");
  } finally {
    await app.close();
  }
});

test("GET /api/v1/me snapshots accessor-backed identity fields exactly once", async () => {
  let userIdReads = 0;
  const principal = {
    get userId() {
      userIdReads += 1;
      return userIdReads === 1 ? "user-a" : "user-b";
    },
    get userStatus() {
      return "active";
    },
  };

  const app = buildApp(config, false, {
    authenticateRequest: async () => principal,
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/me" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { userId: "user-a" });
    assert.equal(userIdReads, 1);
  } finally {
    await app.close();
  }
});

test("GET /api/v1/me rejects principals whose identity accessors throw", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({
      get userId(): string {
        throw new Error("private principal getter detail");
      },
      userStatus: "active",
    }),
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/me" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "Unauthorized");
    assert.equal(JSON.stringify(response.json()).includes("private principal getter detail"), false);
  } finally {
    await app.close();
  }
});

test("GET /api/v1/me rejects missing, malformed, blank and inactive principals", async () => {
  const invalidPrincipals: unknown[] = [
    null,
    undefined,
    {},
    { userId: "", userStatus: "active" },
    { userId: " user-a", userStatus: "active" },
    { userId: "user-a", userStatus: "disabled" },
  ];

  for (const principal of invalidPrincipals) {
    const app = buildApp(config, false, {
      authenticateRequest: async () => principal,
    });
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/me" });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error, "Unauthorized");
    } finally {
      await app.close();
    }
  }
});

test("GET /api/v1/me normalizes authentication adapter failures and ignores adapter HTTP statuses", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => {
      throw Object.assign(new Error("private session token detail"), { statusCode: 403 });
    },
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/me" });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: "Service Unavailable",
      message: "Authentication is temporarily unavailable.",
    });
    assert.equal(JSON.stringify(response.json()).includes("private session token detail"), false);
  } finally {
    await app.close();
  }
});



test("API tenant roles stay aligned with the shared identity contract", () => {
  assert.deepEqual(TENANT_SCHOOL_ROLES, SCHOOL_ROLES);
});

test("school context route requires a configured membership resolver", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context",
    });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: "Service Unavailable",
      message: "School access is not configured.",
    });
  } finally {
    await app.close();
  }
});


test("school membership resolver requires a runtime database-role inspector", () => {
  assert.throws(
    () => buildApp(config, false, {
      resolveTenantContext: async () => null,
    }),
    /runtime database-role inspector and required tenant-table list are required/,
  );
});

test("school membership resolver prevents readiness when the inspected role is privileged", async () => {
  let resolverCalled = false;
  const unsafeSnapshot = {
    roleName: "edumanager_runtime",
    settableRoles: [{
      name: "edumanager_runtime",
      isSuperuser: false,
      bypassesRowLevelSecurity: true,
    }],
    tenantTables: requiredTenantTables.map((qualifiedName) => ({
      qualifiedName,
      rowLevelSecurityEnabled: true,
      ownerRole: "edumanager_migrator",
      runtimeCanUseOwnerPrivileges: false,
    })),
  };
  const app = buildApp(config, false, {
    resolveTenantContext: async () => {
      resolverCalled = true;
      return null;
    },
    tenantDatabaseSafety: {
      inspector: { inspect: async () => unsafeSnapshot },
      requiredTenantTables: [...requiredTenantTables],
    },
  });

  await assert.rejects(async () => {
    await app.ready();
  }, (error: unknown) => {
    assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
    assert.equal(error.code, "privileged_runtime_role");
    return true;
  });
  assert.equal(resolverCalled, false);
});

test("tenant database safety dependencies are snapshotted before readiness", async () => {
  const mutableTables = [...requiredTenantTables];
  const inspector = {
    inspect: async (): Promise<unknown> => ({
      roleName: "edumanager_runtime",
      settableRoles: [{
        name: "edumanager_runtime",
        isSuperuser: false,
        bypassesRowLevelSecurity: false,
      }],
      tenantTables: requiredTenantTables.map((qualifiedName) => ({
        qualifiedName,
        rowLevelSecurityEnabled: true,
        ownerRole: "edumanager_migrator",
        runtimeCanUseOwnerPrivileges: false,
      })),
    }),
  };
  const app = buildApp(config, false, {
    resolveTenantContext: async () => null,
    tenantDatabaseSafety: {
      inspector,
      requiredTenantTables: mutableTables,
    },
  });

  inspector.inspect = async () => ({
    roleName: "edumanager_runtime",
    settableRoles: [{
      name: "edumanager_runtime",
      isSuperuser: false,
      bypassesRowLevelSecurity: true,
    }],
    tenantTables: [],
  });
  mutableTables[0] = "public.untrusted_replacement";

  await app.ready();
  await app.close();
});

test("school context route requires authentication before membership resolution", async () => {
  let resolverCalled = false;
  const app = buildApp(config, false, {
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
    resolveTenantContext: async () => {
      resolverCalled = true;
      return {
        userId: "user-a",
        schoolId: "school-a",
        membershipId: "membership-a",
        role: "school_admin",
      };
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context",
      headers: { "x-user-id": "user-a", "x-school-id": "school-a" },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(resolverCalled, false);
  } finally {
    await app.close();
  }
});

test("school context resolver receives only authenticated identity and requested path scope", async () => {
  const resolverCalls: Array<{ authenticatedUserId: string; requestedSchoolId: string }> = [];
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({
      userId: "user-a",
      userStatus: "active",
      schoolId: "forged-school",
      role: "school_owner",
    }),
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
    resolveTenantContext: async (input) => {
      resolverCalls.push(input);
      return {
        userId: input.authenticatedUserId,
        schoolId: input.requestedSchoolId,
        membershipId: "membership-a",
        role: "teacher",
        platformRole: "platform_owner",
        permissions: ["*"],
      };
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context?schoolId=school-c",
      headers: { "x-school-id": "school-b" },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { schoolId: "school-a", role: "teacher" });
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(resolverCalls, [{
      authenticatedUserId: "user-a",
      requestedSchoolId: "school-a",
    }]);
  } finally {
    await app.close();
  }
});

test("school context route snapshots resolver context fields exactly once", async () => {
  const reads = { userId: 0, schoolId: 0, membershipId: 0, role: 0 };
  const resolverContext = {
    get userId() {
      reads.userId += 1;
      return reads.userId === 1 ? "user-a" : "user-b";
    },
    get schoolId() {
      reads.schoolId += 1;
      return reads.schoolId === 1 ? "school-a" : "school-b";
    },
    get membershipId() {
      reads.membershipId += 1;
      return reads.membershipId === 1 ? "membership-a" : "";
    },
    get role() {
      reads.role += 1;
      return reads.role === 1 ? "teacher" : "school_owner";
    },
  };

  const app = buildApp(config, false, {
    authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
    resolveTenantContext: async () => resolverContext,
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context",
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { schoolId: "school-a", role: "teacher" });
    assert.deepEqual(reads, { userId: 1, schoolId: 1, membershipId: 1, role: 1 });
  } finally {
    await app.close();
  }
});

test("school context route rejects resolver results whose accessors throw", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
    resolveTenantContext: async () => ({
      userId: "user-a",
      schoolId: "school-a",
      membershipId: "membership-a",
      get role(): string {
        throw new Error("private tenant context getter detail");
      },
    }),
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context",
    });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      error: "Forbidden",
      message: "You do not have access to this school.",
    });
    assert.equal(JSON.stringify(response.json()).includes("private tenant context getter detail"), false);
  } finally {
    await app.close();
  }
});

test("school context route rejects mismatched or malformed resolver results", async () => {
  const invalidContexts: unknown[] = [
    null,
    [],
    {},
    { userId: "user-b", schoolId: "school-a", membershipId: "membership-a", role: "teacher" },
    { userId: "user-a", schoolId: "school-b", membershipId: "membership-a", role: "teacher" },
    { userId: "user-a", schoolId: "school-a", membershipId: " ", role: "teacher" },
    { userId: "user-a", schoolId: "school-a", membershipId: "membership-a", role: "platform_owner" },
  ];

  for (const context of invalidContexts) {
    const app = buildApp(config, false, {
      authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
      tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
      resolveTenantContext: async () => context,
    });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schools/school-a/context",
      });
      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.json(), {
        error: "Forbidden",
        message: "You do not have access to this school.",
      });
    } finally {
      await app.close();
    }
  }
});

test("school context route rejects malformed requested school identifiers", async () => {
  let resolverCalled = false;
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
    resolveTenantContext: async () => {
      resolverCalled = true;
      return null;
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/%20/context",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(resolverCalled, false);
  } finally {
    await app.close();
  }
});

test("school membership resolver normalizes persistence failures and ignores database HTTP statuses", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
    resolveTenantContext: async () => {
      throw Object.assign(new Error("private membership query details"), { statusCode: 403 });
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context",
    });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: "Service Unavailable",
      message: "School access is temporarily unavailable.",
    });
    assert.equal(JSON.stringify(response.json()).includes("private membership query details"), false);
  } finally {
    await app.close();
  }
});


test("school context route composes trusted membership snapshots and denies another school", async () => {
  const userId = "a0000000-0000-4000-8000-000000000001";
  const schoolA = "00000000-0000-4000-8000-000000000002";
  const schoolB = "00000000-0000-4000-8000-000000000003";
  const membershipId = "00000000-0000-4000-8000-000000000004";
  const readerCalls: Array<{ authenticatedUserId: string; requestedSchoolId: string }> = [];

  const resolveTenantContext = createTenantContextResolver({
    loadTenantMembership: async (input) => {
      readerCalls.push(input);
      if (input.authenticatedUserId !== userId || input.requestedSchoolId !== schoolA) {
        return null;
      }

      return {
        user: { id: userId, status: "active" },
        school: { id: schoolA, status: "active" },
        membership: {
          id: membershipId,
          userId,
          schoolId: schoolA,
          role: "teacher",
          status: "active",
        },
      };
    },
  });

  const app = buildApp(config, false, {
    authenticateRequest: async () => ({
      userId,
      userStatus: "active",
      schoolId: schoolB,
      role: "school_owner",
    }),
    resolveTenantContext,
    tenantDatabaseSafety: createSafeTenantDatabaseSafety(),
  });

  try {
    const schoolAResponse = await app.inject({
      method: "GET",
      url: `/api/v1/schools/${schoolA}/context?schoolId=${schoolB}`,
      headers: { "x-school-id": schoolB },
    });
    assert.equal(schoolAResponse.statusCode, 200);
    assert.deepEqual(schoolAResponse.json(), { schoolId: schoolA, role: "teacher" });

    const schoolBResponse = await app.inject({
      method: "GET",
      url: `/api/v1/schools/${schoolB}/context?schoolId=${schoolA}`,
      headers: { "x-school-id": schoolA },
    });
    assert.equal(schoolBResponse.statusCode, 403);
    assert.deepEqual(schoolBResponse.json(), {
      error: "Forbidden",
      message: "You do not have access to this school.",
    });

    assert.deepEqual(readerCalls, [
      { authenticatedUserId: userId, requestedSchoolId: schoolA },
      { authenticatedUserId: userId, requestedSchoolId: schoolB },
    ]);
  } finally {
    await app.close();
  }
});
