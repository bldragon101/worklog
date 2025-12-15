import {
  bankersRound,
  calculateLineAmounts,
  calculateRctiTotals,
  generateInvoiceNumber,
  getDriverRateForTruckType,
  calculateLunchBreakLines,
} from "../../src/lib/utils/rcti-calculations";

describe("RCTI Calculations", () => {
  describe("bankersRound", () => {
    it("should round down when less than 0.5", () => {
      expect(bankersRound(1.234)).toBe(1.23);
      expect(bankersRound(5.671)).toBe(5.67);
    });

    it("should round up when greater than 0.5", () => {
      expect(bankersRound(1.236)).toBe(1.24);
      expect(bankersRound(5.678)).toBe(5.68);
    });

    it("should round to even when exactly 0.5", () => {
      expect(bankersRound(1.125)).toBe(1.12); // 1.12 is even
      expect(bankersRound(1.135)).toBe(1.14); // 1.14 is even
      expect(bankersRound(2.225)).toBe(2.22); // 2.22 is even
      expect(bankersRound(2.235)).toBe(2.24); // 2.24 is even
    });

    it("should handle negative numbers", () => {
      expect(bankersRound(-1.234)).toBe(-1.23);
      expect(bankersRound(-1.236)).toBe(-1.24);
    });

    it("should handle zero", () => {
      expect(bankersRound(0)).toBe(0);
    });
  });

  describe("calculateLineAmounts", () => {
    describe("not registered", () => {
      it("should have no GST and equal ex/inc amounts", () => {
        const result = calculateLineAmounts({
          chargedHours: 8,
          ratePerHour: 50,
          gstStatus: "not_registered",
          gstMode: "exclusive",
        });

        expect(result.amountExGst).toBe(400);
        expect(result.gstAmount).toBe(0);
        expect(result.amountIncGst).toBe(400);
      });

      it("should round correctly", () => {
        const result = calculateLineAmounts({
          chargedHours: 7.5,
          ratePerHour: 45.33,
          gstStatus: "not_registered",
          gstMode: "exclusive",
        });

        expect(result.amountExGst).toBe(339.97); // 7.5 * 45.33 = 339.97499... → banker's round to 339.97
        expect(result.gstAmount).toBe(0);
        expect(result.amountIncGst).toBe(339.97);
      });
    });

    describe("registered - exclusive", () => {
      it("should add 10% GST on top", () => {
        const result = calculateLineAmounts({
          chargedHours: 8,
          ratePerHour: 50,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result.amountExGst).toBe(400);
        expect(result.gstAmount).toBe(40); // 10% of 400
        expect(result.amountIncGst).toBe(440); // 400 + 40
      });

      it("should handle rounding correctly", () => {
        const result = calculateLineAmounts({
          chargedHours: 7.5,
          ratePerHour: 45.33,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        const exGst = 339.97; // 7.5 * 45.33 = 339.97499... → banker's round to 339.97
        const gst = 34.0; // 10% of 339.97 = 33.997 → banker's round to 34.00
        const incGst = 373.97; // sum rounded

        expect(result.amountExGst).toBe(exGst);
        expect(result.gstAmount).toBe(gst);
        expect(result.amountIncGst).toBe(incGst);
      });
    });

    describe("registered - inclusive", () => {
      it("should back-calculate ex GST from inc GST", () => {
        const result = calculateLineAmounts({
          chargedHours: 8,
          ratePerHour: 50,
          gstStatus: "registered",
          gstMode: "inclusive",
        });

        const incGst = 400;
        const exGst = 363.64; // 400 / 1.1 = 363.636... → banker's round
        const gst = 36.36; // 400 - 363.64

        expect(result.amountIncGst).toBe(incGst);
        expect(result.amountExGst).toBe(exGst);
        expect(result.gstAmount).toBe(gst);
      });

      it("should handle rounding correctly", () => {
        const result = calculateLineAmounts({
          chargedHours: 7.5,
          ratePerHour: 45.33,
          gstStatus: "registered",
          gstMode: "inclusive",
        });

        const incGst = 339.97; // 7.5 * 45.33 = 339.97499... → banker's round to 339.97 (this is the inclusive amount)
        const exGst = 309.06; // 339.97 / 1.1 = 309.0636... → banker's round to 309.06
        const gst = 30.91; // difference (339.97 - 309.06)

        expect(result.amountIncGst).toBe(incGst);
        expect(result.amountExGst).toBe(exGst);
        expect(result.gstAmount).toBe(gst);
      });
    });
  });

  describe("calculateRctiTotals", () => {
    it("should sum all line amounts correctly", () => {
      const lines = [
        { amountExGst: 100, gstAmount: 10, amountIncGst: 110 },
        { amountExGst: 200, gstAmount: 20, amountIncGst: 220 },
        { amountExGst: 300, gstAmount: 30, amountIncGst: 330 },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(600);
      expect(totals.gst).toBe(60);
      expect(totals.total).toBe(660);
    });

    it("should handle rounding in totals", () => {
      const lines = [
        { amountExGst: 100.11, gstAmount: 10.01, amountIncGst: 110.12 },
        { amountExGst: 200.22, gstAmount: 20.02, amountIncGst: 220.24 },
        { amountExGst: 300.33, gstAmount: 30.03, amountIncGst: 330.36 },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(600.66);
      expect(totals.gst).toBe(60.06);
      expect(totals.total).toBe(660.72);
    });

    it("should handle empty lines", () => {
      const totals = calculateRctiTotals([]);

      expect(totals.subtotal).toBe(0);
      expect(totals.gst).toBe(0);
      expect(totals.total).toBe(0);
    });

    describe("calculateLunchBreakLines", () => {
      it("should return empty array if driver has no break hours", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: null,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toEqual([]);
      });

      it("should return empty array if driver has zero break hours", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toEqual([]);
      });

      it("should return empty array if no jobs exceed 7 hours", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 7,
            ratePerHour: 85,
          },
          { jobId: 2, truckType: "Tray", chargedHours: 6.5, ratePerHour: 50 },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toEqual([]);
      });

      it("should only include imported jobs (jobId !== null)", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
          {
            jobId: null,
            truckType: "10T Crane",
            chargedHours: 9,
            ratePerHour: 85,
          }, // Manual line
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toHaveLength(1);
        expect(result[0].totalBreakHours).toBe(0.5); // Only one job counted
      });

      it("should create one break line per truck type", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
          {
            jobId: 2,
            truckType: "10T Crane",
            chargedHours: 9,
            ratePerHour: 85,
          },
          { jobId: 3, truckType: "Tray", chargedHours: 8, ratePerHour: 50 },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toHaveLength(2);

        const craneBreak = result.find((r) => r.truckType === "10T Crane");
        const trayBreak = result.find((r) => r.truckType === "Tray");

        expect(craneBreak).toBeDefined();
        expect(trayBreak).toBeDefined();
      });

      it("should sum break hours for same truck type", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
          {
            jobId: 2,
            truckType: "10T Crane",
            chargedHours: 9,
            ratePerHour: 85,
          },
          {
            jobId: 3,
            truckType: "10T Crane",
            chargedHours: 7.5,
            ratePerHour: 85,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toHaveLength(1);
        expect(result[0].totalBreakHours).toBe(1.5); // 3 jobs × 0.5h
      });

      it("should create negative amounts for break deductions", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result[0].amountExGst).toBeLessThan(0);
        expect(result[0].gstAmount).toBeLessThan(0);
        expect(result[0].amountIncGst).toBeLessThan(0);
      });

      it("should calculate correct amounts with GST registered", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 80,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result[0].amountExGst).toBe(-40); // -0.5 × 80
        expect(result[0].gstAmount).toBe(-4); // 10% of -40
        expect(result[0].amountIncGst).toBe(-44); // -40 + -4
      });

      it("should calculate correct amounts with GST not registered", () => {
        const lines = [
          { jobId: 1, truckType: "Tray", chargedHours: 8, ratePerHour: 50 },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "not_registered",
          gstMode: "exclusive",
        });

        expect(result[0].amountExGst).toBe(-25); // -0.5 × 50
        expect(result[0].gstAmount).toBe(0); // No GST
        expect(result[0].amountIncGst).toBe(-25); // -25 + 0
      });

      it("should use correct rate per truck type", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
          { jobId: 2, truckType: "Tray", chargedHours: 8, ratePerHour: 50 },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        const craneBreak = result.find((r) => r.truckType === "10T Crane");
        const trayBreak = result.find((r) => r.truckType === "Tray");

        expect(craneBreak?.ratePerHour).toBe(85);
        expect(trayBreak?.ratePerHour).toBe(50);
      });

      it("should create correct description", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result[0].description).toBe("Lunch Breaks - 10T Crane");
      });

      it("should handle multiple truck types with different break totals", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 8,
            ratePerHour: 85,
          },
          {
            jobId: 2,
            truckType: "10T Crane",
            chargedHours: 9,
            ratePerHour: 85,
          },
          { jobId: 3, truckType: "Tray", chargedHours: 7.5, ratePerHour: 50 },
          { jobId: 4, truckType: "Semi", chargedHours: 10, ratePerHour: 90 },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toHaveLength(3);

        const craneBreak = result.find((r) => r.truckType === "10T Crane");
        const trayBreak = result.find((r) => r.truckType === "Tray");
        const semiBreak = result.find((r) => r.truckType === "Semi");

        expect(craneBreak?.totalBreakHours).toBe(1.0); // 2 jobs
        expect(trayBreak?.totalBreakHours).toBe(0.5); // 1 job
        expect(semiBreak?.totalBreakHours).toBe(0.5); // 1 job
      });

      it("should not include jobs with exactly 7 hours", () => {
        const lines = [
          {
            jobId: 1,
            truckType: "10T Crane",
            chargedHours: 7.0,
            ratePerHour: 85,
          },
          {
            jobId: 2,
            truckType: "10T Crane",
            chargedHours: 7.1,
            ratePerHour: 85,
          },
        ];

        const result = calculateLunchBreakLines({
          lines,
          driverBreakHours: 0.5,
          gstStatus: "registered",
          gstMode: "exclusive",
        });

        expect(result).toHaveLength(1);
        expect(result[0].totalBreakHours).toBe(0.5); // Only job with 7.1 hours
      });
    });
  });

  describe("generateInvoiceNumber", () => {
    it("should generate invoice number from week ending date", () => {
      const weekEnding = new Date("2025-01-20");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-20012025-[A-Z0-9]+$/);
    });

    it("should format date as DDMMYYYY", () => {
      const weekEnding = new Date("2025-12-05");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-05122025-[A-Z0-9]+$/);
    });

    it("should handle single digit days and months", () => {
      const weekEnding = new Date("2025-01-09");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-09012025-[A-Z0-9]+$/);
    });

    it("should use week ending date not today", () => {
      const weekEnding = new Date("2024-06-15");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-15062024-[A-Z0-9]+$/);
    });

    it("should handle different years", () => {
      const weekEnding = new Date("2026-03-25");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-25032026-[A-Z0-9]+$/);
    });

    it("should handle end of year dates", () => {
      const weekEnding = new Date("2025-12-31");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-31122025-[A-Z0-9]+$/);
    });

    it("should handle start of year dates", () => {
      const weekEnding = new Date("2025-01-01");
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing, weekEnding, "Test Driver");

      expect(result).toMatch(/^RCTI-01012025-[A-Z0-9]+$/);
    });
  });

  describe("getDriverRateForTruckType", () => {
    const driverRates = {
      tray: 50,
      crane: 60,
      semi: 70,
      semiCrane: 80,
    };

    it("should return semi crane rate for semi crane trucks", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "Semi Crane",
          ...driverRates,
        }),
      ).toBe(80);

      expect(
        getDriverRateForTruckType({
          truckType: "semi crane",
          ...driverRates,
        }),
      ).toBe(80);

      expect(
        getDriverRateForTruckType({
          truckType: "SEMI CRANE",
          ...driverRates,
        }),
      ).toBe(80);
    });

    it("should return semi rate for semi trucks", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "Semi",
          ...driverRates,
        }),
      ).toBe(70);

      expect(
        getDriverRateForTruckType({
          truckType: "Semi Trailer",
          ...driverRates,
        }),
      ).toBe(70);
    });

    it("should return crane rate for crane trucks", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "Crane",
          ...driverRates,
        }),
      ).toBe(60);

      expect(
        getDriverRateForTruckType({
          truckType: "Truck with Crane",
          ...driverRates,
        }),
      ).toBe(60);
    });

    it("should return tray rate for tray trucks", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "Tray",
          ...driverRates,
        }),
      ).toBe(50);

      expect(
        getDriverRateForTruckType({
          truckType: "Tray Truck",
          ...driverRates,
        }),
      ).toBe(50);
    });

    it("should default to tray rate for unknown types", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "Unknown Type",
          ...driverRates,
        }),
      ).toBe(50);
    });

    it("should handle null rates", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "Semi Crane",
          tray: null,
          crane: null,
          semi: null,
          semiCrane: null,
        }),
      ).toBe(null);
    });

    it("should be case insensitive", () => {
      expect(
        getDriverRateForTruckType({
          truckType: "TRAY",
          ...driverRates,
        }),
      ).toBe(50);

      expect(
        getDriverRateForTruckType({
          truckType: "CrAnE",
          ...driverRates,
        }),
      ).toBe(60);
    });
  });
});
