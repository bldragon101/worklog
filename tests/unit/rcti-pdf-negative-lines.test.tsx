import { render } from "@testing-library/react";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";

// Render the PDF primitives as plain elements so the text the driver sees can
// be asserted without running the real PDF renderer.
vi.mock("@react-pdf/renderer", () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Page: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Image: () => <span />,
}));

const settings = {
  companyName: "Test Co",
  companyAbn: null,
  companyAddress: null,
  companyPhone: null,
  companyEmail: null,
  companyLogo: null,
};

const baseLine = {
  id: 1,
  jobDate: new Date("2026-09-01"),
  customer: "Test Customer",
  truckType: "Tray",
  description: "08:00 - 16:00",
  chargedHours: 8,
  travelTimeHours: 1,
  driverCharge: 9,
  ratePerHour: 100,
  amountExGst: 900,
  gstAmount: 0,
  amountIncGst: 900,
};

function renderRcti({
  lines,
}: {
  lines: Array<Record<string, unknown>>;
}) {
  return render(
    <RctiPdfTemplate
      rcti={{
        id: 1,
        invoiceNumber: "RCTI-1",
        driverName: "Test Driver",
        businessName: null,
        driverAddress: null,
        driverAbn: null,
        weekEnding: new Date("2026-09-06"),
        gstStatus: "not_registered",
        gstMode: "exclusive",
        bankAccountName: null,
        bankBsb: null,
        bankAccountNumber: null,
        subtotal: 0,
        gst: 0,
        total: 0,
        status: "draft",
        notes: null,
        revertedToDraftAt: null,
        revertedToDraftReason: null,
        lines: lines as never,
      }}
      settings={settings}
    />,
  );
}

describe("RCTI PDF negative lines", () => {
  it("shows a break deduction line as negative hours", () => {
    const { container } = renderRcti({
      lines: [
        {
          ...baseLine,
          id: 2,
          customer: "Break Deduction",
          truckType: "Tray",
          description: "Lunch Breaks - Tray",
          chargedHours: -0.5,
          travelTimeHours: 0,
          driverCharge: -0.5,
          amountExGst: -50,
          amountIncGst: -50,
        },
      ],
    });

    // Job Hours and Total Driver Hours both read -0.50; a clamped total would
    // leave only one.
    const cells = [...container.querySelectorAll("span")].map(
      (cell) => cell.textContent,
    );
    expect(cells.filter((text) => text === "-0.50")).toHaveLength(2);
  });

  it("does not report a deduction against a negative line", () => {
    const { container } = renderRcti({
      lines: [
        {
          ...baseLine,
          id: 3,
          customer: "Break Deduction",
          chargedHours: -0.5,
          travelTimeHours: 0,
          driverCharge: -0.5,
          amountExGst: -50,
          amountIncGst: -50,
        },
      ],
    });

    expect(container.textContent).not.toContain("incl. deductions");
  });

  it("shows the deduction carried by a job line", () => {
    const { container } = renderRcti({
      lines: [
        { ...baseLine, driverCharge: 7.5, amountExGst: 750, amountIncGst: 750 },
      ],
    });

    expect(container.textContent).toContain("7.50 (-1.50)");
    expect(container.textContent).toContain("incl. deductions");
  });

  it("shows a plain total when nothing was deducted", () => {
    const { container } = renderRcti({ lines: [baseLine] });

    expect(container.textContent).toContain("9.00");
    expect(container.textContent).not.toContain("(-");
    expect(container.textContent).not.toContain("incl. deductions");
  });
});
