import {
  jobSchema,
  jobUpdateSchema,
  customerSchema,
  customerUpdateSchema,
  vehicleSchema,
  vehicleUpdateSchema,
  driverSchema,
  rctiCreateSchema,
  rctiUpdateSchema,
  sanitizeInput,
  validateRequestBody,
  MAX_FUTURE_YEAR_OFFSET,
} from "@/lib/validation";

describe("Validation Schemas", () => {
  describe("jobSchema", () => {
    const validJobData = {
      date: "2024-01-15",
      driver: "John Doe",
      customer: "ABC Company",
      billTo: "ABC Company",
      truckType: "Tray",
      registration: "ABC123",
      pickup: "123 Main St",
      dropoff: "456 Oak Ave",
      runsheet: true,
      invoiced: false,
      chargedHours: 8.5,
      driverCharge: 350.0,
      comments: "Test job",
      attachmentRunsheet: [],
      attachmentDocket: [],
      attachmentDeliveryPhotos: [],
    };

    it("validates correct job data", () => {
      const result = jobSchema.safeParse(validJobData);
      expect(result.success).toBe(true);
    });

    it("requires driver field", () => {
      const invalidData = { ...validJobData, driver: "" };
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Driver is required");
      }
    });

    it("validates date formats", () => {
      const validDate = { ...validJobData, date: "2024-01-15T10:30:00Z" };
      const result = jobSchema.safeParse(validDate);
      expect(result.success).toBe(true);
    });

    it("rejects missing date field", () => {
      const invalidData = { ...validJobData };
      delete (invalidData as Record<string, unknown>).date;
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Invalid|required/i);
      }
    });

    it("rejects empty string date", () => {
      const invalidData = { ...validJobData, date: "" };
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Date is required");
      }
    });

    it("rejects null date", () => {
      const invalidData = { ...validJobData, date: null };
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects undefined date", () => {
      const invalidData = { ...validJobData, date: undefined };
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects whitespace-only date", () => {
      const invalidData = { ...validJobData, date: "   " };
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Date is required");
      }
    });

    it("handles optional fields as null", () => {
      const dataWithNulls = {
        ...validJobData,
        dropoff: null, // dropoff is optional
        comments: null,
        jobReference: null,
        chargedHours: null,
        driverCharge: null,
        startTime: null,
        finishTime: null,
        runsheet: null,
        invoiced: null,
        eastlink: null,
        citylink: null,
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: [],
      };
      const result = jobSchema.safeParse(dataWithNulls);
      expect(result.success).toBe(true);
    });

    it("validates positive numbers for charges", () => {
      const invalidData = { ...validJobData, driverCharge: -100 };
      const result = jobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("customerSchema", () => {
    const validCustomerData = {
      customer: "Test Customer",
      billTo: "Test Bill To",
      contact: "1234567890",
      tray: 100,
      crane: 200,
      semi: 300,
      semiCrane: 400,
      fuelLevy: 10,
      tolls: true,
      breakDeduction: 5,
      comments: "Test comments",
      attachmentRunsheet: [],
      attachmentDocket: [],
      attachmentDeliveryPhotos: [],
    };

    it("validates correct customer data", () => {
      const result = customerSchema.safeParse(validCustomerData);
      expect(result.success).toBe(true);
    });

    it("requires customer name", () => {
      const invalidData = { ...validCustomerData, customer: "" };
      const result = customerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "Customer name is required",
        );
      }
    });

    it("requires billTo field", () => {
      const invalidData = { ...validCustomerData, billTo: "" };
      const result = customerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Bill To is required");
      }
    });

    it("handles optional numeric fields", () => {
      const dataWithOptionals = {
        customer: "Test Customer",
        billTo: "Test Bill To",
        tray: null,
        crane: null,
        tolls: false,
      };
      const result = customerSchema.safeParse(dataWithOptionals);
      expect(result.success).toBe(true);
    });

    it("validates positive numbers for rates", () => {
      const invalidData = { ...validCustomerData, tray: -50 };
      const result = customerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("defaults tolls to false when not provided", () => {
      const dataWithoutTolls = {
        customer: "Test Customer",
        billTo: "Test Bill To",
      };
      const result = customerSchema.safeParse(dataWithoutTolls);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tolls).toBe(false);
      }
    });
  });

  describe("vehicleSchema", () => {
    const validVehicleData = {
      registration: "ABC123",
      expiryDate: "2025-12-31",
      make: "Toyota",
      model: "Hiace",
      yearOfManufacture: 2020,
      type: "Van",
      carryingCapacity: "1000kg",
      trayLength: "3m",
      craneReach: "5m",
      craneType: "Hydraulic",
      craneCapacity: "2000kg",
    };

    it("validates correct vehicle data", () => {
      const result = vehicleSchema.safeParse(validVehicleData);
      expect(result.success).toBe(true);
    });

    it("requires registration", () => {
      const invalidData = { ...validVehicleData, registration: "" };
      const result = vehicleSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("validates year range", () => {
      const maxAllowedYear = new Date().getFullYear() + MAX_FUTURE_YEAR_OFFSET;
      const futureYear = {
        ...validVehicleData,
        yearOfManufacture: maxAllowedYear,
      };
      const result = vehicleSchema.safeParse(futureYear);
      expect(result.success).toBe(true); // Should allow future years within limit

      const tooFarFutureYear = {
        ...validVehicleData,
        yearOfManufacture: maxAllowedYear + 1,
      };
      const tooFarResult = vehicleSchema.safeParse(tooFarFutureYear);
      expect(tooFarResult.success).toBe(false);

      const tooOldYear = { ...validVehicleData, yearOfManufacture: 1800 };
      const oldResult = vehicleSchema.safeParse(tooOldYear);
      expect(oldResult.success).toBe(false);
    });

    it("handles optional fields", () => {
      const minimalData = {
        registration: "ABC123",
        expiryDate: "2025-12-31",
        make: "Toyota",
        model: "Hiace",
        yearOfManufacture: 2020,
        type: "Van",
      };
      const result = vehicleSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });
  });

  describe("Driver ABN and BSB validation", () => {
    const validDriverData = {
      driver: "Test Driver",
      truck: "Test Truck",
      type: "Contractor" as const,
      abn: "12345678901", // 11 characters
      bankBsb: "123456", // 6 characters
    };

    it("accepts valid 11-character ABN", () => {
      const result = driverSchema.safeParse(validDriverData);
      expect(result.success).toBe(true);
    });

    it("rejects ABN with fewer than 11 characters", () => {
      const invalidData = { ...validDriverData, abn: "1234567890" }; // 10 chars
      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects ABN with more than 11 characters", () => {
      const invalidData = { ...validDriverData, abn: "123456789012" }; // 12 chars
      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("accepts valid 6-character BSB", () => {
      const result = driverSchema.safeParse(validDriverData);
      expect(result.success).toBe(true);
    });

    it("rejects BSB with fewer than 6 characters", () => {
      const invalidData = { ...validDriverData, bankBsb: "12345" }; // 5 chars
      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects BSB with more than 6 characters", () => {
      const invalidData = { ...validDriverData, bankBsb: "1234567" }; // 7 chars
      const result = driverSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("allows null ABN and BSB", () => {
      const dataWithNulls = {
        driver: "Test Driver",
        truck: "Test Truck",
        type: "Employee" as const,
        abn: null,
        bankBsb: null,
      };
      const result = driverSchema.safeParse(dataWithNulls);
      expect(result.success).toBe(true);
    });
  });

  describe("Update schemas", () => {
    it("jobUpdateSchema allows partial updates", () => {
      const partialUpdate = { driver: "Jane Doe" };
      const result = jobUpdateSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it("customerUpdateSchema allows partial updates", () => {
      const partialUpdate = { tray: 150 };
      const result = customerUpdateSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it("vehicleUpdateSchema allows partial updates", () => {
      const partialUpdate = { make: "Ford" };
      const result = vehicleUpdateSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });
  });

  describe("sanitizeInput", () => {
    it("trims whitespace from strings", () => {
      const result = sanitizeInput("  test string  ");
      expect(result).toBe("test string");
    });

    it("removes dangerous characters", () => {
      const result = sanitizeInput('<script>alert("xss")</script>');
      expect(result).toBe('scriptalert("xss")/script');
    });

    it("returns non-string values unchanged", () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(true)).toBe(true);
      expect(sanitizeInput(null)).toBe(null);
    });

    it("handles empty strings", () => {
      const result = sanitizeInput("");
      expect(result).toBe("");
    });
  });

  describe("validateRequestBody", () => {
    const mockRequest = (body: unknown) =>
      ({
        json: () => Promise.resolve(body),
      }) as Request;

    it("validates correct request body", async () => {
      const validData = { customer: "Test", billTo: "Test" };
      const request = mockRequest(validData);

      const result = await validateRequestBody(request, customerSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customer).toBe("Test");
      }
    });

    it("returns error for invalid request body", async () => {
      const invalidData = { customer: "", billTo: "Test" };
      const request = mockRequest(invalidData);

      const result = await validateRequestBody(request, customerSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Validation failed");
      }
    });

    it("handles JSON parsing errors", async () => {
      const request = {
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as Request;

      const result = await validateRequestBody(request, customerSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid request body");
      }
    });
  });

  describe("RCTI ABN and BSB validation", () => {
    const validRctiData = {
      driverId: 1,
      weekEnding: "2024-01-15",
      driverAbn: "12345678901", // 11 characters
      bankBsb: "123456", // 6 characters
    };

    it("accepts valid 11-character ABN in rctiCreateSchema", () => {
      const result = rctiCreateSchema.safeParse(validRctiData);
      expect(result.success).toBe(true);
    });

    it("rejects ABN with fewer than 11 characters in rctiCreateSchema", () => {
      const invalidData = { ...validRctiData, driverAbn: "1234567890" }; // 10 chars
      const result = rctiCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects ABN with more than 11 characters in rctiCreateSchema", () => {
      const invalidData = { ...validRctiData, driverAbn: "123456789012" }; // 12 chars
      const result = rctiCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("accepts valid 6-character BSB in rctiCreateSchema", () => {
      const result = rctiCreateSchema.safeParse(validRctiData);
      expect(result.success).toBe(true);
    });

    it("rejects BSB with fewer than 6 characters in rctiCreateSchema", () => {
      const invalidData = { ...validRctiData, bankBsb: "12345" }; // 5 chars
      const result = rctiCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("rejects BSB with more than 6 characters in rctiCreateSchema", () => {
      const invalidData = { ...validRctiData, bankBsb: "1234567" }; // 7 chars
      const result = rctiCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("accepts valid 11-character ABN in rctiUpdateSchema", () => {
      const updateData = { driverAbn: "12345678901" };
      const result = rctiUpdateSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it("rejects invalid ABN length in rctiUpdateSchema", () => {
      const updateData = { driverAbn: "1234567890" }; // 10 chars
      const result = rctiUpdateSchema.safeParse(updateData);
      expect(result.success).toBe(false);
    });

    it("accepts valid 6-character BSB in rctiUpdateSchema", () => {
      const updateData = { bankBsb: "123456" };
      const result = rctiUpdateSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it("rejects invalid BSB length in rctiUpdateSchema", () => {
      const updateData = { bankBsb: "12345" }; // 5 chars
      const result = rctiUpdateSchema.safeParse(updateData);
      expect(result.success).toBe(false);
    });

    it("allows null ABN and BSB in RCTI schemas", () => {
      const dataWithNulls = {
        driverId: 1,
        weekEnding: "2024-01-15",
        driverAbn: null,
        bankBsb: null,
      };
      const result = rctiCreateSchema.safeParse(dataWithNulls);
      expect(result.success).toBe(true);
    });
  });

  describe("ABN and BSB formatting", () => {
    describe("driverSchema ABN formatting", () => {
      it("should accept ABN with spaces and strip them", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          abn: "51 824 753 556", // Formatted with spaces
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.abn).toBe("51824753556");
        }
      });

      it("should accept ABN with dashes and strip them", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          abn: "51-824-753-556", // Formatted with dashes
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.abn).toBe("51824753556");
        }
      });

      it("should accept ABN with mixed spaces and dashes", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          abn: "51 824-753 556", // Mixed formatting
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.abn).toBe("51824753556");
        }
      });

      it("should reject ABN with incorrect length after stripping", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          abn: "51 824 753", // Too short (9 digits)
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it("should accept unformatted ABN", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          abn: "51824753556",
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.abn).toBe("51824753556");
        }
      });
    });

    describe("driverSchema BSB formatting", () => {
      it("should accept BSB with dash and strip it", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          bankBsb: "123-456", // Formatted with dash
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });

      it("should accept BSB with spaces and strip them", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          bankBsb: "123 456", // Formatted with space
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });

      it("should reject BSB with incorrect length after stripping", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          bankBsb: "123-45", // Too short (5 digits)
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it("should accept unformatted BSB", () => {
        const data = {
          driver: "Test Driver",
          truck: "ABC123",
          type: "Contractor",
          bankBsb: "123456",
        };
        const result = driverSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });
    });

    describe("rctiCreateSchema ABN formatting", () => {
      it("should accept driverAbn with spaces and strip them", () => {
        const data = {
          driverId: 1,
          weekEnding: "2024-01-15",
          driverAbn: "51 824 753 556",
        };
        const result = rctiCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.driverAbn).toBe("51824753556");
        }
      });

      it("should accept driverAbn with dashes and strip them", () => {
        const data = {
          driverId: 1,
          weekEnding: "2024-01-15",
          driverAbn: "51-824-753-556",
        };
        const result = rctiCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.driverAbn).toBe("51824753556");
        }
      });
    });

    describe("rctiCreateSchema BSB formatting", () => {
      it("should accept bankBsb with dash and strip it", () => {
        const data = {
          driverId: 1,
          weekEnding: "2024-01-15",
          bankBsb: "123-456",
        };
        const result = rctiCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });

      it("should accept bankBsb with spaces and strip them", () => {
        const data = {
          driverId: 1,
          weekEnding: "2024-01-15",
          bankBsb: "123 456",
        };
        const result = rctiCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });
    });

    describe("rctiUpdateSchema ABN formatting", () => {
      it("should accept driverAbn with spaces and strip them", () => {
        const data = {
          driverAbn: "51 824 753 556",
        };
        const result = rctiUpdateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.driverAbn).toBe("51824753556");
        }
      });

      it("should accept driverAbn with dashes and strip them", () => {
        const data = {
          driverAbn: "51-824-753-556",
        };
        const result = rctiUpdateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.driverAbn).toBe("51824753556");
        }
      });
    });

    describe("rctiUpdateSchema BSB formatting", () => {
      it("should accept bankBsb with dash and strip it", () => {
        const data = {
          bankBsb: "123-456",
        };
        const result = rctiUpdateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });

      it("should accept bankBsb with spaces and strip them", () => {
        const data = {
          bankBsb: "123 456",
        };
        const result = rctiUpdateSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bankBsb).toBe("123456");
        }
      });
    });
  });
});
