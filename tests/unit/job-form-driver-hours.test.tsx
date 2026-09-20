import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { JobForm } from "@/components/entities/job/job-form";
import type { Job } from "@/lib/types";

global.fetch = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

async function renderForm({
  job,
  onSave = vi.fn(),
}: {
  job: Partial<Job>;
  onSave?: (job: Partial<Job>) => void;
}) {
  (
    fetch as unknown as { mockResolvedValue: (value: unknown) => void }
  ).mockResolvedValue({ ok: true, json: async () => ({}) });

  await act(async () => {
    render(<JobForm isOpen onClose={vi.fn()} onSave={onSave} job={job} />);
  });
}

describe("JobForm driver hours", () => {
  it("shows driver hours as a read-only calculated total", async () => {
    await renderForm({ job: { chargedHours: 8, travelTimeHours: 1 } });

    const driverHours = screen.getByLabelText("Driver Hours");
    expect(driverHours).toHaveValue("9.00");
    expect(driverHours).toHaveAttribute("readonly");
    expect(driverHours).not.toHaveAttribute("name");
  });

  it("tells the user on hover that driver hours cannot be edited", async () => {
    await renderForm({ job: { chargedHours: 8, travelTimeHours: 1 } });

    const driverHours = screen.getByLabelText("Driver Hours");
    expect(driverHours).toHaveClass("cursor-not-allowed");

    fireEvent.pointerMove(driverHours);

    expect(
      await screen.findByText(
        "Calculated automatically - edit Deduction to change it",
      ),
    ).toBeInTheDocument();
  });

  it("subtracts an entered deduction from the driver hours total", async () => {
    await renderForm({ job: { chargedHours: 8, travelTimeHours: 1 } });

    fireEvent.change(screen.getByLabelText("Deduction"), {
      target: { value: "1.5" },
    });

    expect(screen.getByLabelText("Driver Hours")).toHaveValue("7.50");
    expect(screen.getByText(/Driver paid 7.50 hrs/)).toBeInTheDocument();
  });

  it("floors the driver hours total at zero", async () => {
    await renderForm({ job: { chargedHours: 4, travelTimeHours: null } });

    fireEvent.change(screen.getByLabelText("Deduction"), {
      target: { value: "10" },
    });

    expect(screen.getByLabelText("Driver Hours")).toHaveValue("0.00");
  });

  it("honours a legacy driver hours total stored on the job", async () => {
    await renderForm({ job: { chargedHours: 8, travelTimeHours: 1, driverCharge: 7 } });

    expect(screen.getByLabelText("Driver Hours")).toHaveValue("7.00");
  });

  it.each([
    { driverCharge: 0, expected: "0.00", effect: /Replaces hours plus travel hours with 0.00 hrs/ },
    { driverCharge: -2, expected: "5.50", effect: /Reduces hours plus travel hours by 2.00 hrs/ },
    { driverCharge: 7, expected: "5.50", effect: /Replaces hours plus travel hours with 7.00 hrs/ },
  ])("shows and preserves legacy override $driverCharge until explicitly cleared", async ({ driverCharge, expected, effect }) => {
    const onSave = vi.fn();
    await renderForm({
      job: {
        date: "2026-09-20",
        driver: "Test Driver",
        customer: "Test Customer",
        pickup: "Melbourne",
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge,
        deductionHours: 1.5,
      },
      onSave,
    });

    expect(screen.getByText(effect)).toBeInTheDocument();
    expect(screen.getByText(/The deduction will be retained/)).toBeInTheDocument();
    expect(screen.getByLabelText("Driver Hours")).toHaveValue(expected);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ driverCharge, deductionHours: 1.5 }),
      undefined,
    );

    const clearButton = screen.getByRole("button", { name: "Clear legacy override" });
    expect(clearButton).toHaveAttribute("id", "clear-legacy-driver-hours-override-btn");
    expect(clearButton).toHaveAttribute("type", "button");
    fireEvent.click(clearButton);

    expect(screen.queryByText("Legacy driver hours override:")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Deduction")).toHaveValue(1.5);
    expect(screen.getByLabelText("Driver Hours")).toHaveValue("7.50");
    fireEvent.change(screen.getByLabelText("Hours", { exact: true }), { target: { value: "10" } });
    expect(screen.getByLabelText("Driver Hours")).toHaveValue("9.50");
    fireEvent.change(screen.getByLabelText("Travel Hours"), { target: { value: "2" } });
    expect(screen.getByLabelText("Driver Hours")).toHaveValue("10.50");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ driverCharge: null, deductionHours: 1.5, chargedHours: 10, travelTimeHours: 2 }),
      undefined,
    );
  });

  it.each([{ key: "{Enter}" }, { key: " " }])("clears the override with keyboard input $key", async ({ key }) => {
    const user = userEvent.setup();
    await renderForm({ job: { chargedHours: 8, driverCharge: 0, deductionHours: 1 } });
    screen.getByRole("button", { name: "Clear legacy override" }).focus();
    await user.keyboard(key);
    expect(screen.queryByRole("button", { name: "Clear legacy override" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Driver Hours")).toHaveValue("7.00");
    expect(screen.getByLabelText("Deduction")).toHaveValue(1);
  });

  it.each([{ driverCharge: null }, { driverCharge: undefined }])("does not show a legacy notice without an override ($driverCharge)", async ({ driverCharge }) => {
    await renderForm({ job: { chargedHours: 8, driverCharge } });
    expect(screen.queryByText("Legacy driver hours override:")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear legacy override" })).not.toBeInTheDocument();
  });

  it("offers a driver-only option that does not change the hours paid", async () => {
    await renderForm({ job: { chargedHours: 8, travelTimeHours: 1 } });

    const driverOnly = screen.getByLabelText(
      "Driver only - no charge to the customer",
    );
    expect(driverOnly).not.toBeChecked();

    fireEvent.click(driverOnly);

    expect(driverOnly).toBeChecked();
    expect(screen.getByLabelText("Driver Hours")).toHaveValue("9.00");
  });

  it("reflects an existing driver-only job", async () => {
    await renderForm({ job: { chargedHours: 8, driverOnly: true } });

    expect(
      screen.getByLabelText("Driver only - no charge to the customer"),
    ).toBeChecked();
  });
});
