/**
 * Unit tests for RCTI time format in descriptions
 * Tests that time ranges use hyphen separator (06:30 - 15:30) instead of arrow
 */

import {
  formatTimeFromIso,
  buildRctiLineDescription,
} from "@/lib/utils/rcti-calculations";

describe("RCTI Time Format", () => {
  describe("Time string formatting", () => {
    it("should format time range with hyphen separator", () => {
      const startTime = "2024-01-15T06:30:00.000Z";
      const finishTime = "2024-01-15T15:30:00.000Z";

      const startTimeStr = formatTimeFromIso({ isoString: startTime });
      const finishTimeStr = formatTimeFromIso({ isoString: finishTime });
      const description = `${startTimeStr} - ${finishTimeStr}`;

      expect(description).toBe("06:30 - 15:30");
      expect(description).toContain(" - ");
      expect(description).not.toContain("→");
      expect(description).not.toContain("'");
    });

    it("should format contractor description with hyphen", () => {
      const job = {
        driver: "John Smith",
        startTime: "2024-01-15T08:00:00.000Z",
        finishTime: "2024-01-15T17:00:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });

      expect(description).toBe("08:00 - 17:00");
      expect(description).toMatch(/\d{2}:\d{2} - \d{2}:\d{2}/);
    });

    it("should format subcontractor description with driver name and hyphen", () => {
      const job = {
        driver: "Jane Doe",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Subcontractor" };

      const description = buildRctiLineDescription({ job, driver });

      expect(description).toBe("Jane Doe | 06:30 - 15:30");
      expect(description).toContain(" | ");
      expect(description).toContain(" - ");
      expect(description).not.toContain("→");
    });

    it("should handle various time ranges", () => {
      const testCases = [
        {
          start: "2024-01-15T00:00:00.000Z",
          finish: "2024-01-15T23:59:00.000Z",
          expected: "00:00 - 23:59",
        },
        {
          start: "2024-01-15T09:15:00.000Z",
          finish: "2024-01-15T17:45:00.000Z",
          expected: "09:15 - 17:45",
        },
        {
          start: "2024-01-15T12:00:00.000Z",
          finish: "2024-01-15T20:30:00.000Z",
          expected: "12:00 - 20:30",
        },
      ];

      testCases.forEach(({ start, finish, expected }) => {
        const job = {
          driver: "Test Driver",
          startTime: start,
          finishTime: finish,
          jobReference: null,
          comments: null,
        };
        const driver = { type: "Contractor" };

        const description = buildRctiLineDescription({ job, driver });

        expect(description).toBe(expected);
      });
    });

    it("should not contain any unicode arrow characters", () => {
      const job = {
        driver: "Test Driver",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });

      // Check for various arrow characters
      expect(description).not.toMatch(/→/); // Rightwards arrow
      expect(description).not.toMatch(/←/); // Leftwards arrow
      expect(description).not.toMatch(/↔/); // Left right arrow
      expect(description).not.toMatch(/⇒/); // Rightwards double arrow
      expect(description).not.toMatch(/⇐/); // Leftwards double arrow
      expect(description).not.toMatch(/⇔/); // Left right double arrow
    });

    it("should use only ASCII hyphen character", () => {
      const job = {
        driver: "Test Driver",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });

      // Verify it's ASCII hyphen (U+002D) not unicode dashes
      const hyphenIndex = description.indexOf("-");
      expect(hyphenIndex).toBeGreaterThan(0);

      const hyphenChar = description.charAt(hyphenIndex);
      expect(hyphenChar.charCodeAt(0)).toBe(45); // ASCII hyphen is code 45
    });

    it("should format with consistent spacing around hyphen", () => {
      const job = {
        driver: "Test Driver",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });

      // Should have space-hyphen-space
      expect(description).toContain(" - ");
      expect(description).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    });

    it("should handle edge case times correctly", () => {
      // Midnight
      const midnight = "2024-01-15T00:00:00.000Z";
      const midnightStr = formatTimeFromIso({ isoString: midnight });
      expect(midnightStr).toBe("00:00");

      // Just before midnight
      const almostMidnight = "2024-01-15T23:59:00.000Z";
      const almostMidnightStr = formatTimeFromIso({
        isoString: almostMidnight,
      });
      expect(almostMidnightStr).toBe("23:59");

      // Noon
      const noon = "2024-01-15T12:00:00.000Z";
      const noonStr = formatTimeFromIso({ isoString: noon });
      expect(noonStr).toBe("12:00");
    });
  });

  describe("Description format validation", () => {
    it("should match expected contractor format pattern", () => {
      const job = {
        driver: "Test Driver",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });
      const pattern = /^\d{2}:\d{2} - \d{2}:\d{2}$/;

      expect(pattern.test(description)).toBe(true);
    });

    it("should match expected subcontractor format pattern", () => {
      const job = {
        driver: "John Smith",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Subcontractor" };

      const description = buildRctiLineDescription({ job, driver });
      const pattern = /^.+ \| \d{2}:\d{2} - \d{2}:\d{2}$/;

      expect(pattern.test(description)).toBe(true);
    });

    it("should reject arrow character in description", () => {
      const badDescription = "06:30 → 15:30";
      const pattern = /^\d{2}:\d{2} - \d{2}:\d{2}$/;

      expect(pattern.test(badDescription)).toBe(false);
    });

    it("should accept hyphen in description", () => {
      const goodDescription = "06:30 - 15:30";
      const pattern = /^\d{2}:\d{2} - \d{2}:\d{2}$/;

      expect(pattern.test(goodDescription)).toBe(true);
    });
  });

  describe("Helper function tests", () => {
    describe("formatTimeFromIso", () => {
      it("should format ISO string to HH:mm", () => {
        const result = formatTimeFromIso({
          isoString: "2024-01-15T14:30:00.000Z",
        });
        expect(result).toBe("14:30");
      });

      it("should handle Date objects", () => {
        const date = new Date("2024-01-15T09:45:00.000Z");
        const result = formatTimeFromIso({ isoString: date });
        expect(result).toBe("09:45");
      });

      it("should return empty string for null", () => {
        const result = formatTimeFromIso({ isoString: null });
        expect(result).toBe("");
      });

      it("should handle midnight correctly", () => {
        const result = formatTimeFromIso({
          isoString: "2024-01-15T00:00:00.000Z",
        });
        expect(result).toBe("00:00");
      });

      it("should handle end of day correctly", () => {
        const result = formatTimeFromIso({
          isoString: "2024-01-15T23:59:59.999Z",
        });
        expect(result).toBe("23:59");
      });
    });

    describe("buildRctiLineDescription", () => {
      it("should build contractor description with times", () => {
        const job = {
          driver: "John Smith",
          startTime: "2024-01-15T08:00:00.000Z",
          finishTime: "2024-01-15T17:00:00.000Z",
          jobReference: null,
          comments: null,
        };
        const driver = { type: "Contractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("08:00 - 17:00");
      });

      it("should build subcontractor description with driver name and times", () => {
        const job = {
          driver: "Jane Doe",
          startTime: "2024-01-15T06:30:00.000Z",
          finishTime: "2024-01-15T15:30:00.000Z",
          jobReference: null,
          comments: null,
        };
        const driver = { type: "Subcontractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("Jane Doe | 06:30 - 15:30");
      });

      it("should fall back to jobReference when no times provided", () => {
        const job = {
          driver: "John Smith",
          startTime: null,
          finishTime: null,
          jobReference: "REF-12345",
          comments: null,
        };
        const driver = { type: "Contractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("REF-12345");
      });

      it("should fall back to comments when no times or jobReference", () => {
        const job = {
          driver: "John Smith",
          startTime: null,
          finishTime: null,
          jobReference: null,
          comments: "Special delivery",
        };
        const driver = { type: "Contractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("Special delivery");
      });

      it("should include subcontractor driver name with jobReference", () => {
        const job = {
          driver: "Jane Doe",
          startTime: null,
          finishTime: null,
          jobReference: "REF-12345",
          comments: null,
        };
        const driver = { type: "Subcontractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("Jane Doe | REF-12345");
      });

      it("should include subcontractor driver name with comments", () => {
        const job = {
          driver: "Jane Doe",
          startTime: null,
          finishTime: null,
          jobReference: null,
          comments: "Urgent delivery",
        };
        const driver = { type: "Subcontractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("Jane Doe | Urgent delivery");
      });

      it("should return only subcontractor driver name when no other details", () => {
        const job = {
          driver: "Jane Doe",
          startTime: null,
          finishTime: null,
          jobReference: null,
          comments: null,
        };
        const driver = { type: "Subcontractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("Jane Doe");
      });

      it("should return empty string for contractor with no details", () => {
        const job = {
          driver: "John Smith",
          startTime: null,
          finishTime: null,
          jobReference: null,
          comments: null,
        };
        const driver = { type: "Contractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("");
      });

      it("should prefer jobReference over comments", () => {
        const job = {
          driver: "John Smith",
          startTime: null,
          finishTime: null,
          jobReference: "REF-12345",
          comments: "Some comments",
        };
        const driver = { type: "Contractor" };

        const result = buildRctiLineDescription({ job, driver });
        expect(result).toBe("REF-12345");
      });
    });
  });

  describe("Australian English compliance", () => {
    it("should use standard ASCII characters suitable for PDF", () => {
      const job = {
        driver: "Test Driver",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });

      // All characters should be in ASCII range (0-127)
      for (let i = 0; i < description.length; i++) {
        const charCode = description.charCodeAt(i);
        expect(charCode).toBeLessThanOrEqual(127);
      }
    });

    it("should be readable in all PDF viewers", () => {
      const job = {
        driver: "Test Driver",
        startTime: "2024-01-15T06:30:00.000Z",
        finishTime: "2024-01-15T15:30:00.000Z",
        jobReference: null,
        comments: null,
      };
      const driver = { type: "Contractor" };

      const description = buildRctiLineDescription({ job, driver });

      // Should not contain any Unicode characters that might render incorrectly
      // Check it only contains: digits, colon, space, hyphen
      const validCharPattern = /^[\d: -]+$/;
      expect(validCharPattern.test(description)).toBe(true);
    });
  });
});
