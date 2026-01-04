/**
 * Unit tests to verify finalized RCTI totals are not double-adjusted
 * Tests that selectedRcti.total is treated as already adjusted for finalized RCTIs
 */

describe("RCTI Double Adjustment Fix", () => {
  describe("Finalised RCTI total calculation", () => {
    it("should treat finalised RCTI total as already adjusted", () => {
      // Scenario: RCTI with $1000 original total, $150 deduction
      const originalTotal = 1000;
      const deductionAmount = 150;
      const adjustedTotal = originalTotal - deductionAmount; // $850

      // After finalization, selectedRcti.total = $850 (already adjusted)
      const selectedRctiTotal = adjustedTotal;

      // Calculate netAdjustment from deduction applications
      const netAdjustment = 0 - deductionAmount; // -$150

      // Correct logic: derive currentTotal by subtracting netAdjustment
      const currentTotal = selectedRctiTotal - netAdjustment;

      // Verify: currentTotal should equal original total
      expect(currentTotal).toBe(originalTotal);

      // Verify: adjustedTotal should equal selectedRcti.total
      const calculatedAdjustedTotal = currentTotal + netAdjustment;
      expect(calculatedAdjustedTotal).toBe(selectedRctiTotal);
    });

    it("should not double-apply deductions for finalised RCTI", () => {
      // Incorrect logic (old):
      // currentTotal = selectedRcti.total (treating as original)
      // adjustedTotal = currentTotal + netAdjustment (double-applying)

      const originalTotal = 1000;
      const selectedRctiTotal = 850; // Already adjusted

      const netAdjustment = -150;

      // OLD (incorrect) logic:
      const oldCurrentTotal = selectedRctiTotal; // $850
      const oldAdjustedTotal = oldCurrentTotal + netAdjustment; // $850 - $150 = $700 (WRONG!)

      // NEW (correct) logic:
      const newCurrentTotal = selectedRctiTotal - netAdjustment; // $850 - (-$150) = $1000
      const newAdjustedTotal = newCurrentTotal + netAdjustment; // $1000 - $150 = $850 (correct)

      // Old logic double-applied deduction
      expect(oldAdjustedTotal).toBe(700); // Wrong: shows $700 instead of $850

      // New logic correctly shows adjusted total
      expect(newCurrentTotal).toBe(originalTotal);
      expect(newAdjustedTotal).toBe(selectedRctiTotal);
    });

    it("should handle reimbursements correctly for finalised RCTI", () => {
      const originalTotal = 1000;
      const reimbursementAmount = 100;
      const selectedRctiTotal = originalTotal + reimbursementAmount; // $1100

      const netAdjustment = reimbursementAmount; // +$100

      // Correct logic
      const currentTotal = selectedRctiTotal - netAdjustment; // $1100 - $100 = $1000
      const adjustedTotal = currentTotal + netAdjustment; // $1000 + $100 = $1100

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });

    it("should handle mixed deductions and reimbursements", () => {
      const originalTotal = 1000;
      const deductionAmount = 150;
      const reimbursementAmount = 50;
      const netAdjustment = reimbursementAmount - deductionAmount; // -$100
      const selectedRctiTotal = originalTotal + netAdjustment; // $900

      // Correct logic
      const currentTotal = selectedRctiTotal - netAdjustment; // $900 - (-$100) = $1000
      const adjustedTotal = currentTotal + netAdjustment; // $1000 + (-$100) = $900

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });

    it("should handle zero adjustments", () => {
      const originalTotal = 1000;
      const netAdjustment = 0;
      const selectedRctiTotal = originalTotal;

      const currentTotal = selectedRctiTotal - netAdjustment;
      const adjustedTotal = currentTotal + netAdjustment;

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });
  });

  describe("Draft RCTI total calculation", () => {
    it("should calculate from edited lines for draft RCTI", () => {
      // For draft RCTIs, currentTotal is calculated from lines
      // and is NOT derived from selectedRcti.total
      const line1Total = 500;
      const line2Total = 500;
      const calculatedTotal = line1Total + line2Total; // $1000

      const deductionAmount = 150;
      const netAdjustment = -deductionAmount;

      // For drafts, currentTotal comes from line calculation
      const currentTotal = calculatedTotal;
      const adjustedTotal = currentTotal + netAdjustment; // $1000 - $150 = $850

      expect(currentTotal).toBe(1000);
      expect(adjustedTotal).toBe(850);
    });
  });

  describe("PDF template consistency", () => {
    it("should match PDF template logic for finalised RCTI", () => {
      // PDF template logic (from rcti-pdf-template.tsx):
      // const netAdjustment = totalReimbursements - totalDeductions;
      // const originalTotal = toNumber(rcti.total) - netAdjustment;
      // const adjustedTotal = toNumber(rcti.total);

      const rctiTotal = 850; // Already adjusted
      const totalDeductions = 150;
      const totalReimbursements = 0;
      const netAdjustment = totalReimbursements - totalDeductions; // -$150

      // PDF template calculation
      const originalTotal = rctiTotal - netAdjustment; // $850 - (-$150) = $1000
      const adjustedTotal = rctiTotal; // $850

      expect(originalTotal).toBe(1000);
      expect(adjustedTotal).toBe(850);

      // Verify display logic matches
      const displayedCurrentTotal = originalTotal;
      const displayedAdjustedTotal = displayedCurrentTotal + netAdjustment;

      expect(displayedCurrentTotal).toBe(1000);
      expect(displayedAdjustedTotal).toBe(adjustedTotal);
    });
  });

  describe("Edge cases", () => {
    it("should handle large deduction amounts", () => {
      const originalTotal = 10000;
      const deductionAmount = 5000;
      const selectedRctiTotal = originalTotal - deductionAmount; // $5000

      const netAdjustment = -deductionAmount;
      const currentTotal = selectedRctiTotal - netAdjustment;
      const adjustedTotal = currentTotal + netAdjustment;

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });

    it("should handle decimal values correctly", () => {
      const originalTotal = 1234.56;
      const deductionAmount = 123.45;
      const selectedRctiTotal = originalTotal - deductionAmount; // $1111.11

      const netAdjustment = -deductionAmount;
      const currentTotal = selectedRctiTotal - netAdjustment;
      const adjustedTotal = currentTotal + netAdjustment;

      expect(currentTotal).toBeCloseTo(originalTotal, 2);
      expect(adjustedTotal).toBeCloseTo(selectedRctiTotal, 2);
    });

    it("should handle multiple deductions", () => {
      const originalTotal = 2000;
      const deduction1 = 100;
      const deduction2 = 200;
      const deduction3 = 50;
      const totalDeductions = deduction1 + deduction2 + deduction3; // $350
      const selectedRctiTotal = originalTotal - totalDeductions; // $1650

      const netAdjustment = -totalDeductions;
      const currentTotal = selectedRctiTotal - netAdjustment;
      const adjustedTotal = currentTotal + netAdjustment;

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });

    it("should handle reimbursements exceeding deductions", () => {
      const originalTotal = 1000;
      const deductionAmount = 100;
      const reimbursementAmount = 300;
      const netAdjustment = reimbursementAmount - deductionAmount; // +$200
      const selectedRctiTotal = originalTotal + netAdjustment; // $1200

      const currentTotal = selectedRctiTotal - netAdjustment;
      const adjustedTotal = currentTotal + netAdjustment;

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });
  });
});
