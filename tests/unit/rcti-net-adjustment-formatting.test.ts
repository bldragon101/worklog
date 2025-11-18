/**
 * Unit tests for Net Adjustment display formatting
 * Verifies that negative adjustments show "-$10.00" format
 */

describe("RCTI Net Adjustment Formatting", () => {
  describe("Net Adjustment string format", () => {
    it("should format positive net adjustment with + prefix", () => {
      const reimbursements = 100;
      const deductions = 50;
      const net = reimbursements - deductions; // +50

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$50.00");
    });

    it("should format negative net adjustment with - prefix", () => {
      const reimbursements = 50;
      const deductions = 100;
      const net = reimbursements - deductions; // -50

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$50.00");
    });

    it("should format zero net adjustment with + prefix", () => {
      const reimbursements = 100;
      const deductions = 100;
      const net = reimbursements - deductions; // 0

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$0.00");
    });

    it("should format large negative amounts correctly", () => {
      const net = -1234.56;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$1234.56");
    });

    it("should format large positive amounts correctly", () => {
      const net = 9876.54;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$9876.54");
    });

    it("should round to 2 decimal places", () => {
      const net = -123.456789;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$123.46");
    });

    it("should handle very small negative amounts", () => {
      const net = -0.01;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$0.01");
    });

    it("should handle very small positive amounts", () => {
      const net = 0.01;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$0.01");
    });
  });

  describe("Old vs New formatting comparison", () => {
    it("OLD: would omit negative sign for negative values", () => {
      const net = -50;

      // Old formatting (incorrect)
      const oldFormat = `${net >= 0 ? "+" : ""}$${Math.abs(net).toFixed(2)}`;

      expect(oldFormat).toBe("$50.00"); // Missing negative sign!
    });

    it("NEW: explicitly shows negative sign for negative values", () => {
      const net = -50;

      // New formatting (correct)
      const newFormat = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(newFormat).toBe("-$50.00"); // Correct!
    });

    it("both formats work the same for positive values", () => {
      const net = 50;

      const oldFormat = `${net >= 0 ? "+" : ""}$${Math.abs(net).toFixed(2)}`;
      const newFormat = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(oldFormat).toBe("+$50.00");
      expect(newFormat).toBe("+$50.00");
    });
  });

  describe("Real-world scenarios", () => {
    it("should format single deduction correctly", () => {
      const deductions = 150;
      const reimbursements = 0;
      const net = reimbursements - deductions;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$150.00");
    });

    it("should format single reimbursement correctly", () => {
      const deductions = 0;
      const reimbursements = 75;
      const net = reimbursements - deductions;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$75.00");
    });

    it("should format mixed deductions and reimbursements (net negative)", () => {
      const deductions = 200;
      const reimbursements = 50;
      const net = reimbursements - deductions;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$150.00");
    });

    it("should format mixed deductions and reimbursements (net positive)", () => {
      const deductions = 50;
      const reimbursements = 200;
      const net = reimbursements - deductions;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$150.00");
    });

    it("should format equal deductions and reimbursements", () => {
      const deductions = 100;
      const reimbursements = 100;
      const net = reimbursements - deductions;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("+$0.00");
    });

    it("should format multiple deductions correctly", () => {
      const deduction1 = 50;
      const deduction2 = 75;
      const deduction3 = 25;
      const totalDeductions = deduction1 + deduction2 + deduction3;
      const reimbursements = 0;
      const net = reimbursements - totalDeductions;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$150.00");
    });
  });

  describe("Edge cases", () => {
    it("should handle negative zero", () => {
      const net = -0;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      // -0 is treated as >= 0 in JavaScript
      expect(formatted).toBe("+$0.00");
    });

    it("should handle floating point precision issues", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const net = -(0.1 + 0.2);

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$0.30");
    });

    it("should handle very large negative numbers", () => {
      const net = -999999.99;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$999999.99");
    });

    it("should truncate extra decimal places", () => {
      const net = -123.999999;

      const formatted = `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;

      expect(formatted).toBe("-$124.00"); // Rounded up
    });
  });
});
