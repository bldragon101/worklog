import {
  bankersRound,
  calculateLineAmounts,
  calculateRctiTotals,
  generateInvoiceNumber,
  getDriverRateForTruckType,
} from "../src/lib/utils/rcti-calculations";

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

        expect(result.amountExGst).toBe(339.98); // 7.5 * 45.33 = 339.975 → rounds to 340.00 → banker's round to 339.98
        expect(result.gstAmount).toBe(0);
        expect(result.amountIncGst).toBe(339.98);
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

        const exGst = 339.98; // 7.5 * 45.33 rounded
        const gst = 34.0; // 10% of 339.975 = 33.9975 → banker's round
        const incGst = 373.98; // sum rounded

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

        const incGst = 339.98; // 7.5 * 45.33 rounded
        const exGst = 309.07; // 339.975 / 1.1 = 309.0681... → banker's round
        const gst = 30.91; // difference

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
  });

  describe("generateInvoiceNumber", () => {
    it("should generate first invoice number for today", () => {
      const existing: string[] = [];
      const result = generateInvoiceNumber(existing);

      // Should match format RCTI-YYYYMMDD-0001
      expect(result).toMatch(/^RCTI-\d{8}-0001$/);
    });

    it("should increment sequence for same day", () => {
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const existing = [
        `RCTI-${today}-0001`,
        `RCTI-${today}-0002`,
        `RCTI-${today}-0003`,
      ];

      const result = generateInvoiceNumber(existing);
      expect(result).toBe(`RCTI-${today}-0004`);
    });

    it("should start at 0001 for new day", () => {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0]
        .replace(/-/g, "");
      const existing = [`RCTI-${yesterday}-0001`, `RCTI-${yesterday}-0002`];

      const result = generateInvoiceNumber(existing);
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      expect(result).toBe(`RCTI-${today}-0001`);
    });

    it("should handle non-sequential existing numbers", () => {
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const existing = [
        `RCTI-${today}-0001`,
        `RCTI-${today}-0005`,
        `RCTI-${today}-0003`,
      ];

      const result = generateInvoiceNumber(existing);
      expect(result).toBe(`RCTI-${today}-0006`); // Should be max + 1
    });

    it("should pad sequence number with zeros", () => {
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const existing = [`RCTI-${today}-0009`];

      const result = generateInvoiceNumber(existing);
      expect(result).toBe(`RCTI-${today}-0010`);
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
