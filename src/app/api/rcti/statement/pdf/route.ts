import { NextResponse } from "next/server";

import { requireRctiAccess } from "@/lib/rcti-access";
import { apiRoute } from "@/lib/api-route";
import { rctiStatementSchema } from "@/lib/validation";
import { buildRctiStatementFilename } from "@/lib/rcti-statement";
import {
  loadRctiStatement,
  renderRctiStatementPdf,
} from "@/lib/rcti-statement-server";

/**
 * POST /api/rcti/statement/pdf
 * Generate one PDF for a driver's selected finalised or paid RCTIs: the
 * statement summary, each full RCTI, or the statement followed by the RCTIs.
 * Body: { driverId, rctiIds, includeStatement?: boolean, includeRctis?: boolean }
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  validationMessage: "Invalid statement request",
  errorMessage: "Error generating RCTI statement PDF",
  responseMessage: "Failed to generate statement PDF",
  handler: async ({ request }) => {
    const body = await request.json().catch(() => null);
    const { driverId, rctiIds, includeStatement, includeRctis } =
      rctiStatementSchema.parse(body);

    const data = await loadRctiStatement({ driverId, rctiIds });
    const buffer = await renderRctiStatementPdf({
      data,
      includeStatement,
      includeRctis,
    });

    const filename = buildRctiStatementFilename({
      driverName: data.driver.driverName,
      periodStart: data.statement.periodStart,
      periodEnd: data.statement.periodEnd,
      includeStatement,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
});
