import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import {
  RCTI_TRANSACTION_OPTIONS,
  transitionRctiStatus,
} from "@/lib/rcti-status";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/rcti/[id]/pay
 * Mark an RCTI as paid
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error marking RCTI as paid",
  responseMessage: "Failed to mark RCTI as paid",
  handler: async ({ userId, params: { id: rctiId } }) => {
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status === "paid") {
      return NextResponse.json(
        { error: "RCTI is already marked as paid" },
        { status: 400 },
      );
    }

    if (rcti.status === "draft") {
      return NextResponse.json(
        {
          error: "Cannot mark a draft RCTI as paid. Please finalise it first.",
        },
        { status: 400 },
      );
    }

    const updatedRcti = await prisma.$transaction(
      (tx) =>
        transitionRctiStatus({
          tx,
          rctiId,
          fromStatus: "finalised",
          toStatus: "paid",
          changedBy: userId,
          data: { paidAt: new Date() },
        }),
      RCTI_TRANSACTION_OPTIONS,
    );

    return NextResponse.json(updatedRcti);
  },
});
