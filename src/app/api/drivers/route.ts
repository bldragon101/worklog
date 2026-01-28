import { NextRequest, NextResponse } from "next/server";
import {
  createCrudHandlers,
  prisma,
  withApiProtection,
  withErrorHandling,
  findMany,
} from "@/lib/api-helpers";
import { driverSchema } from "@/lib/validation";
import { z } from "zod";
import { toNumber } from "@/lib/utils/rcti-calculations";

type DriverCreateData = z.infer<typeof driverSchema>;

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
  tableName: "Driver", // For activity logging
  listOrderBy: { createdAt: "desc" },
  createTransform: (data: DriverCreateData) => ({
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
    fuelLevy: data.type === "Subcontractor" ? (data.fuelLevy ?? null) : null,
    isArchived: data.isArchived ?? false,
    // Driver details for RCTI
    businessName: data.businessName || null,
    abn: data.abn || null,
    address: data.address || null,
    bankAccountName: data.bankAccountName || null,
    bankAccountNumber: data.bankAccountNumber || null,
    bankBsb: data.bankBsb || null,
    gstMode: data.gstMode || "exclusive",
    gstStatus: data.gstStatus || "not_registered",
  }),
});

export async function GET(request: NextRequest) {
  const protection = await withApiProtection(request);
  if (protection.error) return protection.error;

  return withErrorHandling(async () => {
    const drivers = await findMany(prisma.driver, { createdAt: "desc" });
    return drivers.map(serializeDriver);
  }, "Error fetching drivers")(protection);
}

export async function POST(request: NextRequest) {
  const result = await driverHandlers.create(request);

  // If successful, serialize the response
  if (result.status === 201) {
    const data = await result.json();
    return NextResponse.json(serializeDriver(data), { status: 201 });
  }

  return result;
}
