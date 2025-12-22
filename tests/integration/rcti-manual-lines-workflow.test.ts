/**
 * @jest-environment jest-environment-node-single-context
 */
import {
  calculateLineAmounts,
  calculateRctiTotals,
} from "@/lib/utils/rcti-calculations";

describe("RCTI Manual Lines Workflow Logic", () => {
  describe("Manual Line Entry Workflow", () => {
    it("should calculate line amounts correctly for registered GST exclusive", () => {
      const line1 = calculateLineAmounts({
        chargedHours: 8.5,
        ratePerHour: 85.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(line1.amountExGst).toBe(722.5);
      expect(line1.gstAmount).toBe(72.25);
      expect(line1.amountIncGst).toBe(794.75);
    });

    it("should calculate line amounts correctly for second manual line", () => {
      const line2 = calculateLineAmounts({
        chargedHours: 6.0,
        ratePerHour: 50.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(line2.amountExGst).toBe(300.0);
      expect(line2.gstAmount).toBe(30.0);
      expect(line2.amountIncGst).toBe(330.0);
    });

    it("should calculate RCTI totals from multiple manual lines", () => {
      const lines = [
        {
          amountExGst: 722.5,
          gstAmount: 72.25,
          amountIncGst: 794.75,
        },
        {
          amountExGst: 300.0,
          gstAmount: 30.0,
          amountIncGst: 330.0,
        },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(1022.5); // 722.5 + 300
      expect(totals.gst).toBe(102.25); // 72.25 + 30
      expect(totals.total).toBe(1124.75); // 794.75 + 330
    });

    it("should recalculate totals after removing a line", () => {
      const linesBefore = [
        {
          amountExGst: 722.5,
          gstAmount: 72.25,
          amountIncGst: 794.75,
        },
        {
          amountExGst: 300.0,
          gstAmount: 30.0,
          amountIncGst: 330.0,
        },
      ];

      // Remove first line
      const remainingLines = linesBefore.slice(1);

      const totals = calculateRctiTotals(remainingLines);

      expect(totals.subtotal).toBe(300.0);
      expect(totals.gst).toBe(30.0);
      expect(totals.total).toBe(330.0);
      expect(totals.subtotal).toBeLessThan(1022.5);
      expect(totals.gst).toBeLessThan(102.25);
      expect(totals.total).toBeLessThan(1124.75);
    });

    it("should handle manual lines with no GST correctly", () => {
      const noGstLine = calculateLineAmounts({
        chargedHours: 10.0,
        ratePerHour: 50.0,
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

      expect(noGstLine.gstAmount).toBe(0);
      expect(noGstLine.amountExGst).toBe(noGstLine.amountIncGst);
      expect(noGstLine.amountExGst).toBe(500.0);
      expect(noGstLine.amountIncGst).toBe(500.0);
    });

    it("should calculate totals for no GST lines", () => {
      const noGstLines = [
        {
          amountExGst: 500.0,
          gstAmount: 0.0,
          amountIncGst: 500.0,
        },
      ];

      const totals = calculateRctiTotals(noGstLines);

      expect(totals.gst).toBe(0);
      expect(totals.subtotal).toBe(totals.total);
      expect(totals.subtotal).toBe(500.0);
      expect(totals.total).toBe(500.0);
    });

    it("should allow mixing manual and imported job lines calculations", () => {
      // Imported job line (GST exclusive)
      const importedLine = calculateLineAmounts({
        chargedHours: 7.0,
        ratePerHour: 60.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(importedLine.amountExGst).toBe(420.0);
      expect(importedLine.gstAmount).toBe(42.0);
      expect(importedLine.amountIncGst).toBe(462.0);

      // Manual line
      const manualLine = calculateLineAmounts({
        chargedHours: 5.0,
        ratePerHour: 45.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(manualLine.amountExGst).toBe(225.0);
      expect(manualLine.gstAmount).toBe(22.5);
      expect(manualLine.amountIncGst).toBe(247.5);

      // Calculate combined totals
      const allLines = [importedLine, manualLine];
      const totals = calculateRctiTotals(allLines);

      expect(totals.subtotal).toBe(645.0); // 420 + 225
      expect(totals.gst).toBe(64.5); // 42 + 22.5
      expect(totals.total).toBe(709.5); // 462 + 247.5
    });

    it("should handle decimal hours and rates correctly", () => {
      const decimalLine = calculateLineAmounts({
        chargedHours: 7.75,
        ratePerHour: 62.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(decimalLine.amountExGst).toBe(484.38); // Banker's rounding
      expect(decimalLine.gstAmount).toBe(48.44); // Banker's rounding
      expect(decimalLine.amountIncGst).toBe(532.82); // Banker's rounding
    });

    it("should handle zero hours or rate", () => {
      const zeroLine = calculateLineAmounts({
        chargedHours: 0,
        ratePerHour: 50.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(zeroLine.amountExGst).toBe(0);
      expect(zeroLine.gstAmount).toBe(0);
      expect(zeroLine.amountIncGst).toBe(0);
    });

    it("should calculate correct totals when all lines are zero", () => {
      const lines = [
        {
          amountExGst: 0,
          gstAmount: 0,
          amountIncGst: 0,
        },
        {
          amountExGst: 0,
          gstAmount: 0,
          amountIncGst: 0,
        },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(0);
      expect(totals.gst).toBe(0);
      expect(totals.total).toBe(0);
    });
  });

  describe("Manual Line Data Integrity Logic", () => {
    it("should calculate amounts correctly for GST inclusive mode", () => {
      const line = calculateLineAmounts({
        chargedHours: 8.0,
        ratePerHour: 110.0,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(line.amountIncGst).toBe(880.0);
      expect(line.amountExGst).toBe(800.0);
      expect(line.gstAmount).toBe(80.0);
    });

    it("should handle large hours and rates", () => {
      const largeLine = calculateLineAmounts({
        chargedHours: 100.5,
        ratePerHour: 150.75,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(largeLine.amountExGst).toBe(15150.38);
      expect(largeLine.gstAmount).toBe(1515.04);
      expect(largeLine.amountIncGst).toBe(16665.42);
    });

    it("should handle negative values for deductions", () => {
      const deduction = calculateLineAmounts({
        chargedHours: -2.0,
        ratePerHour: 50.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(deduction.amountExGst).toBe(-100.0);
      expect(deduction.gstAmount).toBe(-10.0);
      expect(deduction.amountIncGst).toBe(-110.0);
    });

    it("should calculate totals with mix of positive and negative lines", () => {
      const lines = [
        {
          amountExGst: 1000.0,
          gstAmount: 100.0,
          amountIncGst: 1100.0,
        },
        {
          amountExGst: -100.0,
          gstAmount: -10.0,
          amountIncGst: -110.0,
        },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(900.0);
      expect(totals.gst).toBe(90.0);
      expect(totals.total).toBe(990.0);
    });

    it("should handle very small decimal values", () => {
      const smallLine = calculateLineAmounts({
        chargedHours: 0.25,
        ratePerHour: 50.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(smallLine.amountExGst).toBe(12.5);
      expect(smallLine.gstAmount).toBe(1.25);
      expect(smallLine.amountIncGst).toBe(13.75);
    });

    it("should maintain precision across multiple calculations", () => {
      // Create multiple lines with precise values
      const lines = [];
      for (let i = 0; i < 10; i++) {
        const line = calculateLineAmounts({
          chargedHours: 7.33,
          ratePerHour: 45.67,
          gstStatus: "registered",
          gstMode: "exclusive",
        });
        lines.push(line);
      }

      const totals = calculateRctiTotals(lines);

      // Should maintain precision through banker's rounding
      expect(totals.subtotal).toBe(3347.6);
      expect(totals.gst).toBe(334.8);
      expect(totals.total).toBe(3682.4);
    });

    it("should handle single line in totals calculation", () => {
      const singleLine = [
        {
          amountExGst: 500.0,
          gstAmount: 50.0,
          amountIncGst: 550.0,
        },
      ];

      const totals = calculateRctiTotals(singleLine);

      expect(totals.subtotal).toBe(500.0);
      expect(totals.gst).toBe(50.0);
      expect(totals.total).toBe(550.0);
    });

    it("should handle many lines efficiently", () => {
      const manyLines = Array(100)
        .fill(null)
        .map(() => ({
          amountExGst: 100.0,
          gstAmount: 10.0,
          amountIncGst: 110.0,
        }));

      const totals = calculateRctiTotals(manyLines);

      expect(totals.subtotal).toBe(10000.0);
      expect(totals.gst).toBe(1000.0);
      expect(totals.total).toBe(11000.0);
    });

    it("should validate GST calculation percentage", () => {
      const line = calculateLineAmounts({
        chargedHours: 10.0,
        ratePerHour: 100.0,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const gstPercentage = (line.gstAmount / line.amountExGst) * 100;
      expect(gstPercentage).toBe(10.0);
    });

    it("should validate inclusive GST back-calculation", () => {
      const line = calculateLineAmounts({
        chargedHours: 11.0,
        ratePerHour: 100.0,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(line.amountIncGst).toBe(1100.0);
      expect(line.amountExGst).toBe(1000.0);
      expect(line.gstAmount).toBe(100.0);

      // Verify: exGST + GST = incGST
      expect(line.amountExGst + line.gstAmount).toBe(line.amountIncGst);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle maximum precision hours", () => {
      const precisionLine = calculateLineAmounts({
        chargedHours: 12.333333,
        ratePerHour: 75.555555,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      // Banker's rounding should handle this
      expect(precisionLine.amountExGst).toBeDefined();
      expect(precisionLine.gstAmount).toBeDefined();
      expect(precisionLine.amountIncGst).toBeDefined();
    });

    it("should handle rate with many decimal places", () => {
      const line = calculateLineAmounts({
        chargedHours: 8.0,
        ratePerHour: 62.499999,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(line.amountExGst).toBe(500.0);
      expect(line.gstAmount).toBe(50.0);
      expect(line.amountIncGst).toBe(550.0);
    });

    it("should handle empty lines array", () => {
      const totals = calculateRctiTotals([]);

      expect(totals.subtotal).toBe(0);
      expect(totals.gst).toBe(0);
      expect(totals.total).toBe(0);
    });

    it("should maintain consistency in banker's rounding", () => {
      // Test that 0.5 rounds to even
      const line1 = calculateLineAmounts({
        chargedHours: 1.0,
        ratePerHour: 10.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(line1.amountExGst).toBe(10.5);
      expect(line1.gstAmount).toBe(1.05);
    });
  });
});
