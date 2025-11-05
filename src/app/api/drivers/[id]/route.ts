import { NextRequest } from "next/server";
import { createCrudHandlers, prisma } from "@/lib/api-helpers";
import { driverSchema } from "@/lib/validation";
import { z } from "zod";

type DriverUpdateData = Partial<z.infer<typeof driverSchema>>;

// Create CRUD handlers for drivers
const driverHandlers = createCrudHandlers({
  model: prisma.driver,
  createSchema: driverSchema,
  updateSchema: driverSchema.partial(),
  resourceType: "driver", // SECURITY: Required for payload validation
  listOrderBy: { createdAt: "desc" },
  updateTransform: (data: DriverUpdateData) => {
    const result: Partial<DriverUpdateData> = {};

    // Preserve undefined for all fields that aren't explicitly provided
    if (data.driver !== undefined) result.driver = data.driver;
    if (data.truck !== undefined) result.truck = data.truck;
    if (data.tray !== undefined) result.tray = data.tray;
    if (data.crane !== undefined) result.crane = data.crane;
    if (data.semi !== undefined) result.semi = data.semi;
    if (data.semiCrane !== undefined) result.semiCrane = data.semiCrane;
    if (data.breaks !== undefined) result.breaks = data.breaks;
    if (data.type !== undefined) result.type = data.type;

    // Handle subcontractor-specific fields based on type changes
    if (data.type !== undefined) {
      if (data.type !== "Subcontractor") {
        // If explicitly changing to non-Subcontractor, clear tolls/fuelLevy
        result.tolls = false;
        result.fuelLevy = null;
      } else {
        // If explicitly changing to Subcontractor, set only if provided
        if (data.tolls !== undefined) result.tolls = data.tolls;
        if (data.fuelLevy !== undefined) result.fuelLevy = data.fuelLevy;
      }
    }
    // If type not provided, leave tolls/fuelLevy undefined to preserve existing values

    // Driver details for RCTI - preserve undefined
    if (data.businessName !== undefined)
      result.businessName = data.businessName;
    if (data.abn !== undefined) result.abn = data.abn;
    if (data.address !== undefined) result.address = data.address;
    if (data.bankAccountName !== undefined)
      result.bankAccountName = data.bankAccountName;
    if (data.bankAccountNumber !== undefined)
      result.bankAccountNumber = data.bankAccountNumber;
    if (data.bankBsb !== undefined) result.bankBsb = data.bankBsb;
    if (data.gstMode !== undefined) result.gstMode = data.gstMode;
    if (data.gstStatus !== undefined) result.gstStatus = data.gstStatus;

    return result;
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return driverHandlers.getById(request, params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return driverHandlers.updateById(request, params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return driverHandlers.deleteById(request, params);
}
