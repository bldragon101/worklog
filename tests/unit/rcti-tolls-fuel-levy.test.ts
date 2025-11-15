import {
  calculateLineAmounts,
  calculateRctiTotals,
} from "../../src/lib/utils/rcti-calculations";

/**
 * Unit tests for RCTI tolls and fuel levy calculations
 * Tests toll line generation, fuel levy percentage calculations, and GST handling
 */

describe("RCTI Tolls and Fuel Levy Calculations", () => {
  const TOLL_RATE_EASTLINK = 18.5;
  const TOLL_RATE_CITYLINK = 31;

  describe("Toll Calculations - Eastlink", () => {
    it("should calculate single Eastlink toll correctly with GST registered exclusive", () => {
      const totalEastlink = 1;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(18.5);
      expect(tollAmounts.gstAmount).toBe(1.85);
      expect(tollAmounts.amountIncGst).toBe(20.35);
    });

    it("should calculate multiple Eastlink tolls correctly", () => {
      const totalEastlink = 5;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(92.5);
      expect(tollAmounts.gstAmount).toBe(9.25);
      expect(tollAmounts.amountIncGst).toBe(101.75);
    });

    it("should calculate Eastlink tolls with GST not registered", () => {
      const totalEastlink = 3;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(55.5);
      expect(tollAmounts.gstAmount).toBe(0);
      expect(tollAmounts.amountIncGst).toBe(55.5);
    });

    it("should calculate Eastlink tolls with GST registered inclusive", () => {
      const totalEastlink = 2;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(tollAmounts.amountIncGst).toBe(37);
      expect(tollAmounts.amountExGst).toBe(33.64);
      expect(tollAmounts.gstAmount).toBe(3.36);
    });

    it("should handle large number of Eastlink tolls", () => {
      const totalEastlink = 20;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(370);
      expect(tollAmounts.gstAmount).toBe(37);
      expect(tollAmounts.amountIncGst).toBe(407);
    });
  });

  describe("Toll Calculations - CityLink", () => {
    it("should calculate single CityLink toll correctly with GST registered exclusive", () => {
      const totalCitylink = 1;
      const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(31);
      expect(tollAmounts.gstAmount).toBe(3.1);
      expect(tollAmounts.amountIncGst).toBe(34.1);
    });

    it("should calculate multiple CityLink tolls correctly", () => {
      const totalCitylink = 4;
      const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(124);
      expect(tollAmounts.gstAmount).toBe(12.4);
      expect(tollAmounts.amountIncGst).toBe(136.4);
    });

    it("should calculate CityLink tolls with GST not registered", () => {
      const totalCitylink = 2;
      const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(62);
      expect(tollAmounts.gstAmount).toBe(0);
      expect(tollAmounts.amountIncGst).toBe(62);
    });

    it("should calculate CityLink tolls with GST registered inclusive", () => {
      const totalCitylink = 3;
      const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(tollAmounts.amountIncGst).toBe(93);
      expect(tollAmounts.amountExGst).toBe(84.55);
      expect(tollAmounts.gstAmount).toBe(8.45);
    });
  });

  describe("Mixed Toll Calculations", () => {
    it("should calculate both Eastlink and CityLink tolls correctly", () => {
      const totalEastlink = 3;
      const totalCitylink = 2;

      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;
      const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;

      const eastlinkTollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const citylinkTollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(eastlinkTollAmounts.amountExGst).toBe(55.5);
      expect(eastlinkTollAmounts.gstAmount).toBe(5.55);
      expect(eastlinkTollAmounts.amountIncGst).toBe(61.05);

      expect(citylinkTollAmounts.amountExGst).toBe(62);
      expect(citylinkTollAmounts.gstAmount).toBe(6.2);
      expect(citylinkTollAmounts.amountIncGst).toBe(68.2);
    });

    it("should sum toll lines correctly in totals", () => {
      const eastlinkLine = {
        amountExGst: 55.5,
        gstAmount: 5.55,
        amountIncGst: 61.05,
      };

      const citylinkLine = {
        amountExGst: 62,
        gstAmount: 6.2,
        amountIncGst: 68.2,
      };

      const totals = calculateRctiTotals([eastlinkLine, citylinkLine]);

      expect(totals.subtotal).toBe(117.5);
      expect(totals.gst).toBe(11.75);
      expect(totals.total).toBe(129.25);
    });
  });

  describe("Fuel Levy Calculations", () => {
    it("should calculate 5% fuel levy on job subtotal with GST registered exclusive", () => {
      const jobLinesSubtotal = 1000;
      const fuelLevyPercentage = 5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(50);
      expect(fuelLevyAmounts.gstAmount).toBe(5);
      expect(fuelLevyAmounts.amountIncGst).toBe(55);
    });

    it("should calculate 10% fuel levy on job subtotal", () => {
      const jobLinesSubtotal = 2500;
      const fuelLevyPercentage = 10;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(250);
      expect(fuelLevyAmounts.gstAmount).toBe(25);
      expect(fuelLevyAmounts.amountIncGst).toBe(275);
    });

    it("should calculate 2.5% fuel levy with decimal percentage", () => {
      const jobLinesSubtotal = 800;
      const fuelLevyPercentage = 2.5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(20);
      expect(fuelLevyAmounts.gstAmount).toBe(2);
      expect(fuelLevyAmounts.amountIncGst).toBe(22);
    });

    it("should calculate fuel levy with GST not registered", () => {
      const jobLinesSubtotal = 1500;
      const fuelLevyPercentage = 5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(75);
      expect(fuelLevyAmounts.gstAmount).toBe(0);
      expect(fuelLevyAmounts.amountIncGst).toBe(75);
    });

    it("should calculate fuel levy with GST registered inclusive", () => {
      const jobLinesSubtotal = 1000;
      const fuelLevyPercentage = 5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "inclusive",
      });

      expect(fuelLevyAmounts.amountIncGst).toBe(50);
      expect(fuelLevyAmounts.amountExGst).toBe(45.45);
      expect(fuelLevyAmounts.gstAmount).toBe(4.55);
    });

    it("should handle small fuel levy amounts with correct rounding", () => {
      const jobLinesSubtotal = 127.35;
      const fuelLevyPercentage = 3;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(3.82);
      expect(fuelLevyAmounts.gstAmount).toBe(0.38);
      expect(fuelLevyAmounts.amountIncGst).toBe(4.2);
    });

    it("should handle large fuel levy amounts", () => {
      const jobLinesSubtotal = 15000;
      const fuelLevyPercentage = 7.5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(1125);
      expect(fuelLevyAmounts.gstAmount).toBe(112.5);
      expect(fuelLevyAmounts.amountIncGst).toBe(1237.5);
    });
  });

  describe("Integration - Tolls and Fuel Levy Together", () => {
    it("should calculate totals correctly with job lines, tolls, and fuel levy", () => {
      const jobLine = {
        amountExGst: 1000,
        gstAmount: 100,
        amountIncGst: 1100,
      };

      const eastlinkLine = {
        amountExGst: 55.5,
        gstAmount: 5.55,
        amountIncGst: 61.05,
      };

      const citylinkLine = {
        amountExGst: 62,
        gstAmount: 6.2,
        amountIncGst: 68.2,
      };

      const fuelLevyLine = {
        amountExGst: 50,
        gstAmount: 5,
        amountIncGst: 55,
      };

      const totals = calculateRctiTotals([
        jobLine,
        eastlinkLine,
        citylinkLine,
        fuelLevyLine,
      ]);

      expect(totals.subtotal).toBe(1167.5);
      expect(totals.gst).toBe(116.75);
      expect(totals.total).toBe(1284.25);
    });

    it("should calculate complete RCTI with all line types", () => {
      const jobLines = [
        {
          amountExGst: 680,
          gstAmount: 68,
          amountIncGst: 748,
        },
        {
          amountExGst: 425,
          gstAmount: 42.5,
          amountIncGst: 467.5,
        },
      ];

      const breakLine = {
        amountExGst: -42.5,
        gstAmount: -4.25,
        amountIncGst: -46.75,
      };

      const eastlinkLine = {
        amountExGst: 37,
        gstAmount: 3.7,
        amountIncGst: 40.7,
      };

      const citylinkLine = {
        amountExGst: 93,
        gstAmount: 9.3,
        amountIncGst: 102.3,
      };

      const fuelLevyLine = {
        amountExGst: 55.31,
        gstAmount: 5.53,
        amountIncGst: 60.84,
      };

      const allLines = [
        ...jobLines,
        breakLine,
        eastlinkLine,
        citylinkLine,
        fuelLevyLine,
      ];

      const totals = calculateRctiTotals(allLines);

      expect(totals.subtotal).toBe(1247.81);
      expect(totals.gst).toBe(124.78);
      expect(totals.total).toBe(1372.59);
    });
  });

  describe("Edge Cases - Tolls and Fuel Levy", () => {
    it("should handle zero tolls correctly", () => {
      const totalEastlink = 0;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(0);
      expect(tollAmounts.gstAmount).toBe(0);
      expect(tollAmounts.amountIncGst).toBe(0);
    });

    it("should handle zero fuel levy percentage", () => {
      const jobLinesSubtotal = 1000;
      const fuelLevyPercentage = 0;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(0);
      expect(fuelLevyAmounts.gstAmount).toBe(0);
      expect(fuelLevyAmounts.amountIncGst).toBe(0);
    });

    it("should handle fuel levy on zero subtotal", () => {
      const jobLinesSubtotal = 0;
      const fuelLevyPercentage = 5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(0);
      expect(fuelLevyAmounts.gstAmount).toBe(0);
      expect(fuelLevyAmounts.amountIncGst).toBe(0);
    });

    it("should handle fractional toll counts with correct rounding", () => {
      const totalEastlink = 2.5;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(46.25);
      expect(tollAmounts.gstAmount).toBe(4.62);
      expect(tollAmounts.amountIncGst).toBe(50.87);
    });

    it("should calculate fuel levy on negative subtotal (after breaks)", () => {
      const jobLinesSubtotal = -100;
      const fuelLevyPercentage = 5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(-5);
      expect(fuelLevyAmounts.gstAmount).toBe(-0.5);
      expect(fuelLevyAmounts.amountIncGst).toBe(-5.5);
    });

    it("should handle very high fuel levy percentages", () => {
      const jobLinesSubtotal = 1000;
      const fuelLevyPercentage = 25;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(250);
      expect(fuelLevyAmounts.gstAmount).toBe(25);
      expect(fuelLevyAmounts.amountIncGst).toBe(275);
    });
  });

  describe("Rounding Behaviour - Tolls and Fuel Levy", () => {
    it("should apply banker's rounding to toll calculations", () => {
      const totalEastlink = 1.135;
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;

      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(tollAmounts.amountExGst).toBe(21);
      expect(tollAmounts.gstAmount).toBe(2.1);
      expect(tollAmounts.amountIncGst).toBe(23.1);
    });

    it("should apply banker's rounding to fuel levy calculations", () => {
      const jobLinesSubtotal = 333.33;
      const fuelLevyPercentage = 5;
      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyAmounts.amountExGst).toBe(16.67);
      expect(fuelLevyAmounts.gstAmount).toBe(1.67);
      expect(fuelLevyAmounts.amountIncGst).toBe(18.34);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should calculate weekly RCTI with typical toll and fuel levy usage", () => {
      const weeklyJobsSubtotal = 3400;

      const eastlinkCount = 8;
      const citylinkCount = 3;
      const fuelLevyPercentage = 5;

      const eastlinkAmount = eastlinkCount * TOLL_RATE_EASTLINK;
      const citylinkAmount = citylinkCount * TOLL_RATE_CITYLINK;
      const fuelLevyAmount = (weeklyJobsSubtotal * fuelLevyPercentage) / 100;

      const eastlinkLine = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const citylinkLine = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      const fuelLevyLine = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(eastlinkLine.amountExGst).toBe(148);
      expect(eastlinkLine.gstAmount).toBe(14.8);
      expect(eastlinkLine.amountIncGst).toBe(162.8);

      expect(citylinkLine.amountExGst).toBe(93);
      expect(citylinkLine.gstAmount).toBe(9.3);
      expect(citylinkLine.amountIncGst).toBe(102.3);

      expect(fuelLevyLine.amountExGst).toBe(170);
      expect(fuelLevyLine.gstAmount).toBe(17);
      expect(fuelLevyLine.amountIncGst).toBe(187);

      const additionalCharges = calculateRctiTotals([
        eastlinkLine,
        citylinkLine,
        fuelLevyLine,
      ]);

      expect(additionalCharges.subtotal).toBe(411);
      expect(additionalCharges.gst).toBe(41.1);
      expect(additionalCharges.total).toBe(452.1);
    });

    it("should handle subcontractor with tolls but no fuel levy", () => {
      const eastlinkCount = 12;

      const eastlinkAmount = eastlinkCount * TOLL_RATE_EASTLINK;

      const eastlinkLine = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(eastlinkLine.amountExGst).toBe(222);
      expect(eastlinkLine.gstAmount).toBe(22.2);
      expect(eastlinkLine.amountIncGst).toBe(244.2);
    });

    it("should handle contractor with fuel levy but no tolls", () => {
      const jobLinesSubtotal = 2750;
      const fuelLevyPercentage = 7.5;

      const fuelLevyAmount = (jobLinesSubtotal * fuelLevyPercentage) / 100;

      const fuelLevyLine = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: "registered",
        gstMode: "exclusive",
      });

      expect(fuelLevyLine.amountExGst).toBe(206.25);
      expect(fuelLevyLine.gstAmount).toBe(20.62);
      expect(fuelLevyLine.amountIncGst).toBe(226.87);
    });
  });
});
