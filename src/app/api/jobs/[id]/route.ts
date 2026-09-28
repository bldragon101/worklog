import { NextResponse } from "next/server";
import { createCrudHandlers } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { jobSchema, jobUpdateSchema } from "@/lib/validation";
import { z } from "zod";
import {
  getChangedLockedFields,
  getLockedJobMessage,
  getLockingRctis,
} from "@/lib/rcti-locked-jobs";

type JobUpdateData = Partial<z.infer<typeof jobSchema>>;

function toJobUpdateData(data: JobUpdateData) {
  const updateData: Record<string, unknown> = {};
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.driver !== undefined) updateData.driver = data.driver.toUpperCase();
  if (data.customer !== undefined) updateData.customer = data.customer;
  if (data.billTo !== undefined) updateData.billTo = data.billTo;
  if (data.truckType !== undefined) updateData.truckType = data.truckType;
  if (data.registration !== undefined)
    updateData.registration = data.registration.toUpperCase();
  if (data.pickup !== undefined) updateData.pickup = data.pickup;
  if (data.dropoff !== undefined) {
    // Ensure dropoff is either a valid non-empty string or null
    if (typeof data.dropoff === "string" && data.dropoff.trim() !== "") {
      updateData.dropoff = data.dropoff.trim();
    } else {
      updateData.dropoff = null;
    }
  }
  if (data.runsheet !== undefined) updateData.runsheet = data.runsheet;
  if (data.invoiced !== undefined) updateData.invoiced = data.invoiced;
  if (data.driverOnly !== undefined) {
    updateData.driverOnly = data.driverOnly ?? false;
  }
  if (data.chargedHours !== undefined)
    updateData.chargedHours = data.chargedHours;
  if (data.travelTimeHours !== undefined)
    updateData.travelTimeHours = data.travelTimeHours;
  if (data.driverCharge !== undefined) {
    updateData.driverCharge = data.driverCharge;
  }
  if (data.deductionHours !== undefined) {
    updateData.deductionHours = data.deductionHours;
  }
  if (data.startTime !== undefined)
    updateData.startTime = data.startTime ? data.startTime : null;
  if (data.finishTime !== undefined)
    updateData.finishTime = data.finishTime ? data.finishTime : null;
  if (data.comments !== undefined) {
    updateData.comments =
      typeof data.comments === "string" && data.comments.trim() !== ""
        ? data.comments.trim()
        : null;
  }
  if (data.jobReference !== undefined) {
    updateData.jobReference =
      typeof data.jobReference === "string" && data.jobReference.trim() !== ""
        ? data.jobReference.trim()
        : null;
  }
  if (data.eastlink !== undefined) updateData.eastlink = data.eastlink;
  if (data.citylink !== undefined) updateData.citylink = data.citylink;
  if (data.countryRunValue !== undefined) {
    updateData.countryRunValue = data.countryRunValue || null;
    updateData.countryRunUnit = data.countryRunValue
      ? data.countryRunUnit
      : null;
  }
  return updateData;
}

// Create CRUD handlers for jobs
const jobHandlers = createCrudHandlers({
  model: prisma.jobs,
  createSchema: jobSchema,
  updateSchema: jobUpdateSchema,
  resourceType: "job", // SECURITY: Required for payload validation
  updateTransform: toJobUpdateData,
  // Jobs on a finalised or paid RCTI keep the values the driver was paid on
  beforeUpdate: async ({ id, data }: { id: number; data: JobUpdateData }) => {
    const locking = await getLockingRctis({ db: prisma, jobIds: [id] });
    const rcti = locking.get(id);
    if (!rcti) return null;

    const existing = await prisma.jobs.findUnique({ where: { id } });
    if (!existing) return null;

    const fields = getChangedLockedFields({
      existing,
      update: toJobUpdateData(data),
    });
    if (fields.length === 0) return null;

    return NextResponse.json(
      { error: getLockedJobMessage({ jobId: id, rcti, fields }) },
      { status: 409 },
    );
  },
  beforeDelete: async ({ id }: { id: number }) => {
    const locking = await getLockingRctis({ db: prisma, jobIds: [id] });
    const rcti = locking.get(id);
    if (!rcti) return null;

    return NextResponse.json(
      { error: getLockedJobMessage({ jobId: id, rcti }) },
      { status: 409 },
    );
  },
});

export const GET = jobHandlers.getById;
export const PUT = jobHandlers.updateById;
export const PATCH = jobHandlers.updateById;
export const DELETE = jobHandlers.deleteById;
