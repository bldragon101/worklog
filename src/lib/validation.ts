import { z } from "zod";

/**
 * Maximum number of years in the future allowed for vehicle year of manufacture.
 * This allows vehicles to be registered before they are manufactured (pre-orders, etc).
 * Exported for use in tests to ensure consistency.
 */
export const MAX_FUTURE_YEAR_OFFSET = 5;

// Helper function to remove formatting from ABN (spaces and dashes)
const preprocessAbn = (val: unknown) => {
  if (val === null || val === "" || val === undefined) return null;
  if (typeof val === "string") return val.replace(/[\s-]/g, "");
  return val;
};

// Helper function to remove formatting from BSB (spaces and dashes)
const preprocessBsb = (val: unknown) => {
  if (val === null || val === "" || val === undefined) return null;
  if (typeof val === "string") return val.replace(/[\s-]/g, "");
  return val;
};

// Job validation schemas (renamed from WorkLog)
export const jobSchema = z.object({
  date: z.union([
    z.string().refine(
      (val) => {
        if (!val || val.trim() === "") {
          return false;
        }
        // Accept both "yyyy-MM-dd" and ISO datetime formats
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Date is required and must be a valid date format" },
    ),
    z.date(),
  ]),
  driver: z.string().min(1, "Driver is required").max(100),
  customer: z.string().min(1, "Customer is required").max(100),
  billTo: z.string().min(1, "Bill To is required").max(100),
  truckType: z.string().min(1, "Truck Type is required").max(50),
  registration: z.string().min(1, "Registration is required").max(20),
  pickup: z.string().min(1, "Pickup is required").max(200),
  dropoff: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(200).nullable().optional(),
  ),
  runsheet: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.boolean().nullable().optional(),
  ),
  invoiced: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.boolean().nullable().optional(),
  ),
  chargedHours: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  driverCharge: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  startTime: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z
      .union([
        z.string().refine((val) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        }, "Invalid start time format"),
        z.date(),
      ])
      .nullable()
      .optional(),
  ),
  finishTime: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z
      .union([
        z.string().refine((val) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        }, "Invalid finish time format"),
        z.date(),
      ])
      .nullable()
      .optional(),
  ),
  comments: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(500).nullable().optional(),
  ),
  jobReference: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  eastlink: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().int().min(0).max(10).nullable().optional(),
  ),
  citylink: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().int().min(0).max(10).nullable().optional(),
  ),
});

// Custom update schema that ensures required fields are not empty strings
export const jobUpdateSchema = jobSchema.partial().refine(
  (data) => {
    // If these fields are provided, they must not be empty strings
    const requiredFields: (keyof typeof data)[] = [
      "driver",
      "customer",
      "billTo",
      "truckType",
      "registration",
      "pickup",
    ];

    for (const field of requiredFields) {
      if (
        data[field] !== undefined &&
        typeof data[field] === "string" &&
        (data[field] as string).trim() === ""
      ) {
        return false;
      }
    }
    return true;
  },
  {
    message: "Required fields cannot be empty strings",
  },
);

// Customer validation schemas
export const customerSchema = z.object({
  customer: z.string().min(1, "Customer name is required").max(100),
  billTo: z.string().min(1, "Bill To is required").max(100),
  contact: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  tray: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  crane: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  semi: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  semiCrane: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  fuelLevy: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().min(0).nullable().optional(),
  ),
  tolls: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? false : val),
    z.boolean().default(false),
  ),
  breakDeduction: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  comments: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(500).nullable().optional(),
  ),
});

export const customerUpdateSchema = customerSchema.partial();

// Vehicle validation schemas
export const vehicleSchema = z.object({
  registration: z.string().min(1, "Registration is required").max(20),
  expiryDate: z.union([
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid date format"),
    z.date(),
  ]),
  make: z.string().min(1, "Make is required").max(50),
  model: z.string().min(1, "Model is required").max(50),
  yearOfManufacture: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + MAX_FUTURE_YEAR_OFFSET),
  type: z.string().min(1, "Type is required").max(20),
  carryingCapacity: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(20).nullable().optional(),
  ),
  trayLength: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(20).nullable().optional(),
  ),
  craneReach: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(20).nullable().optional(),
  ),
  craneType: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(50).nullable().optional(),
  ),
  craneCapacity: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(20).nullable().optional(),
  ),
});

export const vehicleUpdateSchema = vehicleSchema.partial();

// Driver validation schemas
export const driverSchema = z.object({
  driver: z.string().min(1, "Driver name is required").max(100),
  truck: z.string().min(1, "Truck is required").max(100),
  tray: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  crane: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  semi: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  semiCrane: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().positive().nullable().optional(),
  ),
  breaks: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().min(0).nullable().optional(),
  ),
  type: z.enum(["Employee", "Contractor", "Subcontractor"]).default("Employee"),
  tolls: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? false : val),
    z.boolean().default(false),
  ),
  fuelLevy: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.number().min(0).nullable().optional(),
  ),
  businessName: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  abn: z.preprocess(preprocessAbn, z.string().length(11).nullable().optional()),
  address: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.string().max(500).nullable().optional(),
  ),
  bankAccountName: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  bankAccountNumber: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.string().max(20).nullable().optional(),
  ),
  bankBsb: z.preprocess(
    preprocessBsb,
    z.string().length(6).nullable().optional(),
  ),
  gstMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  gstStatus: z.enum(["registered", "not_registered"]).default("not_registered"),
  email: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? null : val),
    z.string().email("Invalid email address").max(255).nullable().optional(),
  ),
  isArchived: z.preprocess(
    (val) => (val === null || val === "" || val === undefined ? false : val),
    z.boolean().default(false),
  ),
});

export const driverUpdateSchema = driverSchema.partial();

// RCTI validation schemas
export const rctiCreateSchema = z.object({
  driverId: z.number().int().positive("Driver ID is required"),
  weekEnding: z.union([
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid date format"),
    z.date(),
  ]),
  driverName: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  businessName: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  driverAddress: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(500).nullable().optional(),
  ),
  driverAbn: z.preprocess(
    preprocessAbn,
    z.string().length(11).nullable().optional(),
  ),
  gstStatus: z.enum(["registered", "not_registered"]).default("not_registered"),
  gstMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  bankAccountName: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  bankBsb: z.preprocess(
    preprocessBsb,
    z.string().length(6).nullable().optional(),
  ),
  bankAccountNumber: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(20).nullable().optional(),
  ),
  notes: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(1000).nullable().optional(),
  ),
});

export const rctiUpdateSchema = z.object({
  driverName: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  businessName: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  driverAddress: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(500).nullable().optional(),
  ),
  driverAbn: z.preprocess(
    preprocessAbn,
    z.string().length(11).nullable().optional(),
  ),
  gstStatus: z.enum(["registered", "not_registered"]).optional(),
  gstMode: z.enum(["exclusive", "inclusive"]).optional(),
  bankAccountName: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  bankBsb: z.preprocess(
    preprocessBsb,
    z.string().length(6).nullable().optional(),
  ),
  bankAccountNumber: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(20).nullable().optional(),
  ),
  notes: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(1000).nullable().optional(),
  ),
  status: z.enum(["draft", "finalised", "paid"]).optional(),
});

export const rctiLineUpdateSchema = z.object({
  chargedHours: z
    .number()
    .refine((val) => val !== 0, {
      message: "Charged hours cannot be zero",
    })
    .optional(),
  ratePerHour: z.number().positive("Rate per hour must be positive").optional(),
  jobDate: z.string().nullable().optional(),
  customer: z.string().max(100).nullable().optional(),
  truckType: z.string().max(100).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const rctiQuerySchema = z.object({
  driverId: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z
      .string()
      .regex(/^\d+$/, "Driver ID must be a number")
      .nullable()
      .optional(),
  ),
  startDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.iso.datetime().nullable().optional(),
  ),
  endDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.iso.datetime().nullable().optional(),
  ),
  status: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.enum(["draft", "finalised", "paid"]).nullable().optional(),
  ),
});

// File upload validation
export const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1),
  folderId: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

// Google Drive upload validation
export const googleDriveUploadSchema = z.object({
  accessToken: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1),
  folderId: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

// Export filters validation
export const exportFiltersSchema = z.object({
  startDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.iso.datetime().nullable().optional(),
  ),
  endDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.iso.datetime().nullable().optional(),
  ),
  customer: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  driver: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
});

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a number"),
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().regex(/^\d+$/, "Page must be a number").nullable().optional(),
  ),
  limit: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().regex(/^\d+$/, "Limit must be a number").nullable().optional(),
  ),
});

// Sanitize and validate input
export function sanitizeInput(input: unknown) {
  if (typeof input === "string") {
    return input.trim().replace(/[<>]/g, "");
  }
  return input;
}

// Validate and sanitize request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Only log validation errors in development
      if (process.env.NODE_ENV === "development") {
        console.error("Validation error:", error.issues);
      }
      return { success: false, error: `Validation failed: ${error.message}` };
    }

    // Only log non-Zod errors in development
    if (process.env.NODE_ENV === "development") {
      console.error("Non-Zod error:", error);
    }
    return { success: false, error: "Invalid request body" };
  }
}
