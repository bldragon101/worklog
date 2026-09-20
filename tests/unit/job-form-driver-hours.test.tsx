import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { JobForm } from "@/components/entities/job/job-form";
import type { Job } from "@/lib/types";

global.fetch = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

async function renderForm(job: Partial<Job>) {
  (
    fetch as unknown as { mockResolvedValue: (value: unknown) => void }
  ).mockResolvedValue({ ok: true, json: async () => ({}) });

  await act(async () => {
    render(<JobForm isOpen onClose={vi.fn()} onSave={vi.fn()} job={job} />);
  });
}

describe("JobForm driver hours", () => {
  it("shows driver hours as a read-only calculated total", async () => {
    await renderForm({ chargedHours: 8, travelTimeHours: 1 });

    const driverHours = screen.getByLabelText("Driver Hours");
    expect(driverHours).toHaveValue("9.00");
    expect(driverHours).toHaveAttribute("readonly");
    expect(driverHours).not.toHaveAttribute("name");
  });

  it("tells the user on hover that driver hours cannot be edited", async () => {
    await renderForm({ chargedHours: 8, travelTimeHours: 1 });

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
    await renderForm({ chargedHours: 8, travelTimeHours: 1 });

    fireEvent.change(screen.getByLabelText("Deduction"), {
      target: { value: "1.5" },
    });

    expect(screen.getByLabelText("Driver Hours")).toHaveValue("7.50");
    expect(screen.getByText(/Driver paid 7.50 hrs/)).toBeInTheDocument();
  });

  it("floors the driver hours total at zero", async () => {
    await renderForm({ chargedHours: 4, travelTimeHours: null });

    fireEvent.change(screen.getByLabelText("Deduction"), {
      target: { value: "10" },
    });

    expect(screen.getByLabelText("Driver Hours")).toHaveValue("0.00");
  });

  it("honours a legacy driver hours total stored on the job", async () => {
    await renderForm({ chargedHours: 8, travelTimeHours: 1, driverCharge: 7 });

    expect(screen.getByLabelText("Driver Hours")).toHaveValue("7.00");
  });

  it("offers a driver-only option that does not change the hours paid", async () => {
    await renderForm({ chargedHours: 8, travelTimeHours: 1 });

    const driverOnly = screen.getByLabelText(
      "Driver only - no charge to the customer",
    );
    expect(driverOnly).not.toBeChecked();

    fireEvent.click(driverOnly);

    expect(driverOnly).toBeChecked();
    expect(screen.getByLabelText("Driver Hours")).toHaveValue("9.00");
  });

  it("reflects an existing driver-only job", async () => {
    await renderForm({ chargedHours: 8, driverOnly: true });

    expect(
      screen.getByLabelText("Driver only - no charge to the customer"),
    ).toBeChecked();
  });
});
