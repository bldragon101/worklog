import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmailRctiDialog } from "@/components/rcti/email-rcti-dialog";

const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/lib/email-templates", () => ({
  buildRctiEmailSubject: jest.fn(
    ({
      weekEnding,
      companyName,
    }: {
      weekEnding: string;
      companyName: string;
    }) => {
      const date = weekEnding.slice(0, 10).split("-").reverse().join(".");
      if (!companyName) return `RCTI W/E ${date}`;
      return `RCTI W/E ${date} from ${companyName}`;
    },
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("EmailRctiDialog", () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSent = jest.fn();

  const mockRcti = {
    id: 42,
    invoiceNumber: "RCTI-2025-0042",
    weekEnding: "2025-06-15T00:00:00.000Z",
    total: 1234.56,
    driverName: "Bruce Wayne",
    driverId: 7,
    status: "finalised",
    lines: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    rcti: mockRcti,
    driverEmail: "bruce@wayne.com.au",
    onSent: mockOnSent,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
    });
  });

  describe("rendering", () => {
    it("should render the dialog when open is true", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Email RCTI")).toBeInTheDocument();
      });
    });

    it("should not render content when rcti is null", () => {
      render(<EmailRctiDialog {...defaultProps} rcti={null} />);

      expect(screen.queryByText("Email RCTI")).not.toBeInTheDocument();
    });

    it("should display the driver name", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Bruce Wayne")).toBeInTheDocument();
      });
    });

    it("should display the driver email address", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("bruce@wayne.com.au")).toBeInTheDocument();
      });
    });

    it("should display the invoice number", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("RCTI-2025-0042")).toBeInTheDocument();
      });
    });

    it("should display the total formatted as currency", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("$1234.56")).toBeInTheDocument();
      });
    });

    it("should display the week ending in long format", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("15 June 2025")).toBeInTheDocument();
      });
    });

    it("should display the Finalised status badge for finalised RCTIs", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Finalised")).toBeInTheDocument();
      });
    });

    it("should display the Paid status badge for paid RCTIs", async () => {
      const paidRcti = { ...mockRcti, status: "paid" };
      render(<EmailRctiDialog {...defaultProps} rcti={paidRcti} />);

      await waitFor(() => {
        expect(screen.getByText("Paid")).toBeInTheDocument();
      });
    });

    it("should display line count", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3 lines/)).toBeInTheDocument();
      });
    });

    it("should display singular line text for single line", async () => {
      const singleLineRcti = { ...mockRcti, lines: [{ id: 1 }] };
      render(<EmailRctiDialog {...defaultProps} rcti={singleLineRcti} />);

      await waitFor(() => {
        expect(screen.getByText(/1 line /)).toBeInTheDocument();
      });
    });

    it("should display the review description text", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Review the details below before sending the RCTI to the driver.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("should render Cancel and Send Email buttons", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /cancel/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeInTheDocument();
      });
    });

    it("should have correct IDs on the action buttons", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          document.getElementById("cancel-email-rcti-btn"),
        ).toBeInTheDocument();
        expect(
          document.getElementById("confirm-send-email-rcti-btn"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("missing email address", () => {
    it("should show no email warning when driverEmail is null", async () => {
      render(<EmailRctiDialog {...defaultProps} driverEmail={null} />);

      await waitFor(() => {
        expect(
          screen.getByText("No email address configured"),
        ).toBeInTheDocument();
      });
    });

    it("should show driver name in the missing email message", async () => {
      render(<EmailRctiDialog {...defaultProps} driverEmail={null} />);

      await waitFor(() => {
        const matches = screen.getAllByText(/Bruce Wayne/);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should display 'No email address' text when driverEmail is null", async () => {
      render(<EmailRctiDialog {...defaultProps} driverEmail={null} />);

      await waitFor(() => {
        expect(screen.getByText("No email address")).toBeInTheDocument();
      });
    });

    it("should disable the Send Email button when driverEmail is null", async () => {
      render(<EmailRctiDialog {...defaultProps} driverEmail={null} />);

      await waitFor(() => {
        const sendButton = screen.getByRole("button", { name: /send email/i });
        expect(sendButton).toBeDisabled();
      });
    });

    it("should not show the warning when driverEmail is provided", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.queryByText("No email address configured"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("company settings fetch", () => {
    it("should fetch company settings when dialog opens", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/company-settings");
      });
    });

    it("should not fetch company settings when dialog is closed", () => {
      render(<EmailRctiDialog {...defaultProps} open={false} />);

      const settingsCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => call[0] === "/api/company-settings",
      );
      expect(settingsCalls).toHaveLength(0);
    });

    it("should display the subject line with company name once loaded", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/RCTI W\/E.*from Acme Transport Pty Ltd/),
        ).toBeInTheDocument();
      });
    });

    it("should handle failed company settings fetch gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Email RCTI")).toBeInTheDocument();
      });
    });

    it("should handle network error on company settings fetch", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Email RCTI")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe("sending email", () => {
    it("should call the email API when Send Email is clicked", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              sentTo: "bruce@wayne.com.au",
              messageId: "msg_123",
            }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        const emailCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => call[0] === "/api/rcti/42/email",
        );
        expect(emailCalls).toHaveLength(1);
        expect(emailCalls[0][1]).toEqual({ method: "POST" });
      });
    });

    it("should show success toast after successful send", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              sentTo: "bruce@wayne.com.au",
            }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Email Sent",
            description: expect.stringContaining("bruce@wayne.com.au"),
          }),
        );
      });
    });

    it("should call onSent callback with sentTo after successful send", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              sentTo: "bruce@wayne.com.au",
            }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockOnSent).toHaveBeenCalledWith({
          sentTo: "bruce@wayne.com.au",
        });
      });
    });

    it("should close the dialog after successful send", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              sentTo: "bruce@wayne.com.au",
            }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("should show error toast when API returns error", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              error: "Driver does not have an email address configured.",
            }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            variant: "destructive",
            description: "Driver does not have an email address configured.",
          }),
        );
      });
    });

    it("should show generic error toast when API returns error without message", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({}),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            variant: "destructive",
          }),
        );
      });
    });

    it("should show error toast when fetch throws a network error", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockRejectedValueOnce(new Error("Network failure"));

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            variant: "destructive",
            description: "Network failure",
          }),
        );
      });

      consoleSpy.mockRestore();
    });

    it("should not call onSent when send fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: "Failed to send email" }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      expect(mockOnSent).not.toHaveBeenCalled();
    });

    it("should not close the dialog when send fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ companyName: "Acme Transport Pty Ltd" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: "Server error" }),
        });

      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /send email/i }),
        ).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /send email/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("should not attempt to send when rcti is null", async () => {
      render(<EmailRctiDialog {...defaultProps} rcti={null} />);

      const emailCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" && call[0].includes("/email"),
      );
      expect(emailCalls).toHaveLength(0);
    });
  });

  describe("cancel button", () => {
    it("should call onOpenChange(false) when Cancel is clicked", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /cancel/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("week ending formatting", () => {
    it("should format week ending with leading zero day correctly", async () => {
      const rctiEarlyMonth = {
        ...mockRcti,
        weekEnding: "2025-03-05T00:00:00.000Z",
      };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiEarlyMonth} />);

      await waitFor(() => {
        expect(screen.getByText("5 March 2025")).toBeInTheDocument();
      });
    });

    it("should format week ending for January correctly", async () => {
      const rctiJan = {
        ...mockRcti,
        weekEnding: "2025-01-01T00:00:00.000Z",
      };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiJan} />);

      await waitFor(() => {
        expect(screen.getByText("1 January 2025")).toBeInTheDocument();
      });
    });

    it("should format week ending for December correctly", async () => {
      const rctiDec = {
        ...mockRcti,
        weekEnding: "2025-12-31T00:00:00.000Z",
      };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiDec} />);

      await waitFor(() => {
        expect(screen.getByText("31 December 2025")).toBeInTheDocument();
      });
    });
  });

  describe("status display", () => {
    it("should display raw status for non-standard status values", async () => {
      const rctiCustomStatus = { ...mockRcti, status: "custom" };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiCustomStatus} />);

      await waitFor(() => {
        expect(screen.getByText("custom")).toBeInTheDocument();
      });
    });
  });

  describe("total formatting", () => {
    it("should format integer total with two decimal places", async () => {
      const rctiIntTotal = { ...mockRcti, total: 500 };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiIntTotal} />);

      await waitFor(() => {
        expect(screen.getByText("$500.00")).toBeInTheDocument();
      });
    });

    it("should format zero total correctly", async () => {
      const rctiZero = { ...mockRcti, total: 0 };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiZero} />);

      await waitFor(() => {
        expect(screen.getByText("$0.00")).toBeInTheDocument();
      });
    });
  });

  describe("lines display", () => {
    it("should not display line count when lines is undefined", async () => {
      const rctiNoLines = { ...mockRcti, lines: undefined };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiNoLines} />);

      await waitFor(() => {
        expect(screen.getByText("Email RCTI")).toBeInTheDocument();
      });

      expect(screen.queryByText(/line/)).not.toBeInTheDocument();
    });

    it("should not display line count when lines is empty array", async () => {
      const rctiEmptyLines = { ...mockRcti, lines: [] };
      render(<EmailRctiDialog {...defaultProps} rcti={rctiEmptyLines} />);

      await waitFor(() => {
        expect(screen.getByText("Email RCTI")).toBeInTheDocument();
      });

      expect(screen.queryByText(/0 line/)).not.toBeInTheDocument();
    });

    it("should mention PDF attachment alongside line count", async () => {
      render(<EmailRctiDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/PDF will be attached/)).toBeInTheDocument();
      });
    });
  });
});
