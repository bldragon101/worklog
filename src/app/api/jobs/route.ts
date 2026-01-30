import { NextRequest } from "next/server";
import { createCrudHandlers, prisma } from "@/lib/api-helpers";
import { jobSchema, jobUpdateSchema } from "@/lib/validation";
import { z } from "zod";

type JobCreateData = z.infer<typeof jobSchema>;

// Parse ISO date string to UTC Date without timezone shift
function parseIsoToUtcDate(isoString: string | Date): Date {
  const str =
    typeof isoString === "string" ? isoString : isoString.toISOString();
  // Match ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const match = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (match) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
    return new Date(
      Date.UTC(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10),
      ),
    );
  }
  // Fallback for unexpected formats
  return new Date(str);
}

// Create CRUD handlers for jobs
const jobHandlers = createCrudHandlers({
  model: prisma.jobs,
  createSchema: jobSchema,
  updateSchema: jobUpdateSchema,
  resourceType: "job", // SECURITY: Required for payload validation
  tableName: "Jobs", // For activity logging
  listOrderBy: { date: "asc" },
  createTransform: (data: JobCreateData) => ({
    date: parseIsoToUtcDate(data.date),
    driver: data.driver.toUpperCase(),
    customer: data.customer,
    billTo: data.billTo,
    truckType: data.truckType,
    registration: data.registration.toUpperCase(),
    pickup: data.pickup || "",
    dropoff:
      typeof data.dropoff === "string" && data.dropoff.trim() !== ""
        ? data.dropoff.trim()
        : null,
    runsheet: data.runsheet,
    invoiced: data.invoiced,
    chargedHours: data.chargedHours,
    driverCharge: data.driverCharge,
    startTime: data.startTime ? parseIsoToUtcDate(data.startTime) : null,
    finishTime: data.finishTime ? parseIsoToUtcDate(data.finishTime) : null,
    comments:
      typeof data.comments === "string" && data.comments.trim() !== ""
        ? data.comments.trim()
        : null,
    jobReference:
      typeof data.jobReference === "string" && data.jobReference.trim() !== ""
        ? data.jobReference.trim()
        : null,
    eastlink: data.eastlink,
    citylink: data.citylink,
  }),
});

export async function GET(request: NextRequest) {
  return jobHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return jobHandlers.create(request);
}
