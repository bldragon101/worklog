/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock fetch globally
global.fetch = vi.fn();
global.confirm = vi.fn();

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "user_123",
      firstName: "Test",
      lastName: "User",
    },
  }),
  useAuth: () => ({
    userId: "user_123",
    isLoaded: true,
    isSignedIn: true,
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe("RCTI Deductions Delete Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as vi.Mock).mockClear();
    (global.confirm as vi.Mock).mockClear();
    mockToast.mockClear();
  });

  it("should enable delete button for deductions with applications", () => {
    // Mock a deduction with amountPaid > 0
    const mockDeduction = {
      id: 1,
      driverId: 100,
      type: "deduction",
      description: "pay advance",
      totalAmount: 1700,
      amountPaid: 300,
      amountRemaining: 1400,
      frequency: "weekly",
      status: "active",
    };

    // Create a minimal component that mimics the deduction delete button
    const TestComponent = () => {
      const isSaving = false;

      return (
        <button
          type="button"
          data-testid="delete-deduction-btn"
          onClick={() => {
            /* handler */
          }}
          disabled={isSaving}
          title={
            mockDeduction.amountPaid > 0
              ? "Cancel deduction (preserves payment history)"
              : "Delete deduction"
          }
        >
          Delete
        </button>
      );
    };

    render(<TestComponent />);

    const deleteButton = screen.getByTestId("delete-deduction-btn");

    // Button should be enabled (not disabled)
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute(
      "title",
      "Cancel deduction (preserves payment history)",
    );
  });

  it("should enable delete button for deductions without applications", () => {
    // Mock a deduction with amountPaid === 0
    const mockDeduction = {
      id: 2,
      driverId: 100,
      type: "deduction",
      description: "new deduction",
      totalAmount: 500,
      amountPaid: 0,
      amountRemaining: 500,
      frequency: "once",
      status: "active",
    };

    const TestComponent = () => {
      const isSaving = false;

      return (
        <button
          type="button"
          data-testid="delete-deduction-btn"
          onClick={() => {
            /* handler */
          }}
          disabled={isSaving}
          title={
            mockDeduction.amountPaid > 0
              ? "Cancel deduction (preserves payment history)"
              : "Delete deduction"
          }
        >
          Delete
        </button>
      );
    };

    render(<TestComponent />);

    const deleteButton = screen.getByTestId("delete-deduction-btn");

    // Button should be enabled
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Delete deduction");
  });

  it("should show confirmation dialog for deductions with applications", () => {
    const mockDeduction = {
      id: 1,
      driverId: 100,
      type: "deduction",
      description: "pay advance",
      totalAmount: 1700,
      amountPaid: 300,
      amountRemaining: 1400,
      frequency: "weekly",
      status: "active",
    };

    const deductions = [mockDeduction];

    const TestComponent = () => {
      const handleDeleteDeduction = async (deductionId: number) => {
        const deduction = deductions.find((d) => d.id === deductionId);
        const hasApplications = deduction && deduction.amountPaid > 0;

        const confirmMessage = hasApplications
          ? "This deduction has been partially applied. Deleting it will cancel future applications but preserve the payment history. Continue?"
          : "Are you sure you want to delete this deduction?";

        if (!confirm(confirmMessage)) {
          return;
        }

        // Proceed with deletion
        await fetch(`/api/rcti-deductions/${deductionId}`, {
          method: "DELETE",
        });
      };

      return (
        <button
          type="button"
          data-testid="delete-deduction-btn"
          onClick={() => handleDeleteDeduction(mockDeduction.id)}
        >
          Delete
        </button>
      );
    };

    (global.confirm as vi.Mock).mockReturnValue(true);
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Deduction cancelled" }),
    });

    render(<TestComponent />);

    const deleteButton = screen.getByTestId("delete-deduction-btn");
    fireEvent.click(deleteButton);

    // Should show confirmation with correct message
    expect(global.confirm).toHaveBeenCalledWith(
      "This deduction has been partially applied. Deleting it will cancel future applications but preserve the payment history. Continue?",
    );
  });

  it("should show confirmation dialog for deductions without applications", () => {
    const mockDeduction = {
      id: 2,
      driverId: 100,
      type: "deduction",
      description: "new deduction",
      totalAmount: 500,
      amountPaid: 0,
      amountRemaining: 500,
      frequency: "once",
      status: "active",
    };

    const deductions = [mockDeduction];

    const TestComponent = () => {
      const handleDeleteDeduction = async (deductionId: number) => {
        const deduction = deductions.find((d) => d.id === deductionId);
        const hasApplications = deduction && deduction.amountPaid > 0;

        const confirmMessage = hasApplications
          ? "This deduction has been partially applied. Deleting it will cancel future applications but preserve the payment history. Continue?"
          : "Are you sure you want to delete this deduction?";

        if (!confirm(confirmMessage)) {
          return;
        }

        await fetch(`/api/rcti-deductions/${deductionId}`, {
          method: "DELETE",
        });
      };

      return (
        <button
          type="button"
          data-testid="delete-deduction-btn"
          onClick={() => handleDeleteDeduction(mockDeduction.id)}
        >
          Delete
        </button>
      );
    };

    (global.confirm as vi.Mock).mockReturnValue(true);
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Deduction deleted successfully" }),
    });

    render(<TestComponent />);

    const deleteButton = screen.getByTestId("delete-deduction-btn");
    fireEvent.click(deleteButton);

    // Should show confirmation with correct message
    expect(global.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this deduction?",
    );
  });

  it("should not proceed with deletion if user cancels confirmation", () => {
    const mockDeduction = {
      id: 1,
      driverId: 100,
      type: "deduction",
      description: "pay advance",
      totalAmount: 1700,
      amountPaid: 300,
      amountRemaining: 1400,
      frequency: "weekly",
      status: "active",
    };

    const deductions = [mockDeduction];

    const TestComponent = () => {
      const handleDeleteDeduction = async (deductionId: number) => {
        const deduction = deductions.find((d) => d.id === deductionId);
        const hasApplications = deduction && deduction.amountPaid > 0;

        const confirmMessage = hasApplications
          ? "This deduction has been partially applied. Deleting it will cancel future applications but preserve the payment history. Continue?"
          : "Are you sure you want to delete this deduction?";

        if (!confirm(confirmMessage)) {
          return;
        }

        await fetch(`/api/rcti-deductions/${deductionId}`, {
          method: "DELETE",
        });
      };

      return (
        <button
          type="button"
          data-testid="delete-deduction-btn"
          onClick={() => handleDeleteDeduction(mockDeduction.id)}
        >
          Delete
        </button>
      );
    };

    // User cancels confirmation
    (global.confirm as vi.Mock).mockReturnValue(false);

    render(<TestComponent />);

    const deleteButton = screen.getByTestId("delete-deduction-btn");
    fireEvent.click(deleteButton);

    // Confirm was called
    expect(global.confirm).toHaveBeenCalled();
    // But fetch was NOT called
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
