import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

const config = { port: 4000, host: "127.0.0.1", webOrigins: ["http://localhost:5173"] };

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

test("readConfig parses comma-separated allowed web origins", () => {
  const parsed = readConfig({
    API_PORT: "4100", API_HOST: "127.0.0.1",
    WEB_ORIGIN: "http://localhost:5173,https://school.example",
  });
  assert.equal(parsed.port, 4100);
  assert.deepEqual(parsed.webOrigins, ["http://localhost:5173", "https://school.example"]);
});

test("readConfig rejects an invalid API port", () => {
  assert.throws(() => readConfig({ API_PORT: "70000" }), /API_PORT/);
});

test("readConfig rejects an invalid web origin", () => {
  assert.throws(() => readConfig({ WEB_ORIGIN: "javascript:alert(1)" }), /WEB_ORIGIN/);
});
