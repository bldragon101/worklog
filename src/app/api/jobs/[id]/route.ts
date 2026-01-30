import { NextRequest } from "next/server";
import { createCrudHandlers, prisma } from "@/lib/api-helpers";
import { jobSchema, jobUpdateSchema } from "@/lib/validation";
import { z } from "zod";

type JobUpdateData = Partial<z.infer<typeof jobSchema>>;

// Create CRUD handlers for jobs
const jobHandlers = createCrudHandlers({
  model: prisma.jobs,
  createSchema: jobSchema,
  updateSchema: jobUpdateSchema,
  resourceType: "job", // SECURITY: Required for payload validation
  updateTransform: (data: JobUpdateData) => {
    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.driver !== undefined)
      updateData.driver = data.driver.toUpperCase();
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
    if (data.chargedHours !== undefined)
      updateData.chargedHours = data.chargedHours;
    if (data.driverCharge !== undefined)
      updateData.driverCharge = data.driverCharge;
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
    return updateData;
  },
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return jobHandlers.getById(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return jobHandlers.updateById(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return jobHandlers.updateById(req, params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return jobHandlers.deleteById(req, params);
}
