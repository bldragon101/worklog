import {
  calculateLunchBreakLines,
  calculateLineAmounts,
  calculateRctiTotals,
} from "../../src/lib/utils/rcti-calculations";

/**
 * Unit tests for RCTI break deduction calculations
 * Tests break line generation, grouping by truck type, GST handling, and edge cases
 */

describe("RCTI Break Deduction Calculations", () => {
  describe("Break Threshold Logic", () => {
    it("should create break for job with exactly 7.01 hours", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 7.01,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].totalBreakHours).toBe(0.5);
    });

    it("should NOT create break for job with exactly 7.00 hours", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 7.0,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(0);
    });

    it("should NOT create break for jobs under 7 hours", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 6.75,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Crane",
          chargedHours: 5.5,
          ratePerHour: 85,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(0);
    });

    it("should create breaks for multiple jobs over 7 hours", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Tray",
          chargedHours: 9.5,
          ratePerHour: 80,
        },
        {
          jobId: 3,
          truckType: "Tray",
          chargedHours: 7.5,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].totalBreakHours).toBe(1.5); // 3 breaks × 0.5 hours
    });
  });

  describe("Break Hours Variations", () => {
    it("should handle 0.25 hour (15 minute) breaks", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.25,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result[0].totalBreakHours).toBe(0.25);
      const amounts = calculateLineAmounts({
        chargedHours: -0.25,
        ratePerHour: 80,
        gstStatus: "registered",
        gstMode: "exclusive",
      });
      expect(amounts.amountExGst).toBe(-20);
    });

    it("should handle 0.5 hour (30 minute) breaks", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
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

      expect(result[0].totalBreakHours).toBe(0.5);
      const amounts = calculateLineAmounts({
        chargedHours: -0.5,
        ratePerHour: 80,
        gstStatus: "registered",
        gstMode: "exclusive",
      });
      expect(amounts.amountExGst).toBe(-40);
    });

    it("should handle 1 hour breaks", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 10,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 1,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result[0].totalBreakHours).toBe(1);
      const amounts = calculateLineAmounts({
        chargedHours: -1,
        ratePerHour: 80,
        gstStatus: "registered",
        gstMode: "exclusive",
      });
      expect(amounts.amountExGst).toBe(-80);
    });
  });

  describe("Truck Type Grouping", () => {
    it("should create separate break lines for each truck type", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "10T Crane",
          chargedHours: 9,
          ratePerHour: 85,
        },
        {
          jobId: 3,
          truckType: "Semi",
          chargedHours: 8.5,
          ratePerHour: 90,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(3);

      const trayBreak = result.find((b) => b.truckType === "Tray");
      const craneBreak = result.find((b) => b.truckType === "10T Crane");
      const semiBreak = result.find((b) => b.truckType === "Semi");

      expect(trayBreak?.totalBreakHours).toBe(0.5);
      expect(trayBreak?.ratePerHour).toBe(80);

      expect(craneBreak?.totalBreakHours).toBe(0.5);
      expect(craneBreak?.ratePerHour).toBe(85);

      expect(semiBreak?.totalBreakHours).toBe(0.5);
      expect(semiBreak?.ratePerHour).toBe(90);
    });

    it("should accumulate breaks for same truck type", () => {
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
      expect(result[0].truckType).toBe("10T Crane");
      expect(result[0].totalBreakHours).toBe(1.5); // 3 × 0.5
    });

    it("should use correct rate per truck type when grouping", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Tray",
          chargedHours: 8.5,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].ratePerHour).toBe(80);
      expect(result[0].totalBreakHours).toBe(1.0); // 2 × 0.5
    });
  });

  describe("Manual Lines Exclusion", () => {
    it("should exclude manual lines (jobId = null) from break calculations", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: null,
          truckType: "Tray",
          chargedHours: 10,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].totalBreakHours).toBe(0.5); // Only 1 break (manual line excluded)
    });

    it("should handle all manual lines correctly", () => {
      const lines = [
        {
          jobId: null,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: null,
          truckType: "Crane",
          chargedHours: 9,
          ratePerHour: 85,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle mix of imported and manual lines", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: null,
          truckType: "Tray",
          chargedHours: 12,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Tray",
          chargedHours: 9,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].totalBreakHours).toBe(1.0); // Only 2 imported jobs counted
    });
  });

  describe("GST Handling for Break Deductions", () => {
    it("should calculate break with GST registered exclusive correctly", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
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

      expect(result[0].amountExGst).toBe(-40);
      expect(result[0].gstAmount).toBe(-4);
      expect(result[0].amountIncGst).toBe(-44);
    });

    it("should calculate break with GST registered inclusive correctly", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(result[0].amountIncGst).toBe(-40);
      expect(result[0].amountExGst).toBe(-36.36);
      expect(result[0].gstAmount).toBe(-3.64);
    });

    it("should calculate break with GST not registered correctly", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

      expect(result[0].amountExGst).toBe(-40);
      expect(result[0].gstAmount).toBe(0);
      expect(result[0].amountIncGst).toBe(-40);
    });
  });

  describe("Break Description Generation", () => {
    it("should generate correct description for single truck type", () => {
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

    it("should generate descriptions for multiple truck types", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Semi Crane",
          chargedHours: 9,
          ratePerHour: 95,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const trayBreak = result.find((b) => b.truckType === "Tray");
      const semiCraneBreak = result.find((b) => b.truckType === "Semi Crane");

      expect(trayBreak?.description).toBe("Lunch Breaks - Tray");
      expect(semiCraneBreak?.description).toBe("Lunch Breaks - Semi Crane");
    });

    it("should create separate break lines for same truck type with different rates", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Tray",
          chargedHours: 9,
          ratePerHour: 95,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      // Should create 2 separate break lines even though both are "Tray"
      expect(result).toHaveLength(2);

      const trayBreaks = result.filter((b) => b.truckType === "Tray");
      expect(trayBreaks).toHaveLength(2);

      // Should have different rates
      const rates = trayBreaks.map((b) => b.ratePerHour).sort();
      expect(rates).toEqual([80, 95]);

      // Each should have 0.5 hours (one break per job)
      expect(trayBreaks[0].totalBreakHours).toBe(0.5);
      expect(trayBreaks[1].totalBreakHours).toBe(0.5);

      // Verify amounts are calculated with correct rates
      const break80 = trayBreaks.find((b) => b.ratePerHour === 80);
      const break95 = trayBreaks.find((b) => b.ratePerHour === 95);

      // Break at $80/hr: -0.5 * 80 = -40 ex GST
      expect(break80?.amountExGst).toBe(-40);
      expect(break80?.gstAmount).toBe(-4);
      expect(break80?.amountIncGst).toBe(-44);

      // Break at $95/hr: -0.5 * 95 = -47.5 ex GST
      expect(break95?.amountExGst).toBe(-47.5);
      expect(break95?.gstAmount).toBe(-4.75);
      expect(break95?.amountIncGst).toBe(-52.25);
    });

    it("should accumulate hours for same truck type AND rate combination", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Tray",
          chargedHours: 9,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      // Should create only 1 break line since truck type AND rate match
      expect(result).toHaveLength(1);
      expect(result[0].truckType).toBe("Tray");
      expect(result[0].ratePerHour).toBe(80);

      // Should accumulate both breaks: 0.5 + 0.5 = 1.0 hours
      expect(result[0].totalBreakHours).toBe(1.0);

      // Break at $80/hr: -1.0 * 80 = -80 ex GST
      expect(result[0].amountExGst).toBe(-80);
      expect(result[0].gstAmount).toBe(-8);
      expect(result[0].amountIncGst).toBe(-88);
    });
  });

  describe("Integration with RCTI Totals", () => {
    it("should reduce total correctly when break is applied", () => {
      const jobLine = {
        amountExGst: 640,
        gstAmount: 64,
        amountIncGst: 704,
      };

      const breakLine = {
        amountExGst: -40,
        gstAmount: -4,
        amountIncGst: -44,
      };

      const totals = calculateRctiTotals([jobLine, breakLine]);

      expect(totals.subtotal).toBe(600);
      expect(totals.gst).toBe(60);
      expect(totals.total).toBe(660);
    });

    it("should handle multiple break lines in totals", () => {
      const jobLines = [
        { amountExGst: 640, gstAmount: 64, amountIncGst: 704 },
        { amountExGst: 765, gstAmount: 76.5, amountIncGst: 841.5 },
      ];

      const breakLines = [
        { amountExGst: -40, gstAmount: -4, amountIncGst: -44 },
        { amountExGst: -42.5, gstAmount: -4.25, amountIncGst: -46.75 },
      ];

      const allLines = [...jobLines, ...breakLines];
      const totals = calculateRctiTotals(allLines);

      expect(totals.subtotal).toBe(1322.5);
      expect(totals.gst).toBe(132.25);
      expect(totals.total).toBe(1454.75);
    });

    it("should handle breaks with tolls and fuel levy in totals", () => {
      const jobLine = {
        amountExGst: 800,
        gstAmount: 80,
        amountIncGst: 880,
      };

      const breakLine = {
        amountExGst: -40,
        gstAmount: -4,
        amountIncGst: -44,
      };

      const tollLine = {
        amountExGst: 55.5,
        gstAmount: 5.55,
        amountIncGst: 61.05,
      };

      const fuelLevyLine = {
        amountExGst: 40,
        gstAmount: 4,
        amountIncGst: 44,
      };

      const totals = calculateRctiTotals([
        jobLine,
        breakLine,
        tollLine,
        fuelLevyLine,
      ]);

      expect(totals.subtotal).toBe(855.5);
      expect(totals.gst).toBe(85.55);
      expect(totals.total).toBe(941.05);
    });
  });

  describe("Edge Cases and Complex Scenarios", () => {
    it("should handle very long shifts with large break deductions", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 14,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 1,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result[0].totalBreakHours).toBe(1);
      expect(result[0].amountExGst).toBe(-80);
      expect(result[0].gstAmount).toBe(-8);
      expect(result[0].amountIncGst).toBe(-88);
    });

    it("should handle fractional break hours with correct rounding", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 83.33,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.75,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result[0].totalBreakHours).toBe(0.75);
      expect(result[0].amountExGst).toBe(-62.5);
      expect(result[0].gstAmount).toBe(-6.25);
      expect(result[0].amountIncGst).toBe(-68.75);
    });

    it("should handle week with mixed eligible and ineligible jobs", () => {
      const lines = [
        { jobId: 1, truckType: "Tray", chargedHours: 8, ratePerHour: 80 },
        { jobId: 2, truckType: "Tray", chargedHours: 6, ratePerHour: 80 },
        { jobId: 3, truckType: "Tray", chargedHours: 7, ratePerHour: 80 },
        { jobId: 4, truckType: "Tray", chargedHours: 9.5, ratePerHour: 80 },
        { jobId: 5, truckType: "Tray", chargedHours: 5.5, ratePerHour: 80 },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].totalBreakHours).toBe(1.0); // Only jobs 1 and 4 qualify
    });

    it("should handle multiple truck types with varying rates", () => {
      const lines = [
        { jobId: 1, truckType: "Tray", chargedHours: 8, ratePerHour: 80 },
        { jobId: 2, truckType: "Tray", chargedHours: 8.5, ratePerHour: 80 },
        {
          jobId: 3,
          truckType: "10T Crane",
          chargedHours: 9,
          ratePerHour: 85,
        },
        { jobId: 4, truckType: "Semi", chargedHours: 10, ratePerHour: 90 },
        { jobId: 5, truckType: "Semi", chargedHours: 8.25, ratePerHour: 90 },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(3);

      const trayBreak = result.find((b) => b.truckType === "Tray");
      const craneBreak = result.find((b) => b.truckType === "10T Crane");
      const semiBreak = result.find((b) => b.truckType === "Semi");

      expect(trayBreak?.totalBreakHours).toBe(1.0);
      expect(trayBreak?.amountExGst).toBe(-80);

      expect(craneBreak?.totalBreakHours).toBe(0.5);
      expect(craneBreak?.amountExGst).toBe(-42.5);

      expect(semiBreak?.totalBreakHours).toBe(1.0);
      expect(semiBreak?.amountExGst).toBe(-90);
    });

    it("should handle zero driver break hours edge case", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 10,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle negative driver break hours", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 10,
          ratePerHour: 80,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: -0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("Subcontractor Scenarios", () => {
    it("should calculate breaks correctly for subcontractor with multiple actual drivers", () => {
      const lines = [
        {
          jobId: 1,
          truckType: "Tray",
          chargedHours: 8,
          ratePerHour: 80,
        },
        {
          jobId: 2,
          truckType: "Tray",
          chargedHours: 9,
          ratePerHour: 80,
        },
        {
          jobId: 3,
          truckType: "10T Crane",
          chargedHours: 8.5,
          ratePerHour: 85,
        },
      ];

      const result = calculateLunchBreakLines({
        lines,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(2);

      const trayBreak = result.find((b) => b.truckType === "Tray");
      const craneBreak = result.find((b) => b.truckType === "10T Crane");

      expect(trayBreak?.totalBreakHours).toBe(1.0);
      expect(craneBreak?.totalBreakHours).toBe(0.5);
    });
  });

  describe("Real-world Weekly RCTI Scenarios", () => {
    it("should calculate typical weekly RCTI with breaks", () => {
      const weeklyJobs = [
        {
          jobId: 1,
          truckType: "10T Crane",
          chargedHours: 8,
          ratePerHour: 85,
        },
        {
          jobId: 2,
          truckType: "10T Crane",
          chargedHours: 9.5,
          ratePerHour: 85,
        },
        {
          jobId: 3,
          truckType: "10T Crane",
          chargedHours: 7.5,
          ratePerHour: 85,
        },
        {
          jobId: 4,
          truckType: "10T Crane",
          chargedHours: 8.25,
          ratePerHour: 85,
        },
        {
          jobId: 5,
          truckType: "10T Crane",
          chargedHours: 6.5,
          ratePerHour: 85,
        },
      ];

      const result = calculateLunchBreakLines({
        lines: weeklyJobs,
        driverBreakHours: 0.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result).toHaveLength(1);
      expect(result[0].totalBreakHours).toBe(2.0); // 4 days over 7 hours
      expect(result[0].amountExGst).toBe(-170); // -2 × 85
      expect(result[0].gstAmount).toBe(-17);
      expect(result[0].amountIncGst).toBe(-187);
    });
  });
});
