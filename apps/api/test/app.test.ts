import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

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
