import { z } from "zod";

const batchCreateItemSchema = z.object({
  date: z.string(),
  driver: z.string(),
  customer: z.string(),
  billTo: z.string(),
  truckType: z.string(),
  registration: z.string(),
  pickup: z.string(),
  dropoff: z.string().optional().nullable(),
  runsheet: z.boolean().optional().nullable(),
  invoiced: z.boolean().optional().nullable(),
  chargedHours: z.number().optional().nullable(),
  driverCharge: z.number().optional().nullable(),
  startTime: z.string().optional().nullable(),
  finishTime: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  jobReference: z.string().optional().nullable(),
  eastlink: z.number().int().optional().nullable(),
  citylink: z.number().int().optional().nullable(),
});

const batchUpdateItemSchema = z.object({
  id: z.number(),
  data: z.object({
    date: z.string().optional(),
    driver: z.string().optional(),
    customer: z.string().optional(),
    billTo: z.string().optional(),
    truckType: z.string().optional(),
    registration: z.string().optional(),
    pickup: z.string().optional(),
    dropoff: z.string().optional().nullable(),
    runsheet: z.boolean().optional().nullable(),
    invoiced: z.boolean().optional().nullable(),
    chargedHours: z.number().optional().nullable(),
    driverCharge: z.number().optional().nullable(),
    startTime: z.string().optional().nullable(),
    finishTime: z.string().optional().nullable(),
    comments: z.string().optional().nullable(),
    jobReference: z.string().optional().nullable(),
    eastlink: z.number().int().optional().nullable(),
    citylink: z.number().int().optional().nullable(),
  }),
});

const batchOperationSchema = z.object({
  creates: z.array(batchCreateItemSchema).max(200).default([]),
  updates: z.array(batchUpdateItemSchema).max(200).default([]),
  deletes: z.array(z.number()).max(200).default([]),
});

function parseIsoToUtcDate({ isoString }: { isoString: string | Date }): Date {
  const str =
    typeof isoString === "string" ? isoString : isoString.toISOString();
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
  return new Date(str);
}

function transformCreateData({
  item,
}: {
  item: z.infer<typeof batchCreateItemSchema>;
}) {
  return {
    date: parseIsoToUtcDate({ isoString: item.date }),
    driver: item.driver.toUpperCase(),
    customer: item.customer,
    billTo: item.billTo,
    truckType: item.truckType,
    registration: item.registration.toUpperCase(),
    pickup: item.pickup,
    dropoff:
      typeof item.dropoff === "string" && item.dropoff.trim() !== ""
        ? item.dropoff.trim()
        : null,
    runsheet: item.runsheet ?? null,
    invoiced: item.invoiced ?? null,
    chargedHours: item.chargedHours ?? null,
    driverCharge: item.driverCharge ?? null,
    startTime: item.startTime
      ? parseIsoToUtcDate({ isoString: item.startTime })
      : null,
    finishTime: item.finishTime
      ? parseIsoToUtcDate({ isoString: item.finishTime })
      : null,
    comments:
      typeof item.comments === "string" && item.comments.trim() !== ""
        ? item.comments.trim()
        : null,
    jobReference:
      typeof item.jobReference === "string" && item.jobReference.trim() !== ""
        ? item.jobReference.trim()
        : null,
    eastlink: item.eastlink ?? null,
    citylink: item.citylink ?? null,
  };
}

function transformUpdateData({
  data,
}: {
  data: z.infer<typeof batchUpdateItemSchema>["data"];
}) {
  const transformed: Record<string, unknown> = {};

  if (data.date !== undefined)
    transformed.date = parseIsoToUtcDate({ isoString: data.date });
  if (data.driver !== undefined) transformed.driver = data.driver.toUpperCase();
  if (data.customer !== undefined) transformed.customer = data.customer;
  if (data.billTo !== undefined) transformed.billTo = data.billTo;
  if (data.truckType !== undefined) transformed.truckType = data.truckType;
  if (data.registration !== undefined)
    transformed.registration = data.registration.toUpperCase();
  if (data.pickup !== undefined) transformed.pickup = data.pickup;
  if (data.dropoff !== undefined)
    transformed.dropoff =
      typeof data.dropoff === "string" && data.dropoff.trim() !== ""
        ? data.dropoff.trim()
        : null;
  if (data.runsheet !== undefined) transformed.runsheet = data.runsheet ?? null;
  if (data.invoiced !== undefined) transformed.invoiced = data.invoiced ?? null;
  if (data.chargedHours !== undefined)
    transformed.chargedHours = data.chargedHours ?? null;
  if (data.driverCharge !== undefined)
    transformed.driverCharge = data.driverCharge ?? null;
  if (data.startTime !== undefined)
    transformed.startTime = data.startTime
      ? parseIsoToUtcDate({ isoString: data.startTime })
      : null;
  if (data.finishTime !== undefined)
    transformed.finishTime = data.finishTime
      ? parseIsoToUtcDate({ isoString: data.finishTime })
      : null;
  if (data.comments !== undefined)
    transformed.comments =
      typeof data.comments === "string" && data.comments.trim() !== ""
        ? data.comments.trim()
        : null;
  if (data.jobReference !== undefined)
    transformed.jobReference =
      typeof data.jobReference === "string" && data.jobReference.trim() !== ""
        ? data.jobReference.trim()
        : null;
  if (data.eastlink !== undefined) transformed.eastlink = data.eastlink ?? null;
  if (data.citylink !== undefined) transformed.citylink = data.citylink ?? null;

  return transformed;
}

const validCreateItem = {
  date: "2025-01-15",
  driver: "John Smith",
  customer: "ABC Transport",
  billTo: "ABC Transport",
  truckType: "Tray",
  registration: "abc123",
  pickup: "Melbourne CBD",
};

const validCreateItemFull = {
  ...validCreateItem,
  dropoff: "Sydney CBD",
  runsheet: true,
  invoiced: false,
  chargedHours: 8.5,
  driverCharge: 450.0,
  startTime: "2025-01-15T06:00:00",
  finishTime: "2025-01-15T14:30:00",
  comments: "Delivered on time",
  jobReference: "REF-001",
  eastlink: 5.5,
  citylink: 3.2,
};

describe("Quick Edit Bulk API Validation", () => {
  describe("batchOperationSchema validation", () => {
    it("accepts valid creates, updates, and deletes", () => {
      const input = {
        creates: [validCreateItem],
        updates: [{ id: 1, data: { driver: "Jane Doe" } }],
        deletes: [10, 20, 30],
      };

      const result = batchOperationSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.creates).toHaveLength(1);
        expect(result.data.updates).toHaveLength(1);
        expect(result.data.deletes).toEqual([10, 20, 30]);
      }
    });

    it("defaults empty arrays when not provided", () => {
      const result = batchOperationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.creates).toEqual([]);
        expect(result.data.updates).toEqual([]);
        expect(result.data.deletes).toEqual([]);
      }
    });

    it("rejects creates array exceeding 200 items", () => {
      const creates = Array.from({ length: 201 }, () => validCreateItem);
      const result = batchOperationSchema.safeParse({ creates });
      expect(result.success).toBe(false);
    });

    it("rejects updates array exceeding 200 items", () => {
      const updates = Array.from({ length: 201 }, (_, i) => ({
        id: i + 1,
        data: { driver: "Test" },
      }));
      const result = batchOperationSchema.safeParse({ updates });
      expect(result.success).toBe(false);
    });

    it("rejects deletes array exceeding 200 items", () => {
      const deletes = Array.from({ length: 201 }, (_, i) => i + 1);
      const result = batchOperationSchema.safeParse({ deletes });
      expect(result.success).toBe(false);
    });

    it("rejects non-number items in deletes", () => {
      const result = batchOperationSchema.safeParse({
        deletes: ["abc", "def"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty batch with no creates, updates, or deletes", () => {
      const result = batchOperationSchema.safeParse({
        creates: [],
        updates: [],
        deletes: [],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.creates).toEqual([]);
        expect(result.data.updates).toEqual([]);
        expect(result.data.deletes).toEqual([]);
      }
    });

    it("accepts exactly 200 items in each array", () => {
      const creates = Array.from({ length: 200 }, () => validCreateItem);
      const updates = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        data: { driver: "Test" },
      }));
      const deletes = Array.from({ length: 200 }, (_, i) => i + 1);

      const result = batchOperationSchema.safeParse({
        creates,
        updates,
        deletes,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("batchCreateItemSchema validation", () => {
    it("accepts a complete valid create item with all fields", () => {
      const result = batchCreateItemSchema.safeParse(validCreateItemFull);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe("2025-01-15");
        expect(result.data.driver).toBe("John Smith");
        expect(result.data.dropoff).toBe("Sydney CBD");
        expect(result.data.chargedHours).toBe(8.5);
        expect(result.data.runsheet).toBe(true);
        expect(result.data.eastlink).toBe(5.5);
      }
    });

    it("accepts a create item with only required fields", () => {
      const result = batchCreateItemSchema.safeParse(validCreateItem);
      expect(result.success).toBe(true);
    });

    it("requires the date field", () => {
      const { date: _, ...withoutDate } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutDate);
      expect(result.success).toBe(false);
    });

    it("requires the driver field", () => {
      const { driver: _, ...withoutDriver } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutDriver);
      expect(result.success).toBe(false);
    });

    it("requires the customer field", () => {
      const { customer: _, ...withoutCustomer } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutCustomer);
      expect(result.success).toBe(false);
    });

    it("requires the billTo field", () => {
      const { billTo: _, ...withoutBillTo } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutBillTo);
      expect(result.success).toBe(false);
    });

    it("requires the truckType field", () => {
      const { truckType: _, ...withoutTruckType } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutTruckType);
      expect(result.success).toBe(false);
    });

    it("requires the registration field", () => {
      const { registration: _, ...withoutRegistration } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutRegistration);
      expect(result.success).toBe(false);
    });

    it("requires the pickup field", () => {
      const { pickup: _, ...withoutPickup } = validCreateItem;
      const result = batchCreateItemSchema.safeParse(withoutPickup);
      expect(result.success).toBe(false);
    });

    it("rejects when all required fields are missing", () => {
      const result = batchCreateItemSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldNames = result.error.issues.map((issue) => issue.path[0]);
        expect(fieldNames).toContain("date");
        expect(fieldNames).toContain("driver");
        expect(fieldNames).toContain("customer");
        expect(fieldNames).toContain("billTo");
        expect(fieldNames).toContain("truckType");
        expect(fieldNames).toContain("registration");
        expect(fieldNames).toContain("pickup");
      }
    });

    it("accepts optional fields as null", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        dropoff: null,
        runsheet: null,
        invoiced: null,
        chargedHours: null,
        driverCharge: null,
        startTime: null,
        finishTime: null,
        comments: null,
        jobReference: null,
        eastlink: null,
        citylink: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional fields as undefined", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        dropoff: undefined,
        runsheet: undefined,
        invoiced: undefined,
        chargedHours: undefined,
        driverCharge: undefined,
        startTime: undefined,
        finishTime: undefined,
        comments: undefined,
        jobReference: undefined,
        eastlink: undefined,
        citylink: undefined,
      });
      expect(result.success).toBe(true);
    });

    it("rejects a number for the date field", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        date: 12345,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a string for the chargedHours field", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        chargedHours: "eight",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a string for the runsheet field", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        runsheet: "yes",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a number for the driver field", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        driver: 123,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a boolean for the eastlink field", () => {
      const result = batchCreateItemSchema.safeParse({
        ...validCreateItem,
        eastlink: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("batchUpdateItemSchema validation", () => {
    it("accepts a valid update with id and data", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 42,
        data: {
          driver: "Jane Doe",
          customer: "XYZ Logistics",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
        expect(result.data.data.driver).toBe("Jane Doe");
        expect(result.data.data.customer).toBe("XYZ Logistics");
      }
    });

    it("requires id to be a number", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: "not-a-number",
        data: { driver: "Test" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing id", () => {
      const result = batchUpdateItemSchema.safeParse({
        data: { driver: "Test" },
      });
      expect(result.success).toBe(false);
    });

    it("accepts partial data with only some fields", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 1,
        data: { registration: "XYZ789" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.registration).toBe("XYZ789");
        expect(result.data.data.driver).toBeUndefined();
        expect(result.data.data.customer).toBeUndefined();
      }
    });

    it("accepts an empty data object", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 5,
        data: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(
          Object.keys(result.data.data).filter(
            (k) =>
              result.data.data[k as keyof typeof result.data.data] !==
              undefined,
          ),
        ).toHaveLength(0);
      }
    });

    it("rejects wrong types in data fields", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 1,
        data: { chargedHours: "not-a-number" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects a boolean for the date field in data", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 1,
        data: { date: true },
      });
      expect(result.success).toBe(false);
    });

    it("accepts nullable fields set to null in data", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 1,
        data: {
          dropoff: null,
          comments: null,
          chargedHours: null,
          startTime: null,
          finishTime: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts all fields in data at once", () => {
      const result = batchUpdateItemSchema.safeParse({
        id: 99,
        data: {
          date: "2025-06-01",
          driver: "Updated Driver",
          customer: "Updated Customer",
          billTo: "Updated BillTo",
          truckType: "Crane",
          registration: "NEW999",
          pickup: "Brisbane",
          dropoff: "Gold Coast",
          runsheet: true,
          invoiced: true,
          chargedHours: 12,
          driverCharge: 600,
          startTime: "2025-06-01T05:00:00",
          finishTime: "2025-06-01T17:00:00",
          comments: "Updated delivery",
          jobReference: "REF-UPD-001",
          eastlink: 10,
          citylink: 7.5,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("parseIsoToUtcDate logic", () => {
    it("parses an ISO date string correctly", () => {
      const result = parseIsoToUtcDate({ isoString: "2025-01-15" });
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });

    it("parses an ISO datetime string correctly", () => {
      const result = parseIsoToUtcDate({
        isoString: "2025-03-20T14:30:45",
      });
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(20);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(45);
    });

    it("handles date-only strings with YYYY-MM-DD format", () => {
      const result = parseIsoToUtcDate({ isoString: "2024-12-25" });
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(11);
      expect(result.getUTCDate()).toBe(25);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("falls back to new Date() for non-matching strings", () => {
      const fallbackInput = "January 15, 2025";
      const result = parseIsoToUtcDate({ isoString: fallbackInput });
      const expected = new Date(fallbackInput);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it("handles a Date object as input", () => {
      const inputDate = new Date(Date.UTC(2025, 5, 10, 8, 30, 0));
      const result = parseIsoToUtcDate({ isoString: inputDate });
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(5);
      expect(result.getUTCDate()).toBe(10);
      expect(result.getUTCHours()).toBe(8);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it("parses ISO string with timezone suffix by extracting date and time parts", () => {
      const result = parseIsoToUtcDate({
        isoString: "2025-07-01T09:15:00Z",
      });
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(6);
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCHours()).toBe(9);
      expect(result.getUTCMinutes()).toBe(15);
      expect(result.getUTCSeconds()).toBe(0);
    });

    it("parses midnight correctly", () => {
      const result = parseIsoToUtcDate({
        isoString: "2025-01-01T00:00:00",
      });
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });

    it("parses end-of-day time correctly", () => {
      const result = parseIsoToUtcDate({
        isoString: "2025-01-01T23:59:59",
      });
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
      expect(result.getUTCSeconds()).toBe(59);
    });
  });

  describe("transformCreateData logic", () => {
    it("uppercases driver and registration", () => {
      const result = transformCreateData({
        item: {
          ...validCreateItem,
          driver: "john smith",
          registration: "abc123",
        },
      });
      expect(result.driver).toBe("JOHN SMITH");
      expect(result.registration).toBe("ABC123");
    });

    it("nullifies empty dropoff string", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, dropoff: "" },
      });
      expect(result.dropoff).toBeNull();
    });

    it("nullifies whitespace-only dropoff string", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, dropoff: "   " },
      });
      expect(result.dropoff).toBeNull();
    });

    it("trims dropoff when it has content", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, dropoff: "  Sydney CBD  " },
      });
      expect(result.dropoff).toBe("Sydney CBD");
    });

    it("nullifies empty comments string", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, comments: "" },
      });
      expect(result.comments).toBeNull();
    });

    it("nullifies whitespace-only comments string", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, comments: "   " },
      });
      expect(result.comments).toBeNull();
    });

    it("trims comments when it has content", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, comments: "  Delivered on time  " },
      });
      expect(result.comments).toBe("Delivered on time");
    });

    it("nullifies empty jobReference string", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, jobReference: "" },
      });
      expect(result.jobReference).toBeNull();
    });

    it("nullifies whitespace-only jobReference string", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, jobReference: "   " },
      });
      expect(result.jobReference).toBeNull();
    });

    it("trims jobReference when it has content", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, jobReference: "  REF-123  " },
      });
      expect(result.jobReference).toBe("REF-123");
    });

    it("converts date string to Date object", () => {
      const result = transformCreateData({ item: validCreateItem });
      expect(result.date).toBeInstanceOf(Date);
      expect(result.date.getUTCFullYear()).toBe(2025);
      expect(result.date.getUTCMonth()).toBe(0);
      expect(result.date.getUTCDate()).toBe(15);
    });

    it("converts startTime string to Date object", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, startTime: "2025-01-15T06:00:00" },
      });
      expect(result.startTime).toBeInstanceOf(Date);
      expect((result.startTime as Date).getUTCHours()).toBe(6);
      expect((result.startTime as Date).getUTCMinutes()).toBe(0);
    });

    it("converts finishTime string to Date object", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, finishTime: "2025-01-15T14:30:00" },
      });
      expect(result.finishTime).toBeInstanceOf(Date);
      expect((result.finishTime as Date).getUTCHours()).toBe(14);
      expect((result.finishTime as Date).getUTCMinutes()).toBe(30);
    });

    it("sets startTime to null when not provided", () => {
      const result = transformCreateData({ item: validCreateItem });
      expect(result.startTime).toBeNull();
    });

    it("sets finishTime to null when not provided", () => {
      const result = transformCreateData({ item: validCreateItem });
      expect(result.finishTime).toBeNull();
    });

    it("defaults optional fields to null when not provided", () => {
      const result = transformCreateData({ item: validCreateItem });
      expect(result.dropoff).toBeNull();
      expect(result.runsheet).toBeNull();
      expect(result.invoiced).toBeNull();
      expect(result.chargedHours).toBeNull();
      expect(result.driverCharge).toBeNull();
      expect(result.startTime).toBeNull();
      expect(result.finishTime).toBeNull();
      expect(result.comments).toBeNull();
      expect(result.jobReference).toBeNull();
      expect(result.eastlink).toBeNull();
      expect(result.citylink).toBeNull();
    });

    it("preserves boolean values for runsheet and invoiced", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, runsheet: true, invoiced: false },
      });
      expect(result.runsheet).toBe(true);
      expect(result.invoiced).toBe(false);
    });

    it("preserves numeric values for chargedHours and driverCharge", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, chargedHours: 8.5, driverCharge: 450 },
      });
      expect(result.chargedHours).toBe(8.5);
      expect(result.driverCharge).toBe(450);
    });

    it("preserves numeric values for eastlink and citylink", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, eastlink: 5.5, citylink: 3.2 },
      });
      expect(result.eastlink).toBe(5.5);
      expect(result.citylink).toBe(3.2);
    });

    it("passes through customer, billTo, truckType, and pickup unchanged", () => {
      const result = transformCreateData({ item: validCreateItem });
      expect(result.customer).toBe("ABC Transport");
      expect(result.billTo).toBe("ABC Transport");
      expect(result.truckType).toBe("Tray");
      expect(result.pickup).toBe("Melbourne CBD");
    });

    it("nullifies dropoff when it is null", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, dropoff: null },
      });
      expect(result.dropoff).toBeNull();
    });

    it("nullifies dropoff when it is undefined", () => {
      const result = transformCreateData({
        item: { ...validCreateItem, dropoff: undefined },
      });
      expect(result.dropoff).toBeNull();
    });
  });

  describe("transformUpdateData logic", () => {
    it("only includes fields that were provided", () => {
      const result = transformUpdateData({
        data: { driver: "Jane Doe", customer: "New Customer" },
      });
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(["driver", "customer"]),
      );
      expect(Object.keys(result)).toHaveLength(2);
      expect(result).not.toHaveProperty("date");
      expect(result).not.toHaveProperty("registration");
      expect(result).not.toHaveProperty("pickup");
    });

    it("uppercases driver when provided", () => {
      const result = transformUpdateData({ data: { driver: "jane doe" } });
      expect(result.driver).toBe("JANE DOE");
    });

    it("uppercases registration when provided", () => {
      const result = transformUpdateData({
        data: { registration: "xyz789" },
      });
      expect(result.registration).toBe("XYZ789");
    });

    it("does not include driver or registration when not provided", () => {
      const result = transformUpdateData({ data: { customer: "Test" } });
      expect(result).not.toHaveProperty("driver");
      expect(result).not.toHaveProperty("registration");
    });

    it("handles partial updates with a single field", () => {
      const result = transformUpdateData({
        data: { chargedHours: 10 },
      });
      expect(Object.keys(result)).toHaveLength(1);
      expect(result.chargedHours).toBe(10);
    });

    it("returns empty object for empty data", () => {
      const result = transformUpdateData({ data: {} });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("converts date to Date object when provided", () => {
      const result = transformUpdateData({ data: { date: "2025-06-01" } });
      expect(result.date).toBeInstanceOf(Date);
      expect((result.date as Date).getUTCFullYear()).toBe(2025);
      expect((result.date as Date).getUTCMonth()).toBe(5);
      expect((result.date as Date).getUTCDate()).toBe(1);
    });

    it("converts startTime to Date object when provided", () => {
      const result = transformUpdateData({
        data: { startTime: "2025-06-01T07:00:00" },
      });
      expect(result.startTime).toBeInstanceOf(Date);
      expect((result.startTime as Date).getUTCHours()).toBe(7);
    });

    it("sets startTime to null when provided as null", () => {
      const result = transformUpdateData({ data: { startTime: null } });
      expect(result.startTime).toBeNull();
    });

    it("converts finishTime to Date object when provided", () => {
      const result = transformUpdateData({
        data: { finishTime: "2025-06-01T15:00:00" },
      });
      expect(result.finishTime).toBeInstanceOf(Date);
      expect((result.finishTime as Date).getUTCHours()).toBe(15);
    });

    it("sets finishTime to null when provided as null", () => {
      const result = transformUpdateData({ data: { finishTime: null } });
      expect(result.finishTime).toBeNull();
    });

    it("trims dropoff and nullifies when empty", () => {
      const result = transformUpdateData({ data: { dropoff: "   " } });
      expect(result.dropoff).toBeNull();
    });

    it("trims dropoff when it has content", () => {
      const result = transformUpdateData({
        data: { dropoff: "  Brisbane  " },
      });
      expect(result.dropoff).toBe("Brisbane");
    });

    it("nullifies dropoff when set to null", () => {
      const result = transformUpdateData({ data: { dropoff: null } });
      expect(result.dropoff).toBeNull();
    });

    it("trims comments and nullifies when empty", () => {
      const result = transformUpdateData({ data: { comments: "" } });
      expect(result.comments).toBeNull();
    });

    it("trims comments when it has content", () => {
      const result = transformUpdateData({
        data: { comments: "  Updated note  " },
      });
      expect(result.comments).toBe("Updated note");
    });

    it("trims jobReference and nullifies when empty", () => {
      const result = transformUpdateData({ data: { jobReference: "  " } });
      expect(result.jobReference).toBeNull();
    });

    it("trims jobReference when it has content", () => {
      const result = transformUpdateData({
        data: { jobReference: "  REF-UPDATE  " },
      });
      expect(result.jobReference).toBe("REF-UPDATE");
    });

    it("defaults runsheet to null when provided as undefined via nullish coalescing", () => {
      const result = transformUpdateData({ data: { runsheet: null } });
      expect(result.runsheet).toBeNull();
    });

    it("preserves boolean values for runsheet and invoiced", () => {
      const result = transformUpdateData({
        data: { runsheet: true, invoiced: false },
      });
      expect(result.runsheet).toBe(true);
      expect(result.invoiced).toBe(false);
    });

    it("defaults chargedHours to null when provided as null", () => {
      const result = transformUpdateData({ data: { chargedHours: null } });
      expect(result.chargedHours).toBeNull();
    });

    it("preserves numeric values for eastlink and citylink", () => {
      const result = transformUpdateData({
        data: { eastlink: 12.5, citylink: 8.0 },
      });
      expect(result.eastlink).toBe(12.5);
      expect(result.citylink).toBe(8.0);
    });

    it("defaults eastlink and citylink to null when provided as null", () => {
      const result = transformUpdateData({
        data: { eastlink: null, citylink: null },
      });
      expect(result.eastlink).toBeNull();
      expect(result.citylink).toBeNull();
    });

    it("passes through customer, billTo, truckType, and pickup unchanged", () => {
      const result = transformUpdateData({
        data: {
          customer: "Updated Co",
          billTo: "Updated Bill",
          truckType: "Crane",
          pickup: "Perth",
        },
      });
      expect(result.customer).toBe("Updated Co");
      expect(result.billTo).toBe("Updated Bill");
      expect(result.truckType).toBe("Crane");
      expect(result.pickup).toBe("Perth");
    });

    it("handles all fields provided at once", () => {
      const result = transformUpdateData({
        data: {
          date: "2025-08-01",
          driver: "full update driver",
          customer: "Full Customer",
          billTo: "Full BillTo",
          truckType: "Hiab",
          registration: "full999",
          pickup: "Adelaide",
          dropoff: "Darwin",
          runsheet: true,
          invoiced: true,
          chargedHours: 14,
          driverCharge: 700,
          startTime: "2025-08-01T04:00:00",
          finishTime: "2025-08-01T18:00:00",
          comments: "Full update",
          jobReference: "FULL-REF",
          eastlink: 20,
          citylink: 15,
        },
      });
      expect(Object.keys(result)).toHaveLength(18);
      expect(result.driver).toBe("FULL UPDATE DRIVER");
      expect(result.registration).toBe("FULL999");
      expect(result.date).toBeInstanceOf(Date);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.finishTime).toBeInstanceOf(Date);
      expect(result.dropoff).toBe("Darwin");
      expect(result.comments).toBe("Full update");
      expect(result.jobReference).toBe("FULL-REF");
    });
  });
});
