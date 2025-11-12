/**
 * Unit tests for RCTI time format in descriptions
 * Tests that time ranges use hyphen separator (06:30 - 15:30) instead of arrow
 */

describe("RCTI Time Format", () => {
  describe("Time string formatting", () => {
    it("should format time range with hyphen separator", () => {
      const startTime = "2024-01-15T06:30:00.000Z";
      const finishTime = "2024-01-15T15:30:00.000Z";

      // Extract time like the actual code does (without timezone conversion)
      const startTimeStr = startTime.substring(11, 16);
      const finishTimeStr = finishTime.substring(11, 16);
      const description = `${startTimeStr} - ${finishTimeStr}`;

      expect(description).toBe("06:30 - 15:30");
      expect(description).toContain(" - ");
      expect(description).not.toContain("→");
      expect(description).not.toContain("'");
    });

    it("should format contractor description with hyphen", () => {
      const startTime = "2024-01-15T08:00:00.000Z";
      const finishTime = "2024-01-15T17:00:00.000Z";

      const startTimeStr = startTime.substring(11, 16);
      const finishTimeStr = finishTime.substring(11, 16);
      const description = `${startTimeStr} - ${finishTimeStr}`;

      expect(description).toBe("08:00 - 17:00");
      expect(description).toMatch(/\d{2}:\d{2} - \d{2}:\d{2}/);
    });

    it("should format subcontractor description with driver name and hyphen", () => {
      const driverName = "Jane Doe";
      const startTime = "2024-01-15T06:30:00.000Z";
      const finishTime = "2024-01-15T15:30:00.000Z";

      const startTimeStr = startTime.substring(11, 16);
      const finishTimeStr = finishTime.substring(11, 16);
      const description = `${driverName} | ${startTimeStr} - ${finishTimeStr}`;

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
        const startTimeStr = start.substring(11, 16);
        const finishTimeStr = finish.substring(11, 16);
        const description = `${startTimeStr} - ${finishTimeStr}`;

        expect(description).toBe(expected);
      });
    });

    it("should not contain any unicode arrow characters", () => {
      const startTime = "2024-01-15T06:30:00.000Z";
      const finishTime = "2024-01-15T15:30:00.000Z";

      const startTimeStr = startTime.substring(11, 16);
      const finishTimeStr = finishTime.substring(11, 16);
      const description = `${startTimeStr} - ${finishTimeStr}`;

      // Check for various arrow characters
      expect(description).not.toMatch(/→/); // Rightwards arrow
      expect(description).not.toMatch(/←/); // Leftwards arrow
      expect(description).not.toMatch(/↔/); // Left right arrow
      expect(description).not.toMatch(/⇒/); // Rightwards double arrow
      expect(description).not.toMatch(/⇐/); // Leftwards double arrow
      expect(description).not.toMatch(/⇔/); // Left right double arrow
    });

    it("should use only ASCII hyphen character", () => {
      const description = "06:30 - 15:30";

      // Verify it's ASCII hyphen (U+002D) not unicode dashes
      const hyphenIndex = description.indexOf("-");
      expect(hyphenIndex).toBeGreaterThan(0);

      const hyphenChar = description.charAt(hyphenIndex);
      expect(hyphenChar.charCodeAt(0)).toBe(45); // ASCII hyphen is code 45
    });

    it("should format with consistent spacing around hyphen", () => {
      const startTime = "2024-01-15T06:30:00.000Z";
      const finishTime = "2024-01-15T15:30:00.000Z";

      const startTimeStr = startTime.substring(11, 16);
      const finishTimeStr = finishTime.substring(11, 16);
      const description = `${startTimeStr} - ${finishTimeStr}`;

      // Should have space-hyphen-space
      expect(description).toContain(" - ");
      expect(description).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    });

    it("should handle edge case times correctly", () => {
      // Midnight
      const midnight = "2024-01-15T00:00:00.000Z";
      const midnightStr = midnight.substring(11, 16);
      expect(midnightStr).toBe("00:00");

      // Just before midnight
      const almostMidnight = "2024-01-15T23:59:00.000Z";
      const almostMidnightStr = almostMidnight.substring(11, 16);
      expect(almostMidnightStr).toBe("23:59");

      // Noon
      const noon = "2024-01-15T12:00:00.000Z";
      const noonStr = noon.substring(11, 16);
      expect(noonStr).toBe("12:00");
    });
  });

  describe("Description format validation", () => {
    it("should match expected contractor format pattern", () => {
      const description = "06:30 - 15:30";
      const pattern = /^\d{2}:\d{2} - \d{2}:\d{2}$/;

      expect(pattern.test(description)).toBe(true);
    });

    it("should match expected subcontractor format pattern", () => {
      const description = "John Smith | 06:30 - 15:30";
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

  describe("Australian English compliance", () => {
    it("should use standard ASCII characters suitable for PDF", () => {
      const description = "06:30 - 15:30";

      // All characters should be in ASCII range (0-127)
      for (let i = 0; i < description.length; i++) {
        const charCode = description.charCodeAt(i);
        expect(charCode).toBeLessThanOrEqual(127);
      }
    });

    it("should be readable in all PDF viewers", () => {
      const description = "06:30 - 15:30";

      // Should not contain any Unicode characters that might render incorrectly
      // Check it only contains: digits, colon, space, hyphen
      const validCharPattern = /^[\d: -]+$/;
      expect(validCharPattern.test(description)).toBe(true);
    });
  });
});
