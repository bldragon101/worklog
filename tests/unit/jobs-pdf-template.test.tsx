import { render } from "@testing-library/react";
import {
  JobsPdfTemplate,
  type JobsPdfJob,
  type JobsPdfTemplateProps,
} from "@/components/entities/job/jobs-pdf-template";

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

const baseJob: JobsPdfJob = {
  id: 1,
  date: "2026-10-27T00:00:00.000Z",
  driver: "JOHN",
  customer: "Acme",
  billTo: "Acme",
  registration: "ABC123",
  truckType: "Tray",
  pickup: "Dandenong",
  dropoff: "Southbank",
  startTime: "2026-10-27T06:30:00.000Z",
  finishTime: "2026-10-27T14:30:00.000Z",
  chargedHours: 8,
  travelTimeHours: null,
  driverCharge: null,
  deductionHours: null,
  driverOnly: false,
  runsheet: true,
  invoiced: true,
  jobReference: null,
  eastlink: null,
  citylink: null,
  comments: null,
};

function renderTemplate({
  jobs,
  ...overrides
}: { jobs: JobsPdfJob[] } & Partial<JobsPdfTemplateProps>) {
  return render(
    <JobsPdfTemplate
      jobs={jobs}
      periodLabel="Week ending 2 November 2026"
      appliedFilters={[]}
      search={null}
      selectedOnly={false}
      generatedAt="01/11/2026, 09:00"
      settings={{
        companyName: "Test Co",
        companyAbn: "",
        companyAddress: "",
        companyPhone: "",
        companyEmail: "",
        companyLogo: "",
      }}
      {...overrides}
    />,
  );
}

describe("Jobs PDF template", () => {
  it("groups jobs by day with a count and hours for each day", () => {
    const { container } = renderTemplate({
      jobs: [
        baseJob,
        { ...baseJob, id: 2, chargedHours: 4.5 },
        { ...baseJob, id: 3, date: "2026-10-28T00:00:00.000Z" },
      ],
    });
    const text = container.textContent ?? "";

    expect(text).toContain("Tuesday 27 October 2026");
    expect(text).toContain("2 jobs  ·  12.50 hrs");
    expect(text).toContain("Wednesday 28 October 2026");
    expect(text).toContain("1 job  ·  8.00 hrs");
    expect(text).toContain("Total · 3 jobs");
    expect(text).toContain("20.50");
  });

  it("shows times as stored, without timezone conversion", () => {
    const { container } = renderTemplate({ jobs: [baseJob] });

    expect(container.textContent).toContain("06:30");
    expect(container.textContent).toContain("14:30");
  });

  it("hides the driver hours column when it matches the job hours", () => {
    const { container } = renderTemplate({ jobs: [baseJob] });

    expect(container.textContent).not.toContain("Driver Hrs");
    expect(container.textContent).not.toContain("Driver hours");
  });

  it("shows driver hours, travel and deductions when they differ", () => {
    const { container } = renderTemplate({
      jobs: [
        { ...baseJob, travelTimeHours: 1 },
        { ...baseJob, id: 2, deductionHours: 0.5 },
      ],
    });
    const text = container.textContent ?? "";

    expect(text).toContain("Driver Hrs");
    expect(text).toContain("+1.00 travel");
    expect(text).toContain("-0.50 deducted");
  });

  it("flags outstanding runsheets and uninvoiced jobs", () => {
    const { container } = renderTemplate({
      jobs: [
        { ...baseJob, runsheet: false, invoiced: false },
        { ...baseJob, id: 2, invoiced: false },
      ],
    });
    const text = container.textContent ?? "";

    expect(text).toMatch(/Runsheets outstanding\s*1/);
    expect(text).toMatch(/Not invoiced\s*2/);
  });

  it("only shows bill to when it differs from the customer", () => {
    const { container } = renderTemplate({
      jobs: [baseJob, { ...baseJob, id: 2, billTo: "Acme Group Pty Ltd" }],
    });
    const text = container.textContent ?? "";

    expect(text).toContain("Bill to: Acme Group Pty Ltd");
    expect(text.match(/Bill to:/g)).toHaveLength(1);
  });

  it("lists the scope, filters and search applied", () => {
    const { container } = renderTemplate({
      jobs: [baseJob],
      selectedOnly: true,
      appliedFilters: [{ label: "Driver", values: ["JOHN", "MARIA"] }],
      search: "acme",
    });
    const text = container.textContent ?? "";

    expect(text).toContain("Selected jobs only");
    expect(text).toContain("JOHN, MARIA");
    expect(text).toContain('"acme"');
  });

  it("shows an empty state without totals when there are no jobs", () => {
    const { container } = renderTemplate({ jobs: [] });

    expect(container.textContent).toContain("No jobs to show.");
    expect(container.textContent).not.toContain("Total ·");
  });
});
