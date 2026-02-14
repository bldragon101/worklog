import { NextRequest, NextResponse } from "next/server";
import {
  createCrudHandlers,
  prisma,
  withApiProtection,
  withErrorHandling,
  findById,
} from "@/lib/api-helpers";
import { driverSchema } from "@/lib/validation";
import { z } from "zod";
import { toNumber } from "@/lib/utils/rcti-calculations";

type DriverUpdateData = Partial<z.infer<typeof driverSchema>>;

// Helper to convert Decimal fields to numbers
function serializeDriver(driver: any) {
  return {
    ...driver,
    tray: driver.tray ? toNumber(driver.tray) : null,
    crane: driver.crane ? toNumber(driver.crane) : null,
    semi: driver.semi ? toNumber(driver.semi) : null,
    semiCrane: driver.semiCrane ? toNumber(driver.semiCrane) : null,
    fuelLevy: driver.fuelLevy ? toNumber(driver.fuelLevy) : null,
    isArchived: driver.isArchived ?? false,
  };
}

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
    if (data.driver !== undefined) result.driver = data.driver.toUpperCase();
    if (data.truck !== undefined) result.truck = data.truck.toUpperCase();
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
    } else {
      // If type not provided, still allow tolls/fuelLevy updates
      if (data.tolls !== undefined) result.tolls = data.tolls;
      if (data.fuelLevy !== undefined) result.fuelLevy = data.fuelLevy;
    }

    // Driver details for RCTI - preserve undefined
    if (data.businessName !== undefined)
      result.businessName = data.businessName;
    if (data.abn !== undefined) result.abn = data.abn;
    if (data.address !== undefined) result.address = data.address;
    if (data.email !== undefined) result.email = data.email;
    if (data.bankAccountName !== undefined)
      result.bankAccountName = data.bankAccountName;
    if (data.bankAccountNumber !== undefined)
      result.bankAccountNumber = data.bankAccountNumber;
    if (data.bankBsb !== undefined) result.bankBsb = data.bankBsb;
    if (data.gstMode !== undefined) result.gstMode = data.gstMode;
    if (data.gstStatus !== undefined) result.gstStatus = data.gstStatus;

    // Archive status
    if (data.isArchived !== undefined) result.isArchived = data.isArchived;

    return result;
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const protection = await withApiProtection(request);
  if (protection.error) return protection.error;

  const { id } = await params;
  const driverId = parseInt(id, 10);

  if (isNaN(driverId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  return withErrorHandling(async () => {
    const driver = await findById(prisma.driver, driverId);
    return serializeDriver(driver);
  }, "Error fetching driver")(protection);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await driverHandlers.updateById(request, params);

  // If successful, serialize the response
  if (result.ok) {
    const data = await result.json();
    return NextResponse.json(serializeDriver(data));
  }

  return result;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return driverHandlers.deleteById(request, params);
}
