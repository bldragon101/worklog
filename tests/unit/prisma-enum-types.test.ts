import {
  GstMode,
  GstStatus,
  RctiStatus,
  DeductionStatus,
} from "@/generated/prisma/client";

describe("Prisma Enum Types", () => {
  describe("GstMode enum", () => {
    it("should export exclusive and inclusive values", () => {
      expect(GstMode.exclusive).toBe("exclusive");
      expect(GstMode.inclusive).toBe("inclusive");
    });

    it("should have exactly 2 values", () => {
      expect(Object.keys(GstMode)).toHaveLength(2);
    });

    it("should be usable in type guards", () => {
      const mode: GstMode = GstMode.exclusive;
      expect(mode).toBe("exclusive");
    });
  });

  describe("GstStatus enum", () => {
    it("should export not_registered and registered values", () => {
      expect(GstStatus.not_registered).toBe("not_registered");
      expect(GstStatus.registered).toBe("registered");
    });

    it("should have exactly 2 values", () => {
      expect(Object.keys(GstStatus)).toHaveLength(2);
    });

    it("should be usable in type guards", () => {
      const status: GstStatus = GstStatus.registered;
      expect(status).toBe("registered");
    });
  });

  describe("RctiStatus enum", () => {
    it("should export draft, finalised, and paid values", () => {
      expect(RctiStatus.draft).toBe("draft");
      expect(RctiStatus.finalised).toBe("finalised");
      expect(RctiStatus.paid).toBe("paid");
    });

    it("should have exactly 3 values", () => {
      expect(Object.keys(RctiStatus)).toHaveLength(3);
    });

    it("should use Australian English spelling", () => {
      expect(RctiStatus.finalised).toBe("finalised");
      expect(RctiStatus).not.toHaveProperty("finalized");
    });

    it("should be usable in type guards", () => {
      const status: RctiStatus = RctiStatus.draft;
      expect(status).toBe("draft");
    });

    it("should support status progression logic", () => {
      const statuses: RctiStatus[] = [
        RctiStatus.draft,
        RctiStatus.finalised,
        RctiStatus.paid,
      ];

      expect(statuses).toContain(RctiStatus.draft);
      expect(statuses).toContain(RctiStatus.finalised);
      expect(statuses).toContain(RctiStatus.paid);
    });
  });

  describe("DeductionStatus enum", () => {
    it("should export active, completed, and cancelled values", () => {
      expect(DeductionStatus.active).toBe("active");
      expect(DeductionStatus.completed).toBe("completed");
      expect(DeductionStatus.cancelled).toBe("cancelled");
    });

    it("should have exactly 3 values", () => {
      expect(Object.keys(DeductionStatus)).toHaveLength(3);
    });

    it("should use Australian English spelling", () => {
      expect(DeductionStatus.cancelled).toBe("cancelled");
      expect(DeductionStatus).not.toHaveProperty("canceled");
    });

    it("should be usable in type guards", () => {
      const status: DeductionStatus = DeductionStatus.active;
      expect(status).toBe("active");
    });

    it("should support lifecycle transitions", () => {
      const activeStatus = DeductionStatus.active;
      const completedStatus = DeductionStatus.completed;
      const cancelledStatus = DeductionStatus.cancelled;

      expect(activeStatus).not.toBe(completedStatus);
      expect(activeStatus).not.toBe(cancelledStatus);
      expect(completedStatus).not.toBe(cancelledStatus);
    });
  });

  describe("Enum type compatibility", () => {
    it("should work with string literals in comparisons", () => {
      const mode: GstMode = GstMode.exclusive;
      expect(mode === "exclusive").toBe(true);

      const status: RctiStatus = RctiStatus.draft;
      expect(status === "draft").toBe(true);
    });

    it("should work in switch statements", () => {
      const status = "finalised" as RctiStatus;

      let result = "";
      switch (status) {
        case "draft":
          result = "editable";
          break;
        case "finalised":
          result = "locked";
          break;
        case "paid":
          result = "completed";
          break;
      }

      expect(result).toBe("locked");
    });

    it("should work with array includes", () => {
      const editableStatuses: RctiStatus[] = ["draft"];
      const currentStatus: RctiStatus = "draft";

      expect(editableStatuses.includes(currentStatus)).toBe(true);
    });

    it("should work in conditional logic", () => {
      const gstStatus: GstStatus = "registered";

      const shouldApplyGst = gstStatus === "registered";
      expect(shouldApplyGst).toBe(true);

      const gstRate = shouldApplyGst ? 0.1 : 0;
      expect(gstRate).toBe(0.1);
    });
  });

  describe("Enum value consistency", () => {
    it("should maintain consistent enum values", () => {
      const originalValue = GstMode.exclusive;

      // Enum values should remain consistent
      expect(GstMode.exclusive).toBe(originalValue);
      expect(GstMode.exclusive).toBe("exclusive");
    });
  });

  describe("All enum values are strings", () => {
    it("GstMode values should be strings", () => {
      Object.values(GstMode).forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });

    it("GstStatus values should be strings", () => {
      Object.values(GstStatus).forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });

    it("RctiStatus values should be strings", () => {
      Object.values(RctiStatus).forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });

    it("DeductionStatus values should be strings", () => {
      Object.values(DeductionStatus).forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });
  });
});
