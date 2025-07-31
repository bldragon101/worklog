import { z } from 'zod';

// WorkLog validation schemas
export const workLogSchema = z.object({
  date: z.union([
    z.string().refine((val) => {
      // Accept both "yyyy-MM-dd" and ISO datetime formats
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, 'Invalid date format'),
    z.date()
  ]),
  driver: z.string().min(1, 'Driver is required').max(100),
  customer: z.string().min(1, 'Customer is required').max(100),
  billTo: z.string().min(1, 'Bill To is required').max(100),
  truckType: z.string().min(1, 'Truck Type is required').max(50),
  registration: z.string().min(1, 'Registration is required').max(20),
  pickup: z.string().max(200).optional(),
  dropoff: z.string().max(200).optional(),
  runsheet: z.boolean().optional(),
  invoiced: z.boolean().optional(),
  chargedHours: z.number().positive().optional(),
  driverCharge: z.number().positive().optional(),
  comments: z.string().max(500).optional(),
});

export const workLogUpdateSchema = workLogSchema.partial();

// Customer validation schemas
export const customerSchema = z.object({
  customer: z.string().min(1, 'Customer name is required').max(100),
  billTo: z.string().min(1, 'Bill To is required').max(100),
  contact: z.string().max(100).optional(),
  tray: z.number().positive().optional(),
  crane: z.number().positive().optional(),
  semi: z.number().positive().optional(),
  semiCrane: z.number().positive().optional(),
  fuelLevy: z.number().positive().optional(),
  tolls: z.boolean().default(false),
  comments: z.string().max(500).optional(),
});

export const customerUpdateSchema = customerSchema.partial();

// Vehicle validation schemas
export const vehicleSchema = z.object({
  registration: z.string().min(1, 'Registration is required').max(20),
  expiryDate: z.union([
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, 'Invalid date format'),
    z.date()
  ]),
  make: z.string().min(1, 'Make is required').max(50),
  model: z.string().min(1, 'Model is required').max(50),
  yearOfManufacture: z.number().int().min(1900).max(new Date().getFullYear() + 5),
  type: z.string().min(1, 'Type is required').max(20),
  carryingCapacity: z.preprocess((val) => val === null || val === "" ? null : val, z.string().max(20).nullable().optional()),
  trayLength: z.preprocess((val) => val === null || val === "" ? null : val, z.string().max(20).nullable().optional()),
  craneReach: z.preprocess((val) => val === null || val === "" ? null : val, z.string().max(20).nullable().optional()),
  craneType: z.preprocess((val) => val === null || val === "" ? null : val, z.string().max(50).nullable().optional()),
  craneCapacity: z.preprocess((val) => val === null || val === "" ? null : val, z.string().max(20).nullable().optional()),
});

export const vehicleUpdateSchema = vehicleSchema.partial();

// File upload validation
export const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1),
  folderId: z.string().optional(),
});

// Google Drive upload validation
export const googleDriveUploadSchema = z.object({
  accessToken: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileContent: z.string().min(1),
  folderId: z.string().optional(),
});

// Export filters validation
export const exportFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customer: z.string().max(100).optional(),
  driver: z.string().max(100).optional(),
});

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
});

// Sanitize and validate input
export function sanitizeInput(input: unknown) {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
}

// Validate and sanitize request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    console.log('Validating request body:', body);
    const validatedData = schema.parse(body);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error);
      return { success: false, error: `Validation failed: ${error.message}` };
    }
    console.error('Non-Zod error:', error);
    return { success: false, error: 'Invalid request body' };
  }
} 