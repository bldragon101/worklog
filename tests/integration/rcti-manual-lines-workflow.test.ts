/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";

describe("RCTI Manual Lines Workflow Integration", () => {
  let testDriverId: number;
  let testRctiId: number;

  beforeAll(async () => {
    // Create a test driver
    const driver = await prisma.driver.create({
      data: {
        driver: "Test Manual Lines Driver",
        truck: "Test Truck",
        type: "Contractor",
        tray: 50,
        crane: 60,
        semi: 70,
        semiCrane: 80,
        abn: "12345678901",
        address: "123 Test St",
        bankAccountName: "Test Account",
        bankBsb: "123-456",
        bankAccountNumber: "12345678",
        gstStatus: "registered",
      },
    });
    testDriverId = driver.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testRctiId) {
      await prisma.rcti.delete({ where: { id: testRctiId } }).catch(() => {});
    }
    if (testDriverId) {
      await prisma.driver
        .delete({ where: { id: testDriverId } })
        .catch(() => {});
    }
  });

  describe("Manual Line Entry Workflow", () => {
    it("should create RCTI and add manual lines with correct calculations", async () => {
      // Step 1: Create a draft RCTI
      const rcti = await prisma.rcti.create({
        data: {
          driverId: testDriverId,
          driverName: "Test Manual Lines Driver",
          gstStatus: "registered",
          gstMode: "exclusive",
          weekEnding: new Date("2024-11-10"),
          invoiceNumber: `RCTI-TEST-${Date.now()}`,
          status: "draft",
          subtotal: 0,
          gst: 0,
          total: 0,
        },
      });
      testRctiId = rcti.id;

      expect(rcti.status).toBe("draft");
      expect(rcti.subtotal).toBe(0);

      // Step 2: Add first manual line
      const line1 = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: null, // Manual entry
          jobDate: new Date("2024-11-04"),
          customer: "ABC Transport",
          truckType: "10T Crane",
          description: "Manual delivery job",
          chargedHours: 8.5,
          ratePerHour: 85.0,
          amountExGst: 722.5,
          gstAmount: 72.25,
          amountIncGst: 794.75,
        },
      });

      expect(line1.jobId).toBeNull();
      expect(line1.amountExGst).toBe(722.5);
      expect(line1.gstAmount).toBe(72.25);
      expect(line1.amountIncGst).toBe(794.75);

      // Step 3: Add second manual line
      const line2 = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: null, // Manual entry
          jobDate: new Date("2024-11-05"),
          customer: "XYZ Logistics",
          truckType: "Tray",
          description: "Another manual job",
          chargedHours: 6.0,
          ratePerHour: 50.0,
          amountExGst: 300.0,
          gstAmount: 30.0,
          amountIncGst: 330.0,
        },
      });

      expect(line2.jobId).toBeNull();

      // Step 4: Recalculate RCTI totals
      const lines = await prisma.rctiLine.findMany({
        where: { rctiId: testRctiId },
      });

      const subtotal = lines.reduce((sum, line) => sum + line.amountExGst, 0);
      const gst = lines.reduce((sum, line) => sum + line.gstAmount, 0);
      const total = lines.reduce((sum, line) => sum + line.amountIncGst, 0);

      const updatedRcti = await prisma.rcti.update({
        where: { id: testRctiId },
        data: { subtotal, gst, total },
      });

      expect(updatedRcti.subtotal).toBe(1022.5); // 722.5 + 300
      expect(updatedRcti.gst).toBe(102.25); // 72.25 + 30
      expect(updatedRcti.total).toBe(1124.75); // 794.75 + 330

      // Step 5: Verify we can fetch RCTI with lines
      const rctiWithLines = await prisma.rcti.findUnique({
        where: { id: testRctiId },
        include: { lines: true },
      });

      expect(rctiWithLines?.lines).toHaveLength(2);
      expect(rctiWithLines?.lines.every((l) => l.jobId === null)).toBe(true);
    });

    it("should allow removing manual lines and recalculate totals", async () => {
      // Get current lines
      const linesBefore = await prisma.rctiLine.findMany({
        where: { rctiId: testRctiId },
      });

      expect(linesBefore.length).toBeGreaterThan(0);

      // Remove first line
      const lineToRemove = linesBefore[0];
      await prisma.rctiLine.delete({
        where: { id: lineToRemove.id },
      });

      // Recalculate totals
      const remainingLines = await prisma.rctiLine.findMany({
        where: { rctiId: testRctiId },
      });

      const subtotal = remainingLines.reduce(
        (sum, line) => sum + line.amountExGst,
        0,
      );
      const gst = remainingLines.reduce((sum, line) => sum + line.gstAmount, 0);
      const total = remainingLines.reduce(
        (sum, line) => sum + line.amountIncGst,
        0,
      );

      const updatedRcti = await prisma.rcti.update({
        where: { id: testRctiId },
        data: { subtotal, gst, total },
      });

      expect(remainingLines).toHaveLength(linesBefore.length - 1);
      expect(updatedRcti.subtotal).toBeLessThan(1022.5);
      expect(updatedRcti.gst).toBeLessThan(102.25);
      expect(updatedRcti.total).toBeLessThan(1124.75);
    });

    it("should handle manual lines with no GST correctly", async () => {
      // Create a non-GST registered RCTI
      const noGstRcti = await prisma.rcti.create({
        data: {
          driverId: testDriverId,
          driverName: "Test Manual Lines Driver",
          gstStatus: "not_registered",
          gstMode: "exclusive",
          weekEnding: new Date("2024-11-17"),
          invoiceNumber: `RCTI-TEST-NOGST-${Date.now()}`,
          status: "draft",
          subtotal: 0,
          gst: 0,
          total: 0,
        },
      });

      // Add manual line with no GST
      const noGstLine = await prisma.rctiLine.create({
        data: {
          rctiId: noGstRcti.id,
          jobId: null,
          jobDate: new Date("2024-11-15"),
          customer: "No GST Customer",
          truckType: "Tray",
          description: "No GST job",
          chargedHours: 10.0,
          ratePerHour: 50.0,
          amountExGst: 500.0,
          gstAmount: 0.0,
          amountIncGst: 500.0,
        },
      });

      expect(noGstLine.gstAmount).toBe(0);
      expect(noGstLine.amountExGst).toBe(noGstLine.amountIncGst);

      // Update RCTI totals
      const updatedNoGstRcti = await prisma.rcti.update({
        where: { id: noGstRcti.id },
        data: {
          subtotal: 500.0,
          gst: 0.0,
          total: 500.0,
        },
      });

      expect(updatedNoGstRcti.gst).toBe(0);
      expect(updatedNoGstRcti.subtotal).toBe(updatedNoGstRcti.total);

      // Clean up
      await prisma.rcti.delete({ where: { id: noGstRcti.id } });
    });

    it("should allow mixing manual and imported job lines", async () => {
      // Create a job
      const job = await prisma.jobs.create({
        data: {
          date: new Date("2024-11-06"),
          driver: "Test Manual Lines Driver",
          customer: "Imported Job Customer",
          billTo: "Imported Job Customer",
          truckType: "10T Crane",
          comments: "This is an imported job",
          chargedHours: 7.0,
          driverCharge: 60.0,
          pickup: "Test Pickup Location",
          registration: "TEST123",
        },
      });

      // Add imported job line to RCTI
      const importedLine = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: job.id, // Linked to job
          jobDate: new Date(job.date),
          customer: job.customer,
          truckType: job.truckType,
          description: job.comments,
          chargedHours: job.chargedHours || 0,
          ratePerHour: job.driverCharge || 0,
          amountExGst: 420.0, // 7 * 60
          gstAmount: 42.0,
          amountIncGst: 462.0,
        },
      });

      expect(importedLine.jobId).toBe(job.id);

      // Add manual line to same RCTI
      const manualLine = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: null, // Manual entry
          jobDate: new Date("2024-11-07"),
          customer: "Manual Entry Customer",
          truckType: "Tray",
          description: "Manual entry",
          chargedHours: 5.0,
          ratePerHour: 45.0,
          amountExGst: 225.0,
          gstAmount: 22.5,
          amountIncGst: 247.5,
        },
      });

      expect(manualLine.jobId).toBeNull();

      // Verify both lines exist in RCTI
      const allLines = await prisma.rctiLine.findMany({
        where: { rctiId: testRctiId },
      });

      const manualLines = allLines.filter((l) => l.jobId === null);
      const importedLines = allLines.filter((l) => l.jobId !== null);

      expect(manualLines.length).toBeGreaterThan(0);
      expect(importedLines.length).toBeGreaterThan(0);

      // Clean up
      await prisma.jobs.delete({ where: { id: job.id } });
    });

    it("should prevent adding lines to finalised RCTI", async () => {
      // Finalise the RCTI
      await prisma.rcti.update({
        where: { id: testRctiId },
        data: { status: "finalised" },
      });

      // Attempt to add a manual line should fail in real API
      // Here we just verify the status
      const finalisedRcti = await prisma.rcti.findUnique({
        where: { id: testRctiId },
      });

      expect(finalisedRcti?.status).toBe("finalised");

      // In real API, this would be rejected by the endpoint
      // We're just testing the database state here

      // Reset to draft for cleanup
      await prisma.rcti.update({
        where: { id: testRctiId },
        data: { status: "draft" },
      });
    });

    it("should handle decimal hours and rates correctly", async () => {
      // Create test RCTI
      const decimalRcti = await prisma.rcti.create({
        data: {
          driverId: testDriverId,
          driverName: "Test Manual Lines Driver",
          gstStatus: "registered",
          gstMode: "exclusive",
          weekEnding: new Date("2024-11-24"),
          invoiceNumber: `RCTI-DECIMAL-${Date.now()}`,
          status: "draft",
          subtotal: 0,
          gst: 0,
          total: 0,
        },
      });

      // Add line with decimal values
      const decimalLine = await prisma.rctiLine.create({
        data: {
          rctiId: decimalRcti.id,
          jobId: null,
          jobDate: new Date("2024-11-20"),
          customer: "Decimal Test",
          truckType: "10T Crane",
          description: "Testing decimals",
          chargedHours: 7.75,
          ratePerHour: 62.5,
          amountExGst: 484.375, // 7.75 * 62.50
          gstAmount: 48.4375, // 10% of 484.375
          amountIncGst: 532.8125, // 484.375 + 48.4375
        },
      });

      expect(decimalLine.chargedHours).toBe(7.75);
      expect(decimalLine.ratePerHour).toBe(62.5);

      // Clean up
      await prisma.rcti.delete({ where: { id: decimalRcti.id } });
    });

    it("should cascade delete lines when RCTI is deleted", async () => {
      // Create temporary RCTI with lines
      const tempRcti = await prisma.rcti.create({
        data: {
          driverId: testDriverId,
          driverName: "Test Manual Lines Driver",
          gstStatus: "registered",
          gstMode: "exclusive",
          weekEnding: new Date("2024-11-30"),
          invoiceNumber: `RCTI-CASCADE-${Date.now()}`,
          status: "draft",
          subtotal: 0,
          gst: 0,
          total: 0,
        },
      });

      const tempLine = await prisma.rctiLine.create({
        data: {
          rctiId: tempRcti.id,
          jobId: null,
          jobDate: new Date("2024-11-25"),
          customer: "Cascade Test",
          truckType: "Tray",
          description: "Testing cascade delete",
          chargedHours: 5.0,
          ratePerHour: 50.0,
          amountExGst: 250.0,
          gstAmount: 25.0,
          amountIncGst: 275.0,
        },
      });

      const lineId = tempLine.id;

      // Delete RCTI
      await prisma.rcti.delete({ where: { id: tempRcti.id } });

      // Verify line was also deleted
      const deletedLine = await prisma.rctiLine.findUnique({
        where: { id: lineId },
      });

      expect(deletedLine).toBeNull();
    });
  });

  describe("Manual Line Data Integrity", () => {
    it("should preserve description as null when not provided", async () => {
      const line = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: null,
          jobDate: new Date("2024-11-10"),
          customer: "No Description Customer",
          truckType: "Tray",
          description: null,
          chargedHours: 4.0,
          ratePerHour: 50.0,
          amountExGst: 200.0,
          gstAmount: 20.0,
          amountIncGst: 220.0,
        },
      });

      expect(line.description).toBeNull();

      // Clean up
      await prisma.rctiLine.delete({ where: { id: line.id } });
    });

    it("should handle empty string description", async () => {
      const line = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: null,
          jobDate: new Date("2024-11-11"),
          customer: "Empty Description Customer",
          truckType: "Tray",
          description: "",
          chargedHours: 3.0,
          ratePerHour: 50.0,
          amountExGst: 150.0,
          gstAmount: 15.0,
          amountIncGst: 165.0,
        },
      });

      expect(line.description).toBe("");

      // Clean up
      await prisma.rctiLine.delete({ where: { id: line.id } });
    });

    it("should handle zero hours or rate", async () => {
      const zeroLine = await prisma.rctiLine.create({
        data: {
          rctiId: testRctiId,
          jobId: null,
          jobDate: new Date("2024-11-12"),
          customer: "Zero Test",
          truckType: "Tray",
          description: "Testing zero values",
          chargedHours: 0,
          ratePerHour: 50.0,
          amountExGst: 0,
          gstAmount: 0,
          amountIncGst: 0,
        },
      });

      expect(zeroLine.chargedHours).toBe(0);
      expect(zeroLine.amountExGst).toBe(0);

      // Clean up
      await prisma.rctiLine.delete({ where: { id: zeroLine.id } });
    });
  });
});
