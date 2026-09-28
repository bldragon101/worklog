import { screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HoursInfoDialog } from "@/components/entities/job/hours-info-dialog";
import { JobForm } from "@/components/entities/job/job-form";
import { renderWithQueryClient } from "../helpers/query-client";

global.fetch = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("HoursInfoDialog", () => {
  it("is closed until the trigger is pressed", () => {
    renderWithQueryClient({ ui: <HoursInfoDialog /> });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /how hours work/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Driver Hours = Hours + Travel Hours − Deduction",
    );
    expect(dialog).toHaveTextContent("Deduction");
    expect(dialog).toHaveTextContent("Badges on the jobs list");
    expect(dialog).toHaveTextContent("On RCTIs and reports");
    expect(dialog).toHaveTextContent("Jobs with no customer charge");
  });

  it("closes again from the footer button", () => {
    renderWithQueryClient({ ui: <HoursInfoDialog /> });

    fireEvent.click(screen.getByRole("button", { name: /how hours work/i }));
    fireEvent.click(document.getElementById("close-hours-info-btn")!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens from inside the job form", async () => {
    (
      fetch as unknown as { mockResolvedValue: (value: unknown) => void }
    ).mockResolvedValue({ ok: true, json: async () => ({}) });

    await act(async () => {
      renderWithQueryClient({
        ui: (
          <JobForm
            isOpen
            onClose={vi.fn()}
            onSave={vi.fn()}
            job={{ chargedHours: 8 }}
          />
        ),
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /how hours work/i }));

    expect(
      screen.getByText("Driver Hours = Hours + Travel Hours − Deduction"),
    ).toBeInTheDocument();
  });
});
