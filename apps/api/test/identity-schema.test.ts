import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MEMBERSHIP_STATUSES,
  SCHOOL_DOMAIN_KINDS,
  SCHOOL_DOMAIN_VERIFICATION_STATUSES,
  SCHOOL_ROLES,
  SCHOOL_STATUSES,
  USER_STATUSES,
} from "../../../packages/contracts/src/identity.js";

const initialMigration = await readFile(
  new URL("../../../supabase/migrations/20261111174756_initial_school_tenancy_foundation.sql", import.meta.url),
  "utf8",
);
const alignmentMigration = await readFile(
  new URL("../../../supabase/migrations/20261112153700_align_identity_schema_contracts.sql", import.meta.url),
  "utf8",
);

function quotedValues(source: string): string[] {
  return [...source.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? "").sort();
}

function addedConstraintValues(constraint: string, field: string): string[] {
  const pattern = new RegExp(
    `ADD CONSTRAINT ${constraint} CHECK \\\\\\\(${field} IN \\\\\\\(([^)]*)\\\\\\\)\\\\\\\)`,
    "i",
  );
  const match = alignmentMigration.match(pattern);
  assert.ok(match, `Expected migration to define ${constraint}`);
  return quotedValues(match[1] ?? "");
}

function initialInlineConstraintValues(pattern: RegExp, description: string): string[] {
  const match = initialMigration.match(pattern);
  assert.ok(match, `Expected initial migration to define ${description}`);
  return quotedValues(match[1] ?? "");
}

test("initial user and domain verification values match the shared contracts", () => {
  const userStatuses = initialInlineConstraintValues(
    /status text not null default 'active'\s+check \(status in \(([^)]*)\)\)/i,
    "user status constraint",
  );
  const domainStatuses = initialInlineConstraintValues(
    /verification_status text not null default 'pending'\s+check \(verification_status in \(([^)]*)\)\)/i,
    "domain verification constraint",
  );

  assert.deepEqual(userStatuses, [...USER_STATUSES].sort());
  assert.deepEqual(domainStatuses, [...SCHOOL_DOMAIN_VERIFICATION_STATUSES].sort());
});

test("alignment migration school and membership constraints match the shared contracts", () => {
  assert.deepEqual(addedConstraintValues("schools_status_check", "status"), [...SCHOOL_STATUSES].sort());
  assert.deepEqual(addedConstraintValues("school_memberships_role_check", "role"), [...SCHOOL_ROLES].sort());
  assert.deepEqual(addedConstraintValues("school_memberships_status_check", "status"), [...MEMBERSHIP_STATUSES].sort());
});

test("school-domain kinds match the shared contracts and are never guessed for existing rows", () => {
  assert.deepEqual(addedConstraintValues("school_domains_kind_check", "kind"), [...SCHOOL_DOMAIN_KINDS].sort());
  assert.match(alignmentMigration, /IF EXISTS \(SELECT 1 FROM public\.school_domains\) THEN[\s\S]*RAISE EXCEPTION/i);
});

test("database columns required by user and school identity contracts exist", () => {
  assert.match(initialMigration, /full_name text not null/i);
  assert.match(alignmentMigration, /ADD COLUMN IF NOT EXISTS email_verified_at timestamptz/i);
  assert.match(initialMigration, /country_code char\(2\) not null/i);
  assert.match(initialMigration, /timezone text not null/i);
});
