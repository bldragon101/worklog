import { Decimal } from "@prisma/client/runtime/library";
import {
  toNumber,
  toDecimal,
  bankersRound,
  calculateLineAmounts,
  calculateRctiTotals,
} from "@/lib/utils/rcti-calculations";

describe("Decimal Precision Handling", () => {
  describe("toNumber helper", () => {
    it("should convert Decimal to number", () => {
      const decimal = new Decimal("123.45");
      expect(toNumber(decimal)).toBe(123.45);
    });

    it("should pass through numbers unchanged", () => {
      expect(toNumber(123.45)).toBe(123.45);
    });

    it("should handle zero", () => {
      expect(toNumber(new Decimal(0))).toBe(0);
      expect(toNumber(0)).toBe(0);
    });

    it("should handle negative values", () => {
      expect(toNumber(new Decimal("-50.25"))).toBe(-50.25);
      expect(toNumber(-50.25)).toBe(-50.25);
    });
  });

  describe("toDecimal helper", () => {
    it("should return number as-is for client compatibility", () => {
      const result = toDecimal(123.45);
      expect(result).toBe(123.45);
    });

    it("should handle zero", () => {
      const result = toDecimal(0);
      expect(result).toBe(0);
    });

    it("should handle negative values", () => {
      const result = toDecimal(-50.25);
      expect(result).toBe(-50.25);
    });
  });

  describe("Financial calculations with Decimal", () => {
    it("should avoid floating-point errors in calculations", () => {
      // Classic floating-point problem: 0.1 + 0.2 !== 0.3
      const a = 0.1;
      const b = 0.2;
      const floatSum = a + b;
      expect(floatSum).not.toBe(0.3); // Demonstrates the problem

      // With our banker's rounding, we get exact results
      const rounded = bankersRound(floatSum);
      expect(rounded).toBe(0.3);
    });

    it("should handle GST calculations with exact precision", () => {
      // Calculate GST exclusive: $100 + 10% GST
      const result = calculateLineAmounts({
        chargedHours: 10,
        ratePerHour: 10,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result.amountExGst).toBe(100.0);
      expect(result.gstAmount).toBe(10.0);
      expect(result.amountIncGst).toBe(110.0);
    });

    it("should handle complex rate calculations without precision loss", () => {
      // Real-world example: 8.5 hours at $62.50/hr
      const result = calculateLineAmounts({
        chargedHours: 8.5,
        ratePerHour: 62.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      // 8.5 * 62.5 = 531.25
      expect(result.amountExGst).toBe(531.25);
      expect(result.gstAmount).toBe(53.12); // Banker's rounding: 53.125 → 53.12 (round to even)
      expect(result.amountIncGst).toBe(584.37); // 531.25 + 53.12 = 584.37
    });

    it("should handle totals calculation with Decimal inputs", () => {
      const lines = [
        {
          amountExGst: new Decimal("100.50"),
          gstAmount: new Decimal("10.05"),
          amountIncGst: new Decimal("110.55"),
        },
        {
          amountExGst: new Decimal("200.75"),
          gstAmount: new Decimal("20.08"),
          amountIncGst: new Decimal("220.83"),
        },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(301.25);
      expect(totals.gst).toBe(30.13);
      expect(totals.total).toBe(331.38);
    });

    it("should handle totals calculation with mixed number and Decimal inputs", () => {
      const lines = [
        {
          amountExGst: 100.5, // number
          gstAmount: new Decimal("10.05"), // Decimal
          amountIncGst: 110.55, // number
        },
        {
          amountExGst: new Decimal("200.75"), // Decimal
          gstAmount: 20.08, // number
          amountIncGst: new Decimal("220.83"), // Decimal
        },
      ];

      const totals = calculateRctiTotals(lines);

      expect(totals.subtotal).toBe(301.25);
      expect(totals.gst).toBe(30.13);
      expect(totals.total).toBe(331.38);
    });
  });

  describe("Banker's rounding (round half to even)", () => {
    it("should round to 2 decimal places", () => {
      expect(bankersRound(0.5)).toBe(0.5);
      expect(bankersRound(1.5)).toBe(1.5);
      expect(bankersRound(2.5)).toBe(2.5);
      expect(bankersRound(3.5)).toBe(3.5);
    });

    it("should handle currency rounding correctly", () => {
      // Banker's rounding at 2 decimal places (third decimal determines rounding)
      // 53.125 should round to 53.12 (even)
      expect(bankersRound(53.125)).toBe(53.12);

      // 53.135 should round to 53.14 (even)
      expect(bankersRound(53.135)).toBe(53.14);

      // 53.145 should round to 53.14 (even)
      expect(bankersRound(53.145)).toBe(53.14);

      // 53.155 should round to 53.16 (even)
      expect(bankersRound(53.155)).toBe(53.16);
    });
  });

  describe("Real-world RCTI scenarios", () => {
    it("should handle lunch break deductions precisely", () => {
      // Job: 8.5 hours at $85/hr
      const jobLine = calculateLineAmounts({
        chargedHours: 8.5,
        ratePerHour: 85,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      // Break deduction: -0.5 hours at $85/hr
      const breakLine = calculateLineAmounts({
        chargedHours: -0.5,
        ratePerHour: 85,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      // Calculate net
      const netExGst = jobLine.amountExGst + breakLine.amountExGst;
      const netGst = jobLine.gstAmount + breakLine.gstAmount;
      const netTotal = jobLine.amountIncGst + breakLine.amountIncGst;

      expect(netExGst).toBe(680.0); // 722.5 - 42.5
      expect(netGst).toBe(68.0); // 72.25 - 4.25
      expect(netTotal).toBe(748.0); // 794.75 - 46.75
    });

    it("should handle multiple lines with different rates", () => {
      const line1 = calculateLineAmounts({
        chargedHours: 7.5,
        ratePerHour: 65,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const line2 = calculateLineAmounts({
        chargedHours: 4.25,
        ratePerHour: 72.5,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const line3 = calculateLineAmounts({
        chargedHours: 6.0,
        ratePerHour: 58.75,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const totals = calculateRctiTotals([line1, line2, line3]);

      // Verify individual calculations
      expect(line1.amountExGst).toBe(487.5); // 7.5 * 65
      expect(line2.amountExGst).toBe(308.12); // 4.25 * 72.5 = 308.125 → 308.12
      expect(line3.amountExGst).toBe(352.5); // 6.0 * 58.75

      // Verify totals
      expect(totals.subtotal).toBe(1148.12);
      expect(totals.gst).toBe(114.81);
      expect(totals.total).toBe(1262.93);
    });

    it("should handle GST inclusive calculations", () => {
      // $110 inc GST should be $100 ex GST + $10 GST
      const result = calculateLineAmounts({
        chargedHours: 10,
        ratePerHour: 11,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(result.amountIncGst).toBe(110.0);
      expect(result.amountExGst).toBe(100.0);
      expect(result.gstAmount).toBe(10.0);
    });

    it("should handle no GST registration", () => {
      const result = calculateLineAmounts({
        chargedHours: 8,
        ratePerHour: 50,
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

      expect(result.amountExGst).toBe(400.0);
      expect(result.gstAmount).toBe(0.0);
      expect(result.amountIncGst).toBe(400.0);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero values", () => {
      const result = calculateLineAmounts({
        chargedHours: 0,
        ratePerHour: 50,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result.amountExGst).toBe(0.0);
      expect(result.gstAmount).toBe(0.0);
      expect(result.amountIncGst).toBe(0.0);
    });

    it("should handle very small amounts", () => {
      const result = calculateLineAmounts({
        chargedHours: 0.01,
        ratePerHour: 0.01,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result.amountExGst).toBe(0.0);
      expect(result.gstAmount).toBe(0.0);
      expect(result.amountIncGst).toBe(0.0);
    });

    it("should handle large amounts within precision", () => {
      const result = calculateLineAmounts({
        chargedHours: 1000,
        ratePerHour: 9999.99,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result.amountExGst).toBe(9999990.0);
      expect(result.gstAmount).toBe(999999.0);
      expect(result.amountIncGst).toBe(10999989.0);
    });

    it("should handle negative values (deductions)", () => {
      const result = calculateLineAmounts({
        chargedHours: -5,
        ratePerHour: 60,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(result.amountExGst).toBe(-300.0);
      expect(result.gstAmount).toBe(-30.0);
      expect(result.amountIncGst).toBe(-330.0);
    });
  });

  describe("Decimal constructor variations", () => {
    it("should handle Decimal created from string", () => {
      const decimal = new Decimal("123.456789");
      expect(toNumber(decimal)).toBeCloseTo(123.456789);
    });

    it("should handle Decimal created from number", () => {
      const decimal = new Decimal(123.45);
      expect(toNumber(decimal)).toBe(123.45);
    });

    it("should handle very precise Decimal values", () => {
      const decimal = new Decimal("0.123456789012345");
      const num = toNumber(decimal);
      expect(num).toBeCloseTo(0.123456789012345);
    });
  });
});
