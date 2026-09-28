import { NextRequest, NextResponse } from "next/server";
import {
  createCrudHandlers,
  prisma,
  withApiProtection,
  withErrorHandling,
} from "@/lib/api-helpers";
import { driverSchema } from "@/lib/validation";
import { z } from "zod";
import {
  canManageDriverBankDetails,
  DRIVER_BANK_DETAIL_FIELDS,
  serialiseDriver,
} from "@/lib/driver-serialisation";
import { getCurrentUserRole, getUserRole } from "@/lib/permissions";

type DriverCreateData = z.infer<typeof driverSchema>;

// Create CRUD handlers for drivers
const driverHandlers = createCrudHandlers({
  model: prisma.driver,
  createSchema: driverSchema,
  updateSchema: driverSchema.partial(),
  resourceType: "driver", // SECURITY: Required for payload validation
  // SECURITY: Only roles that may manage bank details can write them
  restrictedFields: ({ userRole }) =>
    canManageDriverBankDetails({ userRole }) ? [] : DRIVER_BANK_DETAIL_FIELDS,
  tableName: "Driver", // For activity logging
  listOrderBy: { createdAt: "desc" },
  createTransform: (data: DriverCreateData) => ({
    driver: data.driver.toUpperCase(),
    lastName: data.lastName ? data.lastName.toUpperCase() : null,
    truck: data.truck.toUpperCase(),
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
    email: data.email || null,
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
    const [drivers, userRole] = await Promise.all([
      prisma.driver.findMany({ orderBy: { createdAt: "desc" } }),
      getUserRole(protection.userId),
    ]);
    const includeBankDetails = canManageDriverBankDetails({ userRole });
    return drivers.map((driver) =>
      serialiseDriver({ driver, includeBankDetails }),
    );
  }, "Error fetching drivers")(protection);
}

export async function POST(request: NextRequest) {
  const result = await driverHandlers.create(request);
  if (result.status !== 201) return result;

  const [data, userRole] = await Promise.all([
    result.json(),
    getCurrentUserRole(),
  ]);
  const includeBankDetails = canManageDriverBankDetails({ userRole });
  return NextResponse.json(
    serialiseDriver({ driver: data, includeBankDetails }),
    { status: 201 },
  );
}
