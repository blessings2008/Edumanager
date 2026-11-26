import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Client, Pool } from "pg";
import type { TenantRequestContext } from "../src/domain/tenant-authorization.js";
import {
  RuntimeDatabaseRoleSafetyError,
} from "../src/persistence/database-runtime-role-safety.js";
import {
  createPostgresVerifiedTenantTransactionRunner,
} from "../src/persistence/postgres-verified-tenant-transaction.js";
import type {
  TenantTransactionConnection,
} from "../src/persistence/tenant-transaction.js";

const connectionString = process.env.EDUMANAGER_POSTGRES_TEST_URL;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function createRunner(pool: Pool, requiredTables: readonly string[]) {
  return createPostgresVerifiedTenantTransactionRunner({
    async connect() {
      const client = await pool.connect();
      const connection: TenantTransactionConnection = {
        query: async (sql, values) => client.query(sql, values as unknown[]),
        release: (error) => client.release(error),
      };
      return connection;
    },
  }, requiredTables);
}

function context(schoolId: string): TenantRequestContext {
  return {
    userId: `user-${schoolId}`,
    schoolId,
    membershipId: `membership-${schoolId}`,
    role: "teacher",
  };
}

test("PostgreSQL 17 verified tenant runner isolates concurrent schools on separate physical pool connections", {
  skip: !connectionString,
  timeout: 30_000,
}, async () => {
  if (!connectionString) return;

  const suffix = randomBytes(6).toString("hex");
  const schema = `edumanager_runner_${suffix}`;
  const runtimeRole = `edumanager_runtime_${suffix}`;
  const ownerRole = `edumanager_owner_${suffix}`;
  const password = randomBytes(24).toString("hex");
  const qualifiedTable = `${schema}.school_records`;
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier("school_records")}`;
  const requiredTables = [qualifiedTable];
  const runtimeUrl = new URL(connectionString);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = password;

  const admin = new Client({ connectionString });
  let safePool: Pool | undefined;
  let unsafePool: Pool | undefined;

  await admin.connect();

  try {
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(runtimeRole)} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`,
    );
    await admin.query(
      `CREATE ROLE ${quoteIdentifier(ownerRole)} NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await admin.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    await admin.query(
      `CREATE TABLE ${table} (
        id text PRIMARY KEY,
        school_id text NOT NULL,
        payload text NOT NULL
      )`,
    );
    await admin.query(
      `ALTER TABLE ${table} OWNER TO ${quoteIdentifier(ownerRole)}`,
    );
    await admin.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await admin.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    await admin.query(
      `CREATE POLICY school_scope ON ${table}
       FOR ALL TO ${quoteIdentifier(runtimeRole)}
       USING (school_id = current_setting('app.school_id', true))
       WITH CHECK (school_id = current_setting('app.school_id', true))`,
    );
    await admin.query(
      `GRANT USAGE ON SCHEMA ${quoteIdentifier(schema)} TO ${quoteIdentifier(runtimeRole)}`,
    );
    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${table} TO ${quoteIdentifier(runtimeRole)}`,
    );
    await admin.query(
      `INSERT INTO ${table} (id, school_id, payload)
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      ["record-a", "school-a", "A", "record-b", "school-b", "B"],
    );

    safePool = new Pool({
      connectionString: runtimeUrl.toString(),
      max: 2,
      connectionTimeoutMillis: 5_000,
    });
    const runner = createRunner(safePool, requiredTables);

    let arrivals = 0;
    let releaseBarrier!: () => void;
    const bothTransactionsReady = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const barrierTimeout = setTimeout(releaseBarrier, 10_000);

    async function waitForBothConnections(): Promise<void> {
      arrivals += 1;
      if (arrivals === 2) {
        clearTimeout(barrierTimeout);
        releaseBarrier();
      }
      await bothTransactionsReady;
    }

    async function readAsSchool(
      schoolId: string,
      otherRecordId: string,
    ): Promise<{
      backendPid: number;
      visibleSchoolIds: string[];
      otherSchoolUpdateCount: number | null;
      otherSchoolDeleteCount: number | null;
    }> {
      return runner.run(context(schoolId), async (executor) => {
        const backend = await executor.query(
          "SELECT pg_backend_pid() AS pid",
        ) as { rows: Array<{ pid: number | string }> };
        await waitForBothConnections();

        const visible = await executor.query(
          `SELECT id, school_id FROM ${table} ORDER BY id`,
        ) as { rows: Array<{ id: string; school_id: string }> };
        const update = await executor.query(
          `UPDATE ${table} SET payload = 'changed' WHERE id = $1`,
          [otherRecordId],
        ) as { rowCount: number | null };
        const deletion = await executor.query(
          `DELETE FROM ${table} WHERE id = $1`,
          [otherRecordId],
        ) as { rowCount: number | null };

        return {
          backendPid: Number(backend.rows[0]?.pid),
          visibleSchoolIds: visible.rows.map((row) => row.school_id),
          otherSchoolUpdateCount: update.rowCount,
          otherSchoolDeleteCount: deletion.rowCount,
        };
      });
    }

    const [schoolA, schoolB] = await Promise.all([
      readAsSchool("school-a", "record-b"),
      readAsSchool("school-b", "record-a"),
    ]);

    assert.notEqual(
      schoolA.backendPid,
      schoolB.backendPid,
      "concurrent tenant transactions must occupy separate physical PostgreSQL connections",
    );
    assert.deepEqual(schoolA.visibleSchoolIds, ["school-a"]);
    assert.deepEqual(schoolB.visibleSchoolIds, ["school-b"]);
    assert.equal(schoolA.otherSchoolUpdateCount, 0);
    assert.equal(schoolA.otherSchoolDeleteCount, 0);
    assert.equal(schoolB.otherSchoolUpdateCount, 0);
    assert.equal(schoolB.otherSchoolDeleteCount, 0);

    await assert.rejects(
      runner.run(context("school-a"), async (executor) => {
        await executor.query(
          `INSERT INTO ${table} (id, school_id, payload) VALUES ($1, $2, $3)`,
          ["forged-record", "school-b", "must-not-commit"],
        );
      }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "42501");
        return true;
      },
    );

    const forgedRecord = await admin.query(
      `SELECT id FROM ${table} WHERE id = $1`,
      ["forged-record"],
    );
    assert.equal(forgedRecord.rowCount, 0);

    const unchangedOtherRecord = await admin.query(
      `SELECT payload FROM ${table} WHERE id = $1`,
      ["record-b"],
    );
    assert.equal(unchangedOtherRecord.rows[0]?.payload, "B");

    await safePool.end();
    safePool = undefined;

    await admin.query(
      `GRANT ${quoteIdentifier(ownerRole)} TO ${quoteIdentifier(runtimeRole)} WITH SET TRUE, INHERIT FALSE`,
    );
    unsafePool = new Pool({
      connectionString: runtimeUrl.toString(),
      max: 1,
      connectionTimeoutMillis: 5_000,
    });
    const unsafeRunner = createRunner(unsafePool, requiredTables);
    let unsafeWorkCalled = false;

    await assert.rejects(
      unsafeRunner.run(context("school-a"), async () => {
        unsafeWorkCalled = true;
        return undefined;
      }),
      (error: unknown) => {
        assert.ok(error instanceof RuntimeDatabaseRoleSafetyError);
        assert.equal(error.code, "runtime_role_can_assume_table_owner");
        return true;
      },
    );
    assert.equal(unsafeWorkCalled, false);
  } finally {
    await safePool?.end().catch(() => undefined);
    await unsafePool?.end().catch(() => undefined);
    await admin.query(
      `REVOKE ${quoteIdentifier(ownerRole)} FROM ${quoteIdentifier(runtimeRole)}`,
    ).catch(() => undefined);
    await admin.query(
      `DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`,
    ).catch(() => undefined);
    await admin.query(
      `DROP ROLE IF EXISTS ${quoteIdentifier(runtimeRole)}, ${quoteIdentifier(ownerRole)}`,
    ).catch(() => undefined);
    await admin.end();
  }
});
