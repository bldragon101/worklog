import { formatJobDetails } from "@/components/entities/job/job-copy-details-dialog";
import { Job } from "@/lib/types";
import "@testing-library/jest-dom";

describe("formatJobDetails", () => {
  const baseJob: Job = {
    id: 1,
    date: "2024-01-15",
    driver: "John Doe",
    customer: "Acme Corp",
    billTo: "Acme Corp",
    registration: "ABC123",
    truckType: "Semi",
    pickup: "Melbourne, Carlton",
    dropoff: "Sydney, CBD",
    startTime: "2024-01-15T08:00:00",
    finishTime: "2024-01-15T16:30:00",
    chargedHours: 8.5,
    driverCharge: 450,
    citylink: 2,
    eastlink: 1,
    jobReference: "JOB-2024-001",
    comments: "Handle with care",
    runsheet: true,
    invoiced: false,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  };

  describe("Basic formatting", () => {
    it("should format a complete job with all fields", () => {
      const result = formatJobDetails(baseJob);

      expect(result).toContain("15/01/24");
      expect(result).toContain("08:00-16:30");
      expect(result).toContain("8.50h"); // 8 hours 30 minutes = 8.5 hours
      expect(result).toContain("Driver: John Doe");
      expect(result).toContain("Tolls: 2CL 1EL");
      expect(result).toContain("Melbourne, Carlton to Sydney, CBD");
      expect(result).toContain("Job Ref: JOB-2024-001");
      expect(result).toContain("Handle with care");
    });

    it("should format job with minimal required fields", () => {
      const minimalJob: Job = {
        id: 1,
        date: "2024-01-15",
        driver: "Jane Smith",
        customer: "Test Corp",
        billTo: "Test Corp",
        registration: "XYZ789",
        truckType: "Truck",
        pickup: "Melbourne",
        dropoff: "",
        startTime: null,
        finishTime: null,
        chargedHours: null,
        driverCharge: null,
        citylink: null,
        eastlink: null,
        jobReference: null,
        comments: null,
        runsheet: false,
        invoiced: false,
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: [],
      };

      const result = formatJobDetails(minimalJob);

      expect(result).toContain("15/01/24");
      expect(result).toContain("Driver: Jane Smith");
      expect(result).toContain("Melbourne");
      expect(result).not.toContain("Tolls:");
      expect(result).not.toContain("Job Ref:");
    });
  });

  describe("Time and hours calculation", () => {
    it("should calculate hours as decimal (3h45m = 3.75h)", () => {
      const job: Job = {
        ...baseJob,
        startTime: "2024-01-15T09:00:00",
        finishTime: "2024-01-15T12:45:00",
      };

      const result = formatJobDetails(job);

      expect(result).toContain("09:00-12:45");
      expect(result).toContain("3.75h"); // 3 hours 45 minutes = 3.75 hours
    });

    it("should calculate hours as decimal (2h30m = 2.50h)", () => {
      const job: Job = {
        ...baseJob,
        startTime: "2024-01-15T10:00:00",
        finishTime: "2024-01-15T12:30:00",
      };

      const result = formatJobDetails(job);

      expect(result).toContain("2.50h"); // 2 hours 30 minutes = 2.5 hours
    });

    it("should calculate hours as decimal (1h15m = 1.25h)", () => {
      const job: Job = {
        ...baseJob,
        startTime: "2024-01-15T14:00:00",
        finishTime: "2024-01-15T15:15:00",
      };

      const result = formatJobDetails(job);

      expect(result).toContain("1.25h"); // 1 hour 15 minutes = 1.25 hours
    });

    it("should handle full hour durations", () => {
      const job: Job = {
        ...baseJob,
        startTime: "2024-01-15T09:00:00",
        finishTime: "2024-01-15T14:00:00",
      };

      const result = formatJobDetails(job);

      expect(result).toContain("5.00h"); // exactly 5 hours
    });

    it("should not show hours if start or finish time is missing", () => {
      const jobNoStart: Job = {
        ...baseJob,
        startTime: null,
        finishTime: "2024-01-15T16:30:00",
      };

      const resultNoStart = formatJobDetails(jobNoStart);
      expect(resultNoStart).not.toContain("h)");

      const jobNoFinish: Job = {
        ...baseJob,
        startTime: "2024-01-15T08:00:00",
        finishTime: null,
      };

      const resultNoFinish = formatJobDetails(jobNoFinish);
      expect(resultNoFinish).not.toContain("h)");
    });

    it("should not show time range if both times are missing", () => {
      const job: Job = {
        ...baseJob,
        startTime: null,
        finishTime: null,
      };

      const result = formatJobDetails(job);
      const firstLine = result.split("\n")[0];
      // Check that the first line doesn't contain a time range (e.g., "08:00-16:30")
      expect(firstLine).not.toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/);
      expect(result).toContain("15/01/24");
    });
  });

  describe("Tolls formatting", () => {
    it("should format citylink only", () => {
      const job: Job = {
        ...baseJob,
        citylink: 3,
        eastlink: 0,
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Tolls: 3CL");
      expect(result).not.toContain("EL");
    });

    it("should format eastlink only", () => {
      const job: Job = {
        ...baseJob,
        citylink: 0,
        eastlink: 5,
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Tolls: 5EL");
      expect(result).not.toContain("CL");
    });

    it("should format both citylink and eastlink", () => {
      const job: Job = {
        ...baseJob,
        citylink: 2,
        eastlink: 3,
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Tolls: 2CL 3EL");
    });

    it("should not show tolls line when both are zero or null", () => {
      const jobZero: Job = {
        ...baseJob,
        citylink: 0,
        eastlink: 0,
      };

      const resultZero = formatJobDetails(jobZero);
      expect(resultZero).not.toContain("Tolls:");

      const jobNull: Job = {
        ...baseJob,
        citylink: null,
        eastlink: null,
      };

      const resultNull = formatJobDetails(jobNull);
      expect(resultNull).not.toContain("Tolls:");
    });
  });

  describe("Location formatting", () => {
    it("should format pickup to dropoff", () => {
      const job: Job = {
        ...baseJob,
        pickup: "Melbourne",
        dropoff: "Sydney",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Melbourne to Sydney");
    });

    it("should format pickup only", () => {
      const job: Job = {
        ...baseJob,
        pickup: "Melbourne CBD",
        dropoff: "",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Melbourne CBD");
      expect(result).not.toContain(" to ");
    });

    it("should format dropoff only", () => {
      const job: Job = {
        ...baseJob,
        pickup: "",
        dropoff: "Brisbane",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Brisbane");
      expect(result).not.toContain(" to ");
    });

    it("should not show location line if both are empty", () => {
      const job: Job = {
        ...baseJob,
        pickup: "",
        dropoff: "",
      };

      const result = formatJobDetails(job);
      const lines = result.split("\n");
      const hasEmptyLocationLine = lines.some(
        (line) => line === "" || line === " to ",
      );
      expect(hasEmptyLocationLine).toBe(false);
    });
  });

  describe("Optional fields", () => {
    it("should include job reference when present", () => {
      const job: Job = {
        ...baseJob,
        jobReference: "REF-12345",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Job Ref: REF-12345");
    });

    it("should not include job reference when null or empty", () => {
      const jobNull: Job = {
        ...baseJob,
        jobReference: null,
      };

      const resultNull = formatJobDetails(jobNull);
      expect(resultNull).not.toContain("Job Ref:");

      const jobEmpty: Job = {
        ...baseJob,
        jobReference: "",
      };

      const resultEmpty = formatJobDetails(jobEmpty);
      expect(resultEmpty).not.toContain("Job Ref:");
    });

    it("should include comments when present", () => {
      const job: Job = {
        ...baseJob,
        comments: "Fragile items - handle with care\nContact on arrival",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("Fragile items - handle with care");
      expect(result).toContain("Contact on arrival");
    });

    it("should not include comments when null or empty", () => {
      const jobNull: Job = {
        ...baseJob,
        comments: null,
      };

      const resultNull = formatJobDetails(jobNull);
      const lines = resultNull.split("\n");
      expect(lines[lines.length - 1]).not.toBe("");

      const jobEmpty: Job = {
        ...baseJob,
        comments: "",
      };

      const resultEmpty = formatJobDetails(jobEmpty);
      expect(resultEmpty).not.toContain("\n\n");
    });
  });

  describe("Line ordering", () => {
    it("should maintain correct order of fields", () => {
      const result = formatJobDetails(baseJob);
      const lines = result.split("\n");

      // First line should be date/time/hours
      expect(lines[0]).toContain("15/01/24");
      expect(lines[0]).toContain("08:00-16:30");
      expect(lines[0]).toContain("8.50h");

      // Second line should be driver
      expect(lines[1]).toBe("Driver: John Doe");

      // Third line should be tolls
      expect(lines[2]).toContain("Tolls:");

      // Fourth line should be locations
      expect(lines[3]).toContain("Melbourne");
      expect(lines[3]).toContain("Sydney");

      // Fifth line should be job reference
      expect(lines[4]).toContain("Job Ref:");

      // Sixth line should be comments
      expect(lines[5]).toContain("Handle with care");
    });

    it("should skip missing optional fields in order", () => {
      const job: Job = {
        ...baseJob,
        citylink: null,
        eastlink: null,
        jobReference: null,
        comments: "Important delivery",
      };

      const result = formatJobDetails(job);
      const lines = result.split("\n");

      expect(lines[0]).toContain("15/01/24");
      expect(lines[1]).toBe("Driver: John Doe");
      expect(lines[2]).toContain("Melbourne");
      expect(lines[3]).toContain("Important delivery");
      expect(result).not.toContain("Tolls:");
      expect(result).not.toContain("Job Ref:");
    });
  });

  describe("Edge cases", () => {
    it("should handle very long comments", () => {
      const longComment = "A".repeat(500);
      const job: Job = {
        ...baseJob,
        comments: longComment,
      };

      const result = formatJobDetails(job);
      expect(result).toContain(longComment);
    });

    it("should handle special characters in fields", () => {
      const job: Job = {
        ...baseJob,
        customer: "O'Brien & Sons",
        pickup: "St. Mary's",
        comments: "Notes: $500 COD | Priority #1",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("St. Mary's");
      expect(result).toContain("Notes: $500 COD | Priority #1");
    });

    it("should handle date formatting correctly", () => {
      const job: Job = {
        ...baseJob,
        date: "2024-12-31",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("31/12/24");
    });

    it("should handle very short time durations", () => {
      const job: Job = {
        ...baseJob,
        startTime: "2024-01-15T10:00:00",
        finishTime: "2024-01-15T10:15:00",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("0.25h"); // 15 minutes = 0.25 hours
    });

    it("should handle zero duration", () => {
      const job: Job = {
        ...baseJob,
        startTime: "2024-01-15T10:00:00",
        finishTime: "2024-01-15T10:00:00",
      };

      const result = formatJobDetails(job);
      expect(result).toContain("0.00h");
    });
  });
});
