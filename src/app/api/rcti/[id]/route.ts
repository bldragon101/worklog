import { NextResponse } from "next/server";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { lockRcti, RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import { rctiUpdateSchema, rctiLineUpdateSchema } from "@/lib/validation";
import {
  calculateLineAmounts,
  calculateRctiTotals,
  getLineDriverHours,
  getLineDriverHoursBreakdown,
  getTotalDriverHours,
  toNumber,
} from "@/lib/utils/rcti-calculations";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * GET /api/rcti/[id]
 * Get a single RCTI with lines
 */
export const GET = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error fetching RCTI",
  responseMessage: "Failed to fetch RCTI",
  handler: async ({ params: { id: rctiId } }) => {
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    return NextResponse.json(rcti);
  },
});

/**
 * PATCH /api/rcti/[id]
 * Update RCTI details, status, or lines
 */
export const PATCH = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error updating RCTI",
  responseMessage: "Failed to update RCTI",
  handler: async ({ request, params: { id: rctiId } }) => {
    const body = await request.json();

    // Check if updating lines
    if (body.lines && Array.isArray(body.lines)) {
      // Validate every edit before touching the database
      const lineEdits: Array<{
        id: number;
        data: z.infer<typeof rctiLineUpdateSchema>;
      }> = [];
      for (const lineUpdate of body.lines) {
        if (!lineUpdate.id) continue;

        const validation = rctiLineUpdateSchema.safeParse(lineUpdate);
        if (!validation.success) {
          return NextResponse.json(
            {
              error: "Invalid line data",
              details: validation.error,
              lineId: lineUpdate.id,
            },
            { status: 400 },
          );
        }
        lineEdits.push({ id: lineUpdate.id as number, data: validation.data });
      }

      // Lock the RCTI so edits cannot interleave with a refresh or finalise
      const outcome = await prisma.$transaction(async (tx) => {
        const lockedStatus = await lockRcti({ tx, rctiId });
        if (lockedStatus === null) {
          return { status: 404, error: "RCTI not found" };
        }
        if (lockedStatus !== "draft") {
          return {
            status: 400,
            error: "Cannot update lines of a finalised or paid RCTI",
          };
        }

        const rcti = await tx.rcti.findUniqueOrThrow({
          where: { id: rctiId },
        });

        for (const { id: lineId, data } of lineEdits) {
          const existingLine = await tx.rctiLine.findUnique({
            where: { id: lineId },
          });

          if (!existingLine || existingLine.rctiId !== rctiId) {
            continue;
          }

          const chargedHours = toNumber(
            data.chargedHours ?? existingLine.chargedHours,
          );
          const travelTimeHours =
            data.travelTimeHours !== undefined
              ? (data.travelTimeHours ?? 0)
              : existingLine.travelTimeHours === null
                ? 0
                : toNumber(existingLine.travelTimeHours);
          const hoursChanged =
            data.chargedHours !== undefined ||
            data.travelTimeHours !== undefined;

          // A line keeps the deduction that was carried over from its job, so
          // editing the hours re-applies it rather than silently paying the
          // withheld hours back to the driver.
          const existingBreakdown = getLineDriverHoursBreakdown({
            chargedHours: existingLine.chargedHours,
            travelTimeHours: existingLine.travelTimeHours,
            driverCharge: existingLine.driverCharge,
          });
          const totalDriverHours = hoursChanged
            ? getTotalDriverHours({
                chargedHours,
                travelTimeHours,
                driverCharge: null,
                hoursAdjustment: existingBreakdown.adjustmentFromBase,
              })
            : existingBreakdown.totalDriverHours;
          // `driverCharge` on a line is the resolved total, never an adjustment.
          const driverCharge = totalDriverHours;
          const ratePerHour = toNumber(
            data.ratePerHour ?? existingLine.ratePerHour,
          );
          const jobDate = data.jobDate
            ? new Date(data.jobDate)
            : existingLine.jobDate;
          const customer = data.customer ?? existingLine.customer;
          const truckType = data.truckType ?? existingLine.truckType;
          const description = data.description ?? existingLine.description;

          const amounts = calculateLineAmounts({
            chargedHours: totalDriverHours,
            ratePerHour,
            gstStatus: rcti.gstStatus as "registered" | "not_registered",
            gstMode: rcti.gstMode as "exclusive" | "inclusive",
          });

          await tx.rctiLine.update({
            where: { id: lineId },
            data: {
              chargedHours,
              travelTimeHours,
              driverCharge,
              ratePerHour,
              jobDate,
              customer,
              truckType,
              description,
              ...amounts,
            },
          });
        }

        // Recalculate totals
        const allLines = await tx.rctiLine.findMany({
          where: { rctiId },
        });

        const totals = calculateRctiTotals(allLines);

        const updatedRcti = await tx.rcti.update({
          where: { id: rctiId },
          data: {
            subtotal: totals.subtotal,
            gst: totals.gst,
            total: totals.total,
          },
          include: {
            driver: true,
            lines: {
              orderBy: { jobDate: "asc" },
            },
          },
        });

        return { updatedRcti };
      }, RCTI_TRANSACTION_OPTIONS);

      if ("error" in outcome) {
        return NextResponse.json(
          { error: outcome.error },
          { status: outcome.status },
        );
      }
      const { updatedRcti } = outcome;

      return NextResponse.json(updatedRcti);
    }

    // Update RCTI metadata (not lines)
    const validation = rctiUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400 },
      );
    }

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { lines: true },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    // Reject direct status changes to finalised or paid
    if (validation.data.status) {
      const currentStatus = rcti.status;
      const newStatus = validation.data.status;

      // Reject attempts to set status to finalised
      if (newStatus === "finalised") {
        return NextResponse.json(
          {
            error:
              "Cannot set status to 'finalised' directly. Use POST /api/rcti/[id]/finalise to finalise the RCTI, which will apply deductions and recalculate totals.",
          },
          { status: 400 },
        );
      }

      // Reject attempts to set status to paid
      if (newStatus === "paid") {
        return NextResponse.json(
          {
            error:
              "Cannot set status to 'paid' directly. Use POST /api/rcti/[id]/pay to mark the RCTI as paid, which will set the paidAt timestamp.",
          },
          { status: 400 },
        );
      }

      // Prevent any status change from paid (since we already returned if newStatus is paid, this only runs for draft)
      if (currentStatus === "paid") {
        return NextResponse.json(
          { error: "Cannot change status of a paid RCTI" },
          { status: 400 },
        );
      }

      // Unfinalise reverses applied deductions and records who did it
      if (currentStatus === "finalised" && newStatus === "draft") {
        return NextResponse.json(
          {
            error:
              "Cannot set status to 'draft' directly. Use POST /api/rcti/[id]/unfinalise to return the RCTI to draft, which will reverse its deductions and record the change.",
          },
          { status: 400 },
        );
      }
    }

    // Reject GST changes for non-draft RCTIs
    if (
      rcti.status !== "draft" &&
      (validation.data.gstStatus || validation.data.gstMode)
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot change GST status or mode for a finalised or paid RCTI. Only draft RCTIs can have their GST settings modified.",
        },
        { status: 400 },
      );
    }

    // If changing GST status/mode and RCTI is draft, recalculate lines
    if (
      rcti.status === "draft" &&
      (validation.data.gstStatus || validation.data.gstMode)
    ) {
      const newGstStatus = validation.data.gstStatus || rcti.gstStatus;
      const newGstMode = validation.data.gstMode || rcti.gstMode;

      // Recalculate all lines
      for (const line of rcti.lines) {
        const amounts = calculateLineAmounts({
          chargedHours: getLineDriverHours({
            chargedHours: line.chargedHours,
            travelTimeHours: line.travelTimeHours,
            driverCharge: line.driverCharge,
          }),
          ratePerHour: toNumber(line.ratePerHour),
          gstStatus: newGstStatus as "registered" | "not_registered",
          gstMode: newGstMode as "exclusive" | "inclusive",
        });

        await prisma.rctiLine.update({
          where: { id: line.id },
          data: amounts,
        });
      }

      // Recalculate totals
      const updatedLines = await prisma.rctiLine.findMany({
        where: { rctiId },
      });

      const totals = calculateRctiTotals(updatedLines);

      const updateData: Record<string, unknown> = {
        subtotal: totals.subtotal,
        gst: totals.gst,
        total: totals.total,
      };

      if (validation.data.driverName !== undefined) {
        updateData.driverName = validation.data.driverName;
      }
      if (validation.data.businessName !== undefined) {
        updateData.businessName = validation.data.businessName;
      }
      if (validation.data.driverAddress !== undefined) {
        updateData.driverAddress = validation.data.driverAddress;
      }
      if (validation.data.driverAbn !== undefined) {
        updateData.driverAbn = validation.data.driverAbn;
      }
      if (validation.data.gstStatus !== undefined) {
        updateData.gstStatus = validation.data.gstStatus;
      }
      if (validation.data.gstMode !== undefined) {
        updateData.gstMode = validation.data.gstMode;
      }
      if (validation.data.bankAccountName !== undefined) {
        updateData.bankAccountName = validation.data.bankAccountName;
      }
      if (validation.data.bankBsb !== undefined) {
        updateData.bankBsb = validation.data.bankBsb;
      }
      if (validation.data.bankAccountNumber !== undefined) {
        updateData.bankAccountNumber = validation.data.bankAccountNumber;
      }
      if (validation.data.notes !== undefined) {
        updateData.notes = validation.data.notes;
      }
      if (validation.data.sentAt !== undefined) {
        updateData.sentAt = validation.data.sentAt ?? null;
      }

      const updatedRcti = await prisma.rcti.update({
        where: { id: rctiId },
        data: updateData,
        include: {
          driver: true,
          lines: {
            orderBy: { jobDate: "asc" },
          },
        },
      });

      return NextResponse.json(updatedRcti);
    }

    // Simple update without recalculation (only for non-draft or non-GST changes)
    const updateData: Record<string, unknown> = {};

    if (validation.data.driverName !== undefined) {
      updateData.driverName = validation.data.driverName;
    }
    if (validation.data.businessName !== undefined) {
      updateData.businessName = validation.data.businessName;
    }
    if (validation.data.driverAddress !== undefined) {
      updateData.driverAddress = validation.data.driverAddress;
    }
    if (validation.data.driverAbn !== undefined) {
      updateData.driverAbn = validation.data.driverAbn;
    }
    // Note: GST changes are blocked for non-draft RCTIs above, so these won't be set
    if (validation.data.gstStatus !== undefined) {
      updateData.gstStatus = validation.data.gstStatus;
    }
    if (validation.data.gstMode !== undefined) {
      updateData.gstMode = validation.data.gstMode;
    }
    if (validation.data.bankAccountName !== undefined) {
      updateData.bankAccountName = validation.data.bankAccountName;
    }
    if (validation.data.bankBsb !== undefined) {
      updateData.bankBsb = validation.data.bankBsb;
    }
    if (validation.data.bankAccountNumber !== undefined) {
      updateData.bankAccountNumber = validation.data.bankAccountNumber;
    }
    if (validation.data.notes !== undefined) {
      updateData.notes = validation.data.notes;
    }
    if (validation.data.sentAt !== undefined) {
      updateData.sentAt = validation.data.sentAt ?? null;
    }

    const updatedRcti = await prisma.rcti.update({
      where: { id: rctiId },
      data: updateData,
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    return NextResponse.json(updatedRcti);
  },
});

/**
 * DELETE /api/rcti/[id]
 * Delete a draft RCTI
 */
export const DELETE = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error deleting RCTI",
  responseMessage: "Failed to delete RCTI",
  handler: async ({ params: { id: rctiId } }) => {
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCTIs can be deleted" },
        { status: 400 },
      );
    }

    await prisma.rcti.delete({
      where: { id: rctiId },
    });

    return NextResponse.json({ message: "RCTI deleted successfully" });
  },
});
