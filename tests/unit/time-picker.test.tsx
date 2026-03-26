import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { TimePicker } from "@/components/ui/time-picker";

// The scroll useEffect fires a 50 ms timer; use fake timers to keep tests clean
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runAllTimers();
  });
  jest.useRealTimers();
});

function openDialog({
  value,
  onChange,
}: {
  value: string;
  onChange?: jest.Mock;
}) {
  render(<TimePicker value={value} onChange={onChange} />);
  // Before the dialog opens there is only one button — the trigger
  fireEvent.click(screen.getByRole("button"));
  act(() => {
    jest.runAllTimers();
  });
  return screen.getByRole("dialog");
}

// ---------------------------------------------------------------------------
// Trigger button
// ---------------------------------------------------------------------------

describe("TimePicker trigger button", () => {
  it("renders the placeholder when no value is given", () => {
    render(<TimePicker />);
    expect(screen.getByRole("button")).toHaveTextContent("Select time");
  });

  it("renders the custom placeholder when provided", () => {
    render(<TimePicker placeholder="Pick a time" />);
    expect(screen.getByRole("button")).toHaveTextContent("Pick a time");
  });

  it("renders the raw value string on the trigger button", () => {
    render(<TimePicker value="14:30" />);
    expect(screen.getByRole("button")).toHaveTextContent("14:30");
  });

  it("is disabled when the disabled prop is set", () => {
    render(<TimePicker disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Dialog time preview — rounding behaviour (exercises roundToQuarter)
//
// Rounding boundaries (Math.round(m / 15) * 15):
//   m =  0..7  → 0    (round down to 00)
//   m =  8..22 → 15   (round up   to 15)
//   m = 23..37 → 30   (round to   30)
//   m = 38..52 → 45   (round to   45)
//   m = 53..59 → 60   → carryHour=true, minutes="00", hour increments
// ---------------------------------------------------------------------------

describe("TimePicker dialog preview — quarter-hour rounding", () => {
  it("shows an exact quarter-hour value unchanged", () => {
    const dialog = openDialog({ value: "08:00" });
    expect(within(dialog).getByText("08:00")).toBeInTheDocument();
  });

  it("shows 08:45 unchanged", () => {
    const dialog = openDialog({ value: "08:45" });
    expect(within(dialog).getByText("08:45")).toBeInTheDocument();
  });

  it("rounds minutes down when below the midpoint (07 → 00)", () => {
    // Math.round(7/15)*15 = 0 → "08:00"
    const dialog = openDialog({ value: "08:07" });
    expect(within(dialog).getByText("08:00")).toBeInTheDocument();
  });

  it("rounds minutes up when above the midpoint (08 → 15)", () => {
    // Math.round(8/15)*15 = 15 → "08:15"
    const dialog = openDialog({ value: "08:08" });
    expect(within(dialog).getByText("08:15")).toBeInTheDocument();
  });

  it("rounds to 30 from below (22 → 15)", () => {
    // Math.round(22/15)*15 = 15 → "08:15"
    const dialog = openDialog({ value: "08:22" });
    expect(within(dialog).getByText("08:15")).toBeInTheDocument();
  });

  it("rounds to 30 from above (23 → 30)", () => {
    // Math.round(23/15)*15 = 30 → "08:30"
    const dialog = openDialog({ value: "08:23" });
    expect(within(dialog).getByText("08:30")).toBeInTheDocument();
  });

  it("rounds to 45 from below (37 → 30)", () => {
    // Math.round(37/15)*15 = 30 → "08:30"
    const dialog = openDialog({ value: "08:37" });
    expect(within(dialog).getByText("08:30")).toBeInTheDocument();
  });

  it("rounds to 45 from above (38 → 45)", () => {
    // Math.round(38/15)*15 = 45 → "08:45"
    const dialog = openDialog({ value: "08:38" });
    expect(within(dialog).getByText("08:45")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Hour-carry behaviour — roundToQuarter returns carryHour=true when
// rounded === 60, and parseAndSetTime applies (hour + 1) % 24
// ---------------------------------------------------------------------------

describe("TimePicker dialog preview — hour-carry on round-up to 60", () => {
  it("increments the hour when minutes round up to 60 (53 → carry)", () => {
    // Math.round(53/15)*15 = 60 → carryHour=true → hour 8+1=9 → "09:00"
    const dialog = openDialog({ value: "08:53" });
    expect(within(dialog).getByText("09:00")).toBeInTheDocument();
  });

  it("applies carry across different hours", () => {
    // Math.round(59/15)*15 = 60 → carryHour=true → hour 14+1=15 → "15:00"
    const dialog = openDialog({ value: "14:59" });
    expect(within(dialog).getByText("15:00")).toBeInTheDocument();
  });

  it("wraps hour to 00 when hour 23 carries over midnight", () => {
    // Math.round(53/15)*15 = 60 → carryHour=true → (23+1)%24=0 → "00:00"
    const dialog = openDialog({ value: "23:53" });
    expect(within(dialog).getByText("00:00")).toBeInTheDocument();
  });

  it("does not carry when minutes round to 45 (the highest non-carry quarter)", () => {
    // Math.round(52/15)*15 = 45 → carryHour=false → "23:45"
    const dialog = openDialog({ value: "23:52" });
    expect(within(dialog).getByText("23:45")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// onChange callbacks
// ---------------------------------------------------------------------------

describe("TimePicker onChange callbacks", () => {
  it("calls onChange with the selected HH:MM time when OK is clicked", () => {
    const onChange = jest.fn();
    const dialog = openDialog({ value: "08:00", onChange });
    fireEvent.click(within(dialog).getByRole("button", { name: /ok/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("08:00");
  });

  it("calls onChange with an empty string when Clear is clicked", () => {
    const onChange = jest.fn();
    const dialog = openDialog({ value: "08:00", onChange });
    fireEvent.click(within(dialog).getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not call onChange when the dialog is closed without confirming", () => {
    const onChange = jest.fn();
    openDialog({ value: "08:00", onChange });
    // Press Escape to dismiss
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
      code: "Escape",
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
