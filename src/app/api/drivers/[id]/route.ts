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
  updateTransform: (data: DriverUpdateData) => ({
    driver: data.driver,
    truck: data.truck,
    tray: data.tray || null,
    crane: data.crane || null,
    semi: data.semi || null,
    semiCrane: data.semiCrane || null,
    breaks: data.breaks || null,
    type: data.type || "Employee",
    // Only set tolls and fuel levy for subcontractors
    tolls: data.type === "Subcontractor" ? data.tolls || false : false,
    fuelLevy: data.type === "Subcontractor" ? data.fuelLevy || null : null,
    // Driver details for RCTI
    abn: data.abn || null,
    address: data.address || null,
    bankAccountName: data.bankAccountName || null,
    bankAccountNumber: data.bankAccountNumber || null,
    bankBsb: data.bankBsb || null,
    gstMode: data.gstMode || "exclusive",
    gstStatus: data.gstStatus || "not_registered",
  }),
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
