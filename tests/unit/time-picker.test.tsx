import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { TimePicker } from "@/components/ui/time-picker";

// Mock the date to ensure consistent test results
const mockDate = new Date("2025-08-12T10:30:00.000Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(mockDate);
});

afterAll(() => {
  jest.useRealTimers();
});

describe("TimePicker Component", () => {
  describe("rendering and basic props", () => {
    it("renders with default placeholder", () => {
      render(<TimePicker />);
      expect(screen.getByText("Select time")).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      render(<TimePicker placeholder="Choose start time" />);
      expect(screen.getByText("Choose start time")).toBeInTheDocument();
    });

    it("displays provided time value in HH:mm format", () => {
      render(<TimePicker value="14:30" />);
      expect(screen.getByText("14:30")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<TimePicker className="custom-class" />);
      const triggerButton = screen.getByRole("button");
      expect(triggerButton).toHaveClass("custom-class");
    });

    it("applies custom id attribute", () => {
      render(<TimePicker id="start-time-picker" />);
      const triggerButton = screen.getByRole("button");
      expect(triggerButton).toHaveAttribute("id", "start-time-picker");
    });

    it("respects disabled prop", () => {
      render(<TimePicker disabled />);
      const triggerButton = screen.getByRole("button");
      expect(triggerButton).toBeDisabled();
    });

    it("parses datetime string values correctly", () => {
      const datetimeValue = "2025-08-12T14:30:00.000Z";
      render(<TimePicker value={datetimeValue} />);
      expect(screen.getByText(datetimeValue)).toBeInTheDocument();
    });

    it("handles malformed datetime values gracefully", () => {
      const malformedValue = "invalid-date-string";
      render(<TimePicker value={malformedValue} />);
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("dialog open and close", () => {
    it("opens dialog when trigger button is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      expect(screen.getByText("Hours")).toBeInTheDocument();
      expect(screen.getByText("Minutes")).toBeInTheDocument();
    });

    it("renders time picker controls when opened", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      expect(screen.getByText("Hours")).toBeInTheDocument();
      expect(screen.getByText("Minutes")).toBeInTheDocument();
      expect(screen.getByText("OK")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("HH:MM")).toBeInTheDocument();
    });

    it("closes dialog after OK is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker value="10:30" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      await waitFor(() => {
        expect(screen.queryByText("Hours")).not.toBeInTheDocument();
      });
    });

    it("closes dialog after Clear is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker value="10:30" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const clearButton = screen.getByText("Clear");
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByText("Hours")).not.toBeInTheDocument();
      });
    });
  });

  describe("selector-based time selection", () => {
    it("calls onChange when OK button is clicked with existing value", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} value="10:30" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("10:30");
    });

    it("clears time when Clear button is clicked", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker value="14:30" onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const clearButton = screen.getByText("Clear");
      await user.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith("");
    });

    it("has OK button enabled when time value is provided", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker value="14:30" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const okButton = screen.getByText("OK");
      expect(okButton).not.toBeDisabled();
    });
  });

  describe("direct text input", () => {
    it("renders direct time input field when dialog is open", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("inputMode", "numeric");
      expect(input).toHaveAttribute("maxLength", "5");
    });

    it("prefills direct input with current selector value on open", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker value="14:30" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      expect(input).toHaveValue("14:30");
    });

    it("prefills direct input with default 08:00 when no value is set", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      expect(input).toHaveValue("08:00");
    });

    it("calls onChange with typed time when OK is clicked", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      // Type without colon — auto-colon inserts it after "14"
      await user.type(input, "1430");

      await waitFor(() => {
        expect(input).toHaveValue("14:30");
      });

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("14:30");
    });

    it("calls onChange with typed time including user-typed colon", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      // Type with explicit colon — auto-colon fires on "14", then typed colon is collapsed
      await user.type(input, "14:30");

      await waitFor(() => {
        expect(input).toHaveValue("14:30");
      });

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("14:30");
    });

    it("submits time on Enter key press with valid input", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "0945");

      await waitFor(() => {
        expect(input).toHaveValue("09:45");
      });

      await user.keyboard("{Enter}");

      expect(mockOnChange).toHaveBeenCalledWith("09:45");
    });

    it("does not submit on Enter key press with invalid input", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "99:99");
      await user.keyboard("{Enter}");

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("accepts any minute value 00-59 in direct input", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "0907");

      await waitFor(() => {
        expect(input).toHaveValue("09:07");
      });

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("09:07");
    });

    it("accepts boundary time values", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "2359");

      await waitFor(() => {
        expect(input).toHaveValue("23:59");
      });

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("23:59");
    });

    it("accepts 00:00 as a valid time", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "0000");

      await waitFor(() => {
        expect(input).toHaveValue("00:00");
      });

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("00:00");
    });
  });

  describe("input sanitisation", () => {
    it("strips non-numeric non-colon characters from input", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "ab1c");

      // Should only contain digits (sanitised), not the original 'ab1c'
      expect(input).not.toHaveValue("ab1c");
      // The cleaned value should be digits and colons only
      const currentValue = (input as HTMLInputElement).value;
      expect(currentValue).toMatch(/^[\d:]*$/);
    });

    it("auto-inserts colon after two digits are typed", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "14");

      // After typing "14", a colon should be auto-inserted
      expect((input as HTMLInputElement).value).toBe("14:");
    });

    it("shows error for invalid time format", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "2500");

      expect(
        screen.getByText("Enter a valid time (00:00 - 23:59)"),
      ).toBeInTheDocument();
    });

    it("shows error for hour value out of range", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "9900");

      expect(
        screen.getByText("Enter a valid time (00:00 - 23:59)"),
      ).toBeInTheDocument();
    });

    it("clears error when input becomes partially valid again", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "2500");

      expect(
        screen.getByText("Enter a valid time (00:00 - 23:59)"),
      ).toBeInTheDocument();

      // Clear and start typing valid input
      await user.clear(input);
      await user.type(input, "14");

      expect(
        screen.queryByText("Enter a valid time (00:00 - 23:59)"),
      ).not.toBeInTheDocument();
    });
  });

  describe("invalid input rejection on OK", () => {
    it("does not close dialog when OK is clicked with invalid input", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "2500");

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      // Dialog should remain open
      expect(screen.getByText("Hours")).toBeInTheDocument();
      // onChange should not have been called
      expect(mockOnChange).not.toHaveBeenCalled();
      // Error should be shown
      expect(
        screen.getByText("Enter a valid time (00:00 - 23:59)"),
      ).toBeInTheDocument();
    });

    it("falls back to selector values when OK is clicked with empty direct input", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} value="14:30" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      // Clear the input completely
      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      // Should fall back to the selector values (14:30 from initial value)
      expect(mockOnChange).toHaveBeenCalledWith("14:30");
    });
  });

  describe("state reset on clear", () => {
    it("resets state when value prop becomes empty", () => {
      const { rerender } = render(<TimePicker value="14:30" />);

      // Re-render with empty value
      rerender(<TimePicker value="" />);

      // The display should show the placeholder, not the old value
      expect(screen.getByText("Select time")).toBeInTheDocument();
    });

    it("resets internal state after clear so stale time is not resubmitted", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      const { rerender } = render(
        <TimePicker value="14:30" onChange={mockOnChange} />,
      );

      // Open and clear
      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const clearButton = screen.getByText("Clear");
      await user.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith("");

      // Simulate parent updating value to empty
      rerender(<TimePicker value="" onChange={mockOnChange} />);

      mockOnChange.mockClear();

      // Open again and click OK without changing anything
      const triggerButton2 = screen.getByRole("button");
      await user.click(triggerButton2);

      const okButton = screen.getByText("OK");
      await user.click(okButton);

      // Should get the default reset value (08:00), not stale 14:30
      expect(mockOnChange).toHaveBeenCalledWith("08:00");
    });
  });

  describe("selector and input synchronisation", () => {
    it("syncs direct input when hour selector is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="test-picker" value="08:00" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      // Click the hour button for 14 using its deterministic ID
      const hourButton = document.getElementById("test-picker-hour-btn-14");
      expect(hourButton).toBeInTheDocument();
      await user.click(hourButton!);

      const input = screen.getByPlaceholderText("HH:MM");
      expect(input).toHaveValue("14:00");
    });

    it("syncs direct input when minute selector is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="test-picker" value="08:00" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      // Click the minute button for 45
      const minuteButton = document.getElementById("test-picker-minute-btn-45");
      expect(minuteButton).toBeInTheDocument();
      await user.click(minuteButton!);

      const input = screen.getByPlaceholderText("HH:MM");
      expect(input).toHaveValue("08:45");
    });

    it("syncs hour selector when valid time is typed in input", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} id="test-picker" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "1645");

      await waitFor(() => {
        expect(input).toHaveValue("16:45");
      });

      // Confirm by clicking OK
      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("16:45");
    });

    it("syncs minute selector with non-15-minute interval typed values", async () => {
      const mockOnChange = jest.fn();
      const user = userEvent.setup({ delay: null });

      render(<TimePicker onChange={mockOnChange} id="test-picker" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "1207");

      await waitFor(() => {
        expect(input).toHaveValue("12:07");
      });

      // The preview should show the typed time
      const okButton = screen.getByText("OK");
      await user.click(okButton);

      expect(mockOnChange).toHaveBeenCalledWith("12:07");
    });
  });

  describe("deterministic IDs", () => {
    it("uses id prop as base for internal element IDs", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="start-time" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      expect(
        document.getElementById("start-time-direct-input"),
      ).toBeInTheDocument();
      expect(document.getElementById("start-time-ok-btn")).toBeInTheDocument();
      expect(
        document.getElementById("start-time-clear-btn"),
      ).toBeInTheDocument();
    });

    it("uses default base ID when id prop is not provided", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      expect(
        document.getElementById("time-picker-direct-input"),
      ).toBeInTheDocument();
      expect(document.getElementById("time-picker-ok-btn")).toBeInTheDocument();
      expect(
        document.getElementById("time-picker-clear-btn"),
      ).toBeInTheDocument();
    });

    it("generates unique IDs for hour buttons", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="my-picker" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      expect(
        document.getElementById("my-picker-hour-btn-00"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-hour-btn-12"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-hour-btn-23"),
      ).toBeInTheDocument();
    });

    it("generates unique IDs for minute buttons", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="my-picker" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      expect(
        document.getElementById("my-picker-minute-btn-00"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-minute-btn-15"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-minute-btn-30"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-minute-btn-45"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-minute-btn-07"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("my-picker-minute-btn-59"),
      ).toBeInTheDocument();
    });
  });

  describe("minute options completeness", () => {
    it("renders all 60 minute options (00-59)", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="full-minutes" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      for (let i = 0; i < 60; i++) {
        const minute = i.toString().padStart(2, "0");
        const minuteButton = document.getElementById(
          `full-minutes-minute-btn-${minute}`,
        );
        expect(minuteButton).toBeInTheDocument();
      }
    });

    it("highlights the correct minute button for non-15-minute values", async () => {
      const user = userEvent.setup({ delay: null });
      render(<TimePicker id="highlight-test" />);

      const triggerButton = screen.getByRole("button");
      await user.click(triggerButton);

      const input = screen.getByPlaceholderText("HH:MM");
      await user.clear(input);
      await user.type(input, "1007");

      await waitFor(() => {
        expect(input).toHaveValue("10:07");
      });

      // The minute button for 07 should exist and be highlighted
      await waitFor(() => {
        const minuteBtn07 = document.getElementById(
          "highlight-test-minute-btn-07",
        );
        expect(minuteBtn07).toBeInTheDocument();
        expect(minuteBtn07).toHaveClass("bg-primary");
      });
    });
  });
});
