import assert from "node:assert/strict";
import test from "node:test";
import { resolveTenantHost } from "../src/domain/tenant.js";

const domain = "schools.example.com";

test("resolves a valid school subdomain", () => {
  assert.deepEqual(resolveTenantHost("north-high.schools.example.com", domain), { kind: "school", slug: "north-high" });
});
test("recognises platform hosts without assigning a tenant", () => {
  assert.deepEqual(resolveTenantHost(domain, domain), { kind: "platform" });
  assert.deepEqual(resolveTenantHost("www." + domain, domain), { kind: "platform" });
});
test("does not resolve unrelated or nested hostnames", () => {
  assert.deepEqual(resolveTenantHost("example.com", domain), { kind: "unmatched" });
  assert.deepEqual(resolveTenantHost("a.b.schools.example.com", domain), { kind: "unmatched" });
  assert.deepEqual(resolveTenantHost("north-high.evil-example.com", domain), { kind: "unmatched" });
});
test("normalises case and a trailing dot", () => {
  assert.deepEqual(resolveTenantHost("North-High.Schools.Example.Com.", domain), { kind: "school", slug: "north-high" });
});
test("rejects malformed host values and invalid slugs", () => {
  assert.deepEqual(resolveTenantHost("https://north-high.schools.example.com/path", domain), { kind: "unmatched" });
  assert.deepEqual(resolveTenantHost("-north.schools.example.com", domain), { kind: "unmatched" });
  assert.deepEqual(resolveTenantHost("north-.schools.example.com", domain), { kind: "unmatched" });
  assert.deepEqual(resolveTenantHost("north.schools.example.com:443", domain), { kind: "unmatched" });\n  assert.deepEqual(resolveTenantHost("north.schools.example.com:80", domain), { kind: "unmatched" });\n  assert.deepEqual(resolveTenantHost("north\\\\schools.example.com", domain), { kind: "unmatched" });\n  assert.deepEqual(resolveTenantHost("north%2eschools.example.com", domain), { kind: "unmatched" });\n  assert.deepEqual(resolveTenantHost("north schools.example.com", domain), { kind: "unmatched" });
});
