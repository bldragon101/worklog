import { render } from "@testing-library/react";
import { JobsReportPdfTemplate } from "@/components/jobs-report/jobs-report-pdf-template";

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
  companyAbn: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyLogo: "",
};

const baseLine = {
  id: 1,
  jobDate: "2026-09-01T00:00:00.000Z",
  customer: "Test Customer",
  truckType: "Tray",
  startTime: "06:00",
  finishTime: "14:00",
  chargedHours: 8,
  travelTimeHours: null,
  driverCharge: 8,
};

function renderReport({
  lines,
}: {
  lines: Array<typeof baseLine | Record<string, unknown>>;
}) {
  return render(
    <JobsReportPdfTemplate
      report={{
        id: 1,
        reportNumber: "JR-1",
        driverName: "Test Driver",
        weekEnding: "2026-09-06T00:00:00.000Z",
        status: "draft",
        notes: null,
        lines: lines as never,
      }}
      settings={settings}
    />,
  );
}

describe("Jobs report PDF hours badges", () => {
  it("hides driver hours and badges when nothing differs", () => {
    const { container } = renderReport({
      lines: [baseLine, { ...baseLine, id: 2, driverCharge: null }],
    });

    expect(container.textContent).toContain("Job Hours");
    expect(container.textContent).not.toContain("Driver Hours");
    expect(container.textContent).not.toContain("Travel Hours");
    expect(container.textContent).not.toContain("travel");
    expect(container.textContent).not.toContain("deduction");
  });

  it("shows travel, extra driver hours and deductions as badges", () => {
    const { container } = renderReport({
      lines: [
        { ...baseLine, travelTimeHours: 1, driverCharge: 9 },
        { ...baseLine, id: 2, chargedHours: 12, driverCharge: 14 },
        { ...baseLine, id: 3, travelTimeHours: 1, driverCharge: 8.5 },
      ],
    });

    expect(container.textContent).toContain("Driver Hours");
    expect(container.textContent).not.toContain("Travel Hours");
    expect(container.textContent).toContain("+1 travel");
    expect(container.textContent).toContain("+2 driver");
    expect(container.textContent).toContain("-0.50 deduction");
  });
});

describe("Jobs report PDF disclaimer", () => {
  it("states that the report is not a payslip", () => {
    const { container } = renderReport({ lines: [baseLine] });

    expect(container.textContent).toContain("This is not a payslip");
    expect(container.textContent).toContain("via Xero");
  });

  it("shows the disclaimer on an empty report", () => {
    const { container } = renderReport({ lines: [] });

    expect(container.textContent).toContain("This is not a payslip");
  });
});
