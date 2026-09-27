import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { JobForm } from "@/components/entities/job/job-form";
import type { Job } from "@/lib/types";

global.fetch = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

async function renderForm({ job }: { job: Partial<Job> }) {
  (
    fetch as unknown as { mockResolvedValue: (value: unknown) => void }
  ).mockResolvedValue({ ok: true, json: async () => ({}) });

  await act(async () => {
    render(<JobForm isOpen onClose={vi.fn()} onSave={vi.fn()} job={job} />);
  });
}

describe("JobForm country run", () => {
  it("flags a regional drop-off from a metro pickup", async () => {
    await renderForm({ job: { pickup: "Dandenong", dropoff: "Belmont" } });

    expect(screen.getByText("Regional: Belmont")).toBeInTheDocument();
  });

  it("does not flag metro drop-offs", async () => {
    await renderForm({ job: { pickup: "Dandenong", dropoff: "Richmond" } });

    expect(screen.queryByText(/Regional:/)).not.toBeInTheDocument();
  });

  it("writes the country run charge into the comments", async () => {
    await renderForm({
      job: {
        pickup: "Dandenong",
        dropoff: "Richmond, Belmont",
        comments: "Gate code 1234",
      },
    });

    fireEvent.change(screen.getByLabelText("Country run"), {
      target: { value: "1.5" },
    });

    expect(screen.getByLabelText("Comments")).toHaveValue(
      "Gate code 1234\n*country run Belmont + 1.5 hours*",
    );
  });

  it("removes the note when the charge is cleared", async () => {
    await renderForm({
      job: {
        pickup: "Dandenong",
        dropoff: "Belmont",
        countryRunValue: 1.5,
        countryRunUnit: "hours",
        comments: "Gate code 1234\n*country run Belmont + 1.5 hours*",
      },
    });

    fireEvent.change(screen.getByLabelText("Country run"), {
      target: { value: "" },
    });

    expect(screen.getByLabelText("Comments")).toHaveValue("Gate code 1234");
  });
});
