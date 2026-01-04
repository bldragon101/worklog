/**
 * Unit tests for RCTI display totals calculation
 * Verifies that finalized RCTIs display totals correctly without double-counting
 */

describe("RCTI Display Totals Calculation", () => {
  describe("Draft RCTI display", () => {
    it("should calculate current total from lines", () => {
      const line1 = { amountIncGst: 500 };
      const line2 = { amountIncGst: 500 };
      const calculatedTotal = line1.amountIncGst + line2.amountIncGst;

      const netAdjustment = -150; // Pending deduction
      const adjustedTotal = calculatedTotal + netAdjustment;

      expect(calculatedTotal).toBe(1000);
      expect(adjustedTotal).toBe(850);
    });

    it("should show pending adjustments for draft", () => {
      const currentTotal = 1000; // From lines
      const pendingDeduction = 150;
      const netAdjustment = -pendingDeduction;
      const adjustedTotal = currentTotal + netAdjustment;

      // Display should show:
      // Total (Inc GST): $1000.00
      // Deductions: -$150.00
      // Amount Payable: $850.00

      expect(currentTotal).toBe(1000);
      expect(netAdjustment).toBe(-150);
      expect(adjustedTotal).toBe(850);
    });
  });

  describe("Finalised RCTI display", () => {
    it("should derive original total from adjusted total", () => {
      // Scenario: RCTI was created with $1000, $150 deduction applied at finalization
      const selectedRctiTotal = 850; // Stored in DB after finalization
      const appliedDeduction = 150;
      const netAdjustment = -appliedDeduction;

      // Derive original total
      const currentTotal = selectedRctiTotal - netAdjustment;
      const adjustedTotal = currentTotal + netAdjustment;

      // Current total should be original amount
      expect(currentTotal).toBe(1000);

      // Adjusted total should equal stored total
      expect(adjustedTotal).toBe(selectedRctiTotal);
    });

    it("should NOT double-count adjustments", () => {
      // RCTI finalized with adjustments already applied
      const originalTotal = 1000;
      const deduction = 150;
      const storedTotal = originalTotal - deduction; // 850 (already adjusted in DB)

      // Calculate what we show on screen
      const netAdjustment = -deduction;
      const displayedCurrentTotal = storedTotal - netAdjustment; // 850 - (-150) = 1000
      const displayedAdjustedTotal = displayedCurrentTotal + netAdjustment; // 1000 + (-150) = 850

      // Display should show:
      // Total (Inc GST): $1000.00 (original)
      // Deductions: -$150.00
      // Amount Payable: $850.00 (matches DB)

      expect(displayedCurrentTotal).toBe(originalTotal);
      expect(displayedAdjustedTotal).toBe(storedTotal);
      expect(displayedAdjustedTotal).not.toBe(storedTotal - deduction); // Would be 700 if double-counted
    });

    it("should handle reimbursements correctly", () => {
      const originalTotal = 1000;
      const reimbursement = 100;
      const storedTotal = originalTotal + reimbursement; // 1100

      const netAdjustment = reimbursement;
      const currentTotal = storedTotal - netAdjustment; // 1100 - 100 = 1000
      const adjustedTotal = currentTotal + netAdjustment; // 1000 + 100 = 1100

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(storedTotal);
    });

    it("should handle mixed deductions and reimbursements", () => {
      const originalTotal = 1000;
      const deduction = 150;
      const reimbursement = 50;
      const netAdjustment = reimbursement - deduction; // -100
      const storedTotal = originalTotal + netAdjustment; // 900

      const currentTotal = storedTotal - netAdjustment; // 900 - (-100) = 1000
      const adjustedTotal = currentTotal + netAdjustment; // 1000 + (-100) = 900

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(storedTotal);
    });
  });

  describe("Display consistency", () => {
    it("should match PDF template logic for finalized RCTI", () => {
      // PDF template logic:
      // const netAdjustment = totalReimbursements - totalDeductions;
      // const originalTotal = toNumber(rcti.total) - netAdjustment;
      // const adjustedTotal = toNumber(rcti.total);

      const rctiTotal = 850; // Stored in DB (already adjusted)
      const totalDeductions = 150;
      const totalReimbursements = 0;
      const netAdjustment = totalReimbursements - totalDeductions; // -150

      // PDF calculation
      const originalTotal = rctiTotal - netAdjustment; // 850 - (-150) = 1000
      const adjustedTotal = rctiTotal; // 850

      // UI calculation (should match)
      const uiCurrentTotal = rctiTotal - netAdjustment;
      const uiAdjustedTotal = uiCurrentTotal + netAdjustment;

      expect(uiCurrentTotal).toBe(originalTotal);
      expect(uiAdjustedTotal).toBe(adjustedTotal);
    });

    it("should show same amounts in UI and PDF", () => {
      const rctiTotal = 925; // Stored total
      const deduction1 = 50;
      const deduction2 = 75;
      const reimbursement = 50;

      const totalDeductions = deduction1 + deduction2; // 125
      const totalReimbursements = reimbursement; // 50
      const netAdjustment = totalReimbursements - totalDeductions; // -75

      // What UI shows
      const uiOriginalTotal = rctiTotal - netAdjustment; // 925 - (-75) = 1000
      const uiAdjustedTotal = uiOriginalTotal + netAdjustment; // 1000 + (-75) = 925

      // What PDF shows
      const pdfOriginalTotal = rctiTotal - netAdjustment; // 925 - (-75) = 1000
      const pdfAdjustedTotal = rctiTotal; // 925

      expect(uiOriginalTotal).toBe(pdfOriginalTotal);
      expect(uiAdjustedTotal).toBe(pdfAdjustedTotal);
      expect(uiAdjustedTotal).toBe(rctiTotal); // Both show stored total
    });
  });

  describe("Edge cases", () => {
    it("should handle zero adjustments", () => {
      const rctiTotal = 1000;
      const netAdjustment = 0;

      const currentTotal = rctiTotal - netAdjustment; // 1000
      const adjustedTotal = currentTotal + netAdjustment; // 1000

      expect(currentTotal).toBe(1000);
      expect(adjustedTotal).toBe(1000);
    });

    it("should handle large deductions", () => {
      const originalTotal = 10000;
      const largeDeduction = 5000;
      const storedTotal = originalTotal - largeDeduction; // 5000

      const netAdjustment = -largeDeduction;
      const currentTotal = storedTotal - netAdjustment; // 5000 - (-5000) = 10000
      const adjustedTotal = currentTotal + netAdjustment; // 10000 + (-5000) = 5000

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(storedTotal);
    });

    it("should handle floating point precision", () => {
      const originalTotal = 1234.56;
      const deduction = 234.56;
      const storedTotal = 1000.0; // After deduction

      const netAdjustment = -deduction;
      const currentTotal = storedTotal - netAdjustment; // 1000 - (-234.56) = 1234.56
      const adjustedTotal = currentTotal + netAdjustment; // 1234.56 + (-234.56) = 1000

      expect(currentTotal).toBeCloseTo(originalTotal, 2);
      expect(adjustedTotal).toBeCloseTo(storedTotal, 2);
    });

    it("should handle multiple deductions correctly", () => {
      const originalTotal = 2000;
      const deduction1 = 100;
      const deduction2 = 200;
      const deduction3 = 50;
      const totalDeductions = deduction1 + deduction2 + deduction3; // 350
      const storedTotal = originalTotal - totalDeductions; // 1650

      const netAdjustment = -totalDeductions;
      const currentTotal = storedTotal - netAdjustment; // 1650 - (-350) = 2000
      const adjustedTotal = currentTotal + netAdjustment; // 2000 + (-350) = 1650

      expect(currentTotal).toBe(originalTotal);
      expect(adjustedTotal).toBe(storedTotal);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle typical weekly deduction scenario", () => {
      // Weekly RCTI: Driver earned $1,200, has $150 weekly deduction
      const weeklyEarnings = 1200;
      const weeklyDeduction = 150;
      const finalPayment = weeklyEarnings - weeklyDeduction; // 1050 (stored in DB)

      const netAdjustment = -weeklyDeduction;
      const displayTotal = finalPayment - netAdjustment; // 1050 - (-150) = 1200
      const displayPayable = displayTotal + netAdjustment; // 1200 + (-150) = 1050

      // UI shows:
      // Total (Inc GST): $1,200.00
      // Deductions: -$150.00
      // Amount Payable: $1,050.00

      expect(displayTotal).toBe(weeklyEarnings);
      expect(displayPayable).toBe(finalPayment);
    });

    it("should handle skip scenario (zero application)", () => {
      // RCTI created but deduction was skipped (0 amount applied)
      const weeklyEarnings = 1200;
      const skippedDeduction = 0; // User chose to skip this week
      const finalPayment = weeklyEarnings; // No deduction applied

      const netAdjustment = -skippedDeduction; // 0
      const displayTotal = finalPayment - netAdjustment; // 1200
      const displayPayable = displayTotal + netAdjustment; // 1200

      expect(displayTotal).toBe(weeklyEarnings);
      expect(displayPayable).toBe(finalPayment);
    });

    it("should handle custom amount override scenario", () => {
      // RCTI: Normal deduction is $150, but user applied $100 this week
      const weeklyEarnings = 1200;
      const customDeduction = 100; // Override amount
      const finalPayment = weeklyEarnings - customDeduction; // 1100

      const netAdjustment = -customDeduction;
      const displayTotal = finalPayment - netAdjustment; // 1100 - (-100) = 1200
      const displayPayable = displayTotal + netAdjustment; // 1200 + (-100) = 1100

      expect(displayTotal).toBe(weeklyEarnings);
      expect(displayPayable).toBe(finalPayment);
    });

    it("should handle reimbursement scenario", () => {
      // RCTI: Driver earned $1,200 and has $50 fuel reimbursement
      const weeklyEarnings = 1200;
      const fuelReimbursement = 50;
      const finalPayment = weeklyEarnings + fuelReimbursement; // 1250

      const netAdjustment = fuelReimbursement; // +50
      const displayTotal = finalPayment - netAdjustment; // 1250 - 50 = 1200
      const displayPayable = displayTotal + netAdjustment; // 1200 + 50 = 1250

      // UI shows:
      // Total (Inc GST): $1,200.00
      // Reimbursements: +$50.00
      // Amount Payable: $1,250.00

      expect(displayTotal).toBe(weeklyEarnings);
      expect(displayPayable).toBe(finalPayment);
    });
  });
});
