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
 * Short tag unique to this spec run, browser project and worker, used in
 * every record name the spec creates.
 */
export function buildE2eTag({ testInfo }: { testInfo: TestInfo }): string {
  const project = testInfo.project.name.replace(/[^a-z0-9]/gi, "").slice(0, 3);
  const random = Math.random().toString(36).slice(2, 6);
  return `${project}${testInfo.workerIndex}${random}`.toUpperCase();
}

/**
 * Removes records created by E2E specs: every driver, customer and job whose
 * name or registration carries the E2E prefix, optionally limited to one tag.
 * RCTIs, lines, deductions and jobs reports cascade from their driver.
 */
export async function cleanupE2eData({
  db,
  tag,
}: {
  db: Pool;
  tag?: string;
}): Promise<void> {
  const namePrefix = `${tag ? `${E2E_NAME_PREFIX} ${tag}` : `${E2E_NAME_PREFIX} `}%`;
  const registrationPrefix = `${tag ? `${E2E_REGISTRATION_PREFIX}${tag}` : E2E_REGISTRATION_PREFIX}%`;

  await db.query(
    `DELETE FROM "Jobs" WHERE driver ILIKE $1 OR registration ILIKE $2 OR customer ILIKE $1`,
    [namePrefix, registrationPrefix],
  );
  await db.query(`DELETE FROM "Driver" WHERE driver ILIKE $1`, [namePrefix]);
  await db.query(`DELETE FROM "Customer" WHERE customer ILIKE $1`, [
    namePrefix,
  ]);
}
