import type { TestInfo } from "@playwright/test";
import { Pool } from "pg";

export const E2E_NAME_PREFIX = "E2E";
export const E2E_REGISTRATION_PREFIX = "E2E-";

let pool: Pool | null = null;

/**
 * Postgres pool for E2E specs to create and remove their own records, so
 * state-changing flows never share data with other specs, browsers or workers.
 * Uses `pg` directly because Playwright loads specs as CommonJS and cannot
 * import the ESM Prisma client.
 */
export function getE2eDb(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set for E2E data helpers");
  }
  pool = new Pool({ connectionString, max: 2 });
  return pool;
}

/**
 * Closes the shared E2E pool. Call from afterAll hooks.
 */
export async function disconnectE2eDb(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

/**
 * Short tag unique to this spec run: three letters of the browser project,
 * the worker index and four random characters, used in every record name the
 * spec creates.
 */
export function buildE2eTag({ testInfo }: { testInfo: TestInfo }): string {
  const project = testInfo.project.name.replace(/[^a-z0-9]/gi, "").slice(0, 3);
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `${project}${testInfo.workerIndex}${random}`.toUpperCase();
}

const E2E_TAG_PATTERN = "[A-Z]{3}[0-9]+[A-Z0-9]{4}";

/**
 * Removes records created by E2E specs, optionally limited to one tag.
 * Drivers, customers and jobs are matched by the tagged name
 * (`E2E <tag> ...`) or registration (`E2E-<tag>-...`), and vehicles by the
 * tagged registration. Without a tag, only
 * names in the exact shape `buildE2eTag` produces are removed, so real data
 * that merely starts with "E2E" is never touched. RCTIs, lines, deductions
 * and jobs reports cascade from their driver.
 */
export async function cleanupE2eData({
  db,
  tag,
}: {
  db: Pool;
  tag?: string;
}): Promise<void> {
  const tagPattern = tag ?? E2E_TAG_PATTERN;
  const namePattern = `^${E2E_NAME_PREFIX} ${tagPattern}( |$)`;
  const registrationPattern = `^${E2E_REGISTRATION_PREFIX}${tagPattern}-`;

  await db.query(
    `DELETE FROM "Jobs" WHERE driver ~ $1 OR registration ~ $2 OR customer ~ $1`,
    [namePattern, registrationPattern],
  );
  await db.query(`DELETE FROM "Driver" WHERE driver ~ $1`, [namePattern]);
  await db.query(`DELETE FROM "Customer" WHERE customer ~ $1`, [namePattern]);
  await db.query(`DELETE FROM "Vehicle" WHERE registration ~ $1`, [
    registrationPattern,
  ]);
}
