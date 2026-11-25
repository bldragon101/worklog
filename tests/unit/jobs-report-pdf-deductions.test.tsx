import { render } from "@testing-library/react";
import { Prisma } from "@/generated/prisma/client";
import { toJobsReportPdfData } from "@/lib/jobs-report-pdf-data";
import {
  JobsReportPdfTemplate,
  type JobsReportPdfData,
} from "@/components/jobs-report/jobs-report-pdf-template";

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
  description: null,
  startTime: "06:00",
  finishTime: "14:00",
  chargedHours: 8,
  travelTimeHours: null,
  driverCharge: null,
};

function renderReport({
  lines = [baseLine],
  deductions = [],
}: {
  lines?: JobsReportPdfData["lines"];
  deductions?: JobsReportPdfData["deductions"];
}) {
  return render(
    <JobsReportPdfTemplate
      report={{
        id: 1,
        reportNumber: "JR-1",
        driverName: "Test Driver",
        weekEnding: "2026-09-06T00:00:00.000Z",
        status: "finalised",
        notes: null,
        lines,
        deductions,
      }}
      settings={settings}
    />,
  );
}

describe("Jobs report PDF manual lines and deductions", () => {
  it("shows a manual line's description under the customer", () => {
    const { container } = renderReport({
      lines: [{ ...baseLine, description: "Yard shift" }],
    });

    expect(container.textContent).toContain("Yard shift");
  });

  it("leaves out the deductions section when there are none", () => {
    const { container } = renderReport({});

    expect(container.textContent).not.toContain("Reimbursements");
  });

  it("lists deductions and reimbursements without a total", () => {
    const { container } = renderReport({
      deductions: [
        { id: 1, type: "deduction", description: "Uniform", amount: 45.5 },
        { id: 2, type: "reimbursement", description: "Tolls", amount: 12 },
      ],
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Deductions & Reimbursements");
    expect(text).toContain("Uniform");
    expect(text).toContain("-$45.50");
    expect(text).toContain("Tolls");
    expect(text).toContain("+$12.00");
    expect(text).not.toContain("$33.50");
    expect(text).not.toContain("-$33.50");
  });
});

describe("toJobsReportPdfData deductions", () => {
  const report = {
    id: 1,
    reportNumber: "JR-1",
    driverName: "Test Driver",
    weekEnding: new Date("2026-09-06T00:00:00.000Z"),
    notes: null,
    lines: [],
    deductionApplications: [
      {
        id: 11,
        amount: new Prisma.Decimal(45.5),
        deduction: { type: "deduction", description: "Uniform" },
      },
      {
        id: 12,
        amount: new Prisma.Decimal(0),
        deduction: { type: "deduction", description: "Skipped loan" },
      },
    ],
  };

  it("lists applied deductions on a finalised report and leaves out skipped ones", () => {
    const data = toJobsReportPdfData({
      report: { ...report, status: "finalised" } as never,
    });

    expect(data.deductions).toEqual([
      { id: 11, type: "deduction", description: "Uniform", amount: 45.5 },
    ]);
  });

  it("previews the pending deductions on a draft", () => {
    const data = toJobsReportPdfData({
      report: { ...report, status: "draft" } as never,
      pendingDeductions: [
        {
          id: 3,
          type: "reimbursement",
          description: "Tolls",
          amountToApply: 12,
        },
      ],
    });

    expect(data.deductions).toEqual([
      { id: 3, type: "reimbursement", description: "Tolls", amount: 12 },
    ]);
  });
});
