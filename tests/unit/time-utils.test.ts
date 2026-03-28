import {
  convertTimeToISO,
  extractTimeFromISO,
  calculateHoursDifference,
  isValidTimeFormat,
  convertToDisplayTime,
  convertToISODateTime,
  processJobTimesForSubmission,
  processJobTimesForDisplay,
} from "@/lib/utils/time-utils";

const DATE = "2025-01-15";

// ---------------------------------------------------------------------------
// isValidTimeFormat
// ---------------------------------------------------------------------------

describe("isValidTimeFormat", () => {
  describe("accepts valid quarter-hour times", () => {
    const valid = [
      "00:00",
      "00:15",
      "00:30",
      "00:45",
      "08:00",
      "08:15",
      "08:30",
      "08:45",
      "12:00",
      "12:15",
      "12:30",
      "12:45",
      "19:00",
      "19:15",
      "19:30",
      "19:45",
      "20:00",
      "20:15",
      "20:30",
      "20:45",
      "23:00",
      "23:15",
      "23:30",
      "23:45",
    ];

    it.each(valid)("accepts %s", (t) => {
      expect(isValidTimeFormat(t)).toBe(true);
    });
  });

  describe("rejects non-quarter-hour minutes", () => {
    const nonQuarter = [
      "08:01",
      "08:10",
      "08:14",
      "08:16",
      "08:29",
      "08:31",
      "08:44",
      "08:46",
      "08:59",
      "12:37",
      "00:10",
      "23:59",
      "14:01",
    ];

    it.each(nonQuarter)("rejects %s", (t) => {
      expect(isValidTimeFormat(t)).toBe(false);
    });
  });

  describe("rejects invalid hours", () => {
    const badHours = ["24:00", "25:15", "30:30", "99:45"];

    it.each(badHours)("rejects %s", (t) => {
      expect(isValidTimeFormat(t)).toBe(false);
    });
  });

  describe("rejects single-digit hours (must be zero-padded)", () => {
    const singleDigit = ["8:00", "9:15", "0:30", "1:45"];

    it.each(singleDigit)("rejects %s", (t) => {
      expect(isValidTimeFormat(t)).toBe(false);
    });
  });

  describe("rejects malformed strings", () => {
    const malformed = [
      "",
      "abc",
      "08:0",
      "08:000",
      "08:00:00",
      "0800",
      " 08:00",
      "08:00 ",
      "  ",
    ];

    it.each(malformed)("rejects '%s'", (t) => {
      expect(isValidTimeFormat(t)).toBe(false);
    });
  });

  it("rejects null", () => {
    expect(isValidTimeFormat(null as unknown as string)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidTimeFormat(undefined as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractTimeFromISO
// ---------------------------------------------------------------------------

describe("extractTimeFromISO", () => {
  it("extracts HH:mm from a full ISO datetime string", () => {
    expect(extractTimeFromISO("2025-01-15T09:30:00.000Z")).toBe("09:30");
    expect(extractTimeFromISO("2025-01-15T14:45:00.000Z")).toBe("14:45");
    expect(extractTimeFromISO("2025-01-15T00:00:00.000Z")).toBe("00:00");
    expect(extractTimeFromISO("2025-01-15T23:45:00.000Z")).toBe("23:45");
  });

  it("does not apply timezone conversion (reads position 11-16 directly)", () => {
    expect(extractTimeFromISO("2025-01-15T06:00:00.000Z")).toBe("06:00");
    expect(extractTimeFromISO("2025-01-15T18:30:00.000Z")).toBe("18:30");
  });

  it("returns empty string for null", () => {
    expect(extractTimeFromISO(null)).toBe("");
  });

  it("returns empty string for a string shorter than 16 characters", () => {
    expect(extractTimeFromISO("2025-01-15")).toBe("");
    expect(extractTimeFromISO("09:30")).toBe("");
  });

  it("returns empty string for an empty string", () => {
    expect(extractTimeFromISO("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// convertTimeToISO
// ---------------------------------------------------------------------------

describe("convertTimeToISO", () => {
  it("returns null for null timeStr", () => {
    expect(convertTimeToISO(null, DATE)).toBeNull();
  });

  it("returns null for empty or whitespace timeStr", () => {
    expect(convertTimeToISO("", DATE)).toBeNull();
    expect(convertTimeToISO("  ", DATE)).toBeNull();
  });

  it("returns null for hours out of range", () => {
    expect(convertTimeToISO("24:00", DATE)).toBeNull();
    expect(convertTimeToISO("25:00", DATE)).toBeNull();
  });

  it("returns null for minutes out of range (> 59)", () => {
    expect(convertTimeToISO("08:60", DATE)).toBeNull();
    expect(convertTimeToISO("08:99", DATE)).toBeNull();
  });

  it("accepts non-quarter-hour minutes — unlike isValidTimeFormat", () => {
    expect(convertTimeToISO("08:37", DATE)).not.toBeNull();
    expect(convertTimeToISO("09:17", DATE)).not.toBeNull();
    expect(convertTimeToISO("14:59", DATE)).not.toBeNull();
    expect(convertTimeToISO("00:01", DATE)).not.toBeNull();
  });

  it("accepts all quarter-hour times", () => {
    expect(convertTimeToISO("08:00", DATE)).not.toBeNull();
    expect(convertTimeToISO("08:15", DATE)).not.toBeNull();
    expect(convertTimeToISO("08:30", DATE)).not.toBeNull();
    expect(convertTimeToISO("08:45", DATE)).not.toBeNull();
  });

  it("returns a parseable ISO datetime string", () => {
    const result = convertTimeToISO("09:00", DATE);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
    expect(isNaN(new Date(result!).getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateHoursDifference
// ---------------------------------------------------------------------------

describe("calculateHoursDifference", () => {
  it("returns null when any argument is missing", () => {
    expect(calculateHoursDifference(null, "17:00", DATE)).toBeNull();
    expect(calculateHoursDifference("09:00", null, DATE)).toBeNull();
    expect(calculateHoursDifference("09:00", "17:00", "")).toBeNull();
  });

  it("calculates same-day differences", () => {
    expect(calculateHoursDifference("09:00", "17:00", DATE)).toBe(8);
    expect(calculateHoursDifference("08:00", "12:00", DATE)).toBe(4);
    expect(calculateHoursDifference("08:00", "08:00", DATE)).toBe(0);
  });

  it("calculates fractional hours correctly", () => {
    expect(calculateHoursDifference("06:00", "14:30", DATE)).toBe(8.5);
    expect(calculateHoursDifference("07:00", "07:45", DATE)).toBe(0.75);
  });

  it("handles overnight shifts where finish is earlier than start", () => {
    expect(calculateHoursDifference("22:00", "06:00", DATE)).toBe(8);
    expect(calculateHoursDifference("23:00", "01:00", DATE)).toBe(2);
  });

  it("accepts non-quarter-hour times for duration calculations", () => {
    expect(calculateHoursDifference("08:37", "17:37", DATE)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// convertToDisplayTime
// ---------------------------------------------------------------------------

describe("convertToDisplayTime", () => {
  it("extracts HH:mm from an ISO datetime string", () => {
    expect(convertToDisplayTime("2025-01-15T09:30:00.000Z")).toBe("09:30");
    expect(convertToDisplayTime("2025-01-15T14:45:00.000Z")).toBe("14:45");
    expect(convertToDisplayTime("2025-01-15T00:00:00.000Z")).toBe("00:00");
  });

  it("returns an HH:MM string as-is", () => {
    expect(convertToDisplayTime("08:00")).toBe("08:00");
    expect(convertToDisplayTime("23:45")).toBe("23:45");
  });

  it("returns null for null", () => {
    expect(convertToDisplayTime(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(convertToDisplayTime(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(convertToDisplayTime("")).toBeNull();
  });

  it("returns null for a date-only string (too short for time extraction)", () => {
    expect(convertToDisplayTime("2025-01-15")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// convertToISODateTime
// ---------------------------------------------------------------------------

describe("convertToISODateTime", () => {
  it("converts quarter-hour times to deterministic ISO strings", () => {
    expect(convertToISODateTime("08:00", DATE)).toBe(
      "2025-01-15T08:00:00.000Z",
    );
    expect(convertToISODateTime("17:45", DATE)).toBe(
      "2025-01-15T17:45:00.000Z",
    );
    expect(convertToISODateTime("00:00", DATE)).toBe(
      "2025-01-15T00:00:00.000Z",
    );
    expect(convertToISODateTime("23:45", DATE)).toBe(
      "2025-01-15T23:45:00.000Z",
    );
  });

  it("returns null for non-quarter-hour times (isValidTimeFormat gate)", () => {
    expect(convertToISODateTime("08:37", DATE)).toBeNull();
    expect(convertToISODateTime("09:17", DATE)).toBeNull();
    expect(convertToISODateTime("14:59", DATE)).toBeNull();
    expect(convertToISODateTime("00:01", DATE)).toBeNull();
  });

  it("returns null for null", () => {
    expect(convertToISODateTime(null, DATE)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(convertToISODateTime(undefined, DATE)).toBeNull();
  });

  it("strips the time portion from an ISO dateString before building the result", () => {
    expect(convertToISODateTime("08:00", "2025-01-15T00:00:00.000Z")).toBe(
      "2025-01-15T08:00:00.000Z",
    );
    expect(convertToISODateTime("17:30", "2025-01-15T12:00:00.000Z")).toBe(
      "2025-01-15T17:30:00.000Z",
    );
  });
});

// ---------------------------------------------------------------------------
// processJobTimesForSubmission
// ---------------------------------------------------------------------------

describe("processJobTimesForSubmission", () => {
  it("converts quarter-hour start and finish times to ISO strings", () => {
    const result = processJobTimesForSubmission(
      { startTime: "08:00", finishTime: "17:00" },
      DATE,
    );
    expect(result.startTime).toBe("2025-01-15T08:00:00.000Z");
    expect(result.finishTime).toBe("2025-01-15T17:00:00.000Z");
  });

  it("nullifies non-quarter-hour times", () => {
    const result = processJobTimesForSubmission(
      { startTime: "08:37", finishTime: "17:23" },
      DATE,
    );
    expect(result.startTime).toBeNull();
    expect(result.finishTime).toBeNull();
  });

  it("leaves already-null times as null", () => {
    const result = processJobTimesForSubmission(
      { startTime: null, finishTime: null },
      DATE,
    );
    expect(result.startTime).toBeNull();
    expect(result.finishTime).toBeNull();
  });

  it("handles a mix of valid and invalid times", () => {
    const result = processJobTimesForSubmission(
      { startTime: "08:00", finishTime: "17:23" },
      DATE,
    );
    expect(result.startTime).toBe("2025-01-15T08:00:00.000Z");
    expect(result.finishTime).toBeNull();
  });

  it("does not mutate the original object", () => {
    const original = { startTime: "08:00", finishTime: "17:00" };
    processJobTimesForSubmission(original, DATE);
    expect(original.startTime).toBe("08:00");
    expect(original.finishTime).toBe("17:00");
  });
});

// ---------------------------------------------------------------------------
// processJobTimesForDisplay
// ---------------------------------------------------------------------------

describe("processJobTimesForDisplay", () => {
  it("converts ISO datetime strings to HH:MM for display", () => {
    const result = processJobTimesForDisplay({
      startTime: "2025-01-15T08:00:00.000Z",
      finishTime: "2025-01-15T17:00:00.000Z",
    });
    expect(result.startTime).toBe("08:00");
    expect(result.finishTime).toBe("17:00");
  });

  it("preserves HH:MM strings that are already in display format", () => {
    const result = processJobTimesForDisplay({
      startTime: "08:00",
      finishTime: "17:00",
    });
    expect(result.startTime).toBe("08:00");
    expect(result.finishTime).toBe("17:00");
  });

  it("converts null times to null", () => {
    const result = processJobTimesForDisplay({
      startTime: null,
      finishTime: null,
    });
    expect(result.startTime).toBeNull();
    expect(result.finishTime).toBeNull();
  });

  it("handles undefined time fields", () => {
    const result = processJobTimesForDisplay(
      {} as { startTime?: string | null; finishTime?: string | null },
    );
    expect(result.startTime).toBeNull();
    expect(result.finishTime).toBeNull();
  });

  it("does not mutate the original object", () => {
    const original = {
      startTime: "2025-01-15T08:00:00.000Z",
      finishTime: "2025-01-15T17:00:00.000Z",
    };
    processJobTimesForDisplay(original);
    expect(original.startTime).toBe("2025-01-15T08:00:00.000Z");
    expect(original.finishTime).toBe("2025-01-15T17:00:00.000Z");
  });
});
