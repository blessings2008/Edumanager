import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { SCHOOL_ROLES } from "../../../packages/contracts/src/identity.js";
import { TENANT_SCHOOL_ROLES } from "../src/domain/tenant-authorization.js";

const config = {
  port: 4000,
  host: "127.0.0.1",
  webOrigins: ["http://localhost:5173"],
  trustedProxies: [],
};

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

test("GET /api/v1/me does not expose authentication adapter failures", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => {
      throw new Error("private session token detail");
    },
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/me" });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().message, "An unexpected error occurred.");
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

test("school context route requires authentication before membership resolution", async () => {
  let resolverCalled = false;
  const app = buildApp(config, false, {
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
    assert.deepEqual(resolverCalls, [{
      authenticatedUserId: "user-a",
      requestedSchoolId: "school-a",
    }]);
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

test("school membership resolver failures do not expose internal details", async () => {
  const app = buildApp(config, false, {
    authenticateRequest: async () => ({ userId: "user-a", userStatus: "active" }),
    resolveTenantContext: async () => {
      throw new Error("private membership query details");
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schools/school-a/context",
    });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().message, "An unexpected error occurred.");
    assert.equal(JSON.stringify(response.json()).includes("private membership query details"), false);
  } finally {
    await app.close();
  }
});
