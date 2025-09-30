import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JobCopyDetailsDialog } from "@/components/entities/job/job-copy-details-dialog";
import { Job } from "@/lib/types";
import "@testing-library/jest-dom";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});

describe("JobCopyDetailsDialog", () => {
  const mockJob: Job = {
    id: 1,
    date: "2024-01-15",
    driver: "John Doe",
    customer: "Acme Corp",
    billTo: "Acme Corp",
    registration: "ABC123",
    truckType: "Semi",
    pickup: "Melbourne, Carlton",
    dropoff: "Sydney, CBD",
    startTime: "2024-01-15T08:00:00",
    finishTime: "2024-01-15T16:30:00",
    chargedHours: 8.5,
    driverCharge: 450,
    citylink: 2,
    eastlink: 1,
    jobReference: "JOB-2024-001",
    comments: "Handle with care",
    runsheet: true,
    invoiced: false,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  };

  const mockOnOpenChange = jest.fn();
  const mockOnCopy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Dialog rendering", () => {
    it("should not render when open is false", () => {
      render(
        <JobCopyDetailsDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.queryByText("Copy Job Details")).not.toBeInTheDocument();
    });

    it("should render when open is true", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText("Copy Job Details")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The following job details will be copied to your clipboard."
        )
      ).toBeInTheDocument();
    });

    it("should display formatted job details", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      // Check for key details in the preview
      expect(screen.getByText(/15\/01\/2024/)).toBeInTheDocument();
      expect(screen.getByText(/Driver: John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Melbourne, Carlton to Sydney, CBD/)).toBeInTheDocument();
      expect(screen.getByText(/Job Ref: JOB-2024-001/)).toBeInTheDocument();
      expect(screen.getByText(/Handle with care/)).toBeInTheDocument();
    });

    it("should display time range and calculated hours", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/08:00-16:30/)).toBeInTheDocument();
      expect(screen.getByText(/8\.50h/)).toBeInTheDocument();
    });

    it("should display tolls information", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/Tolls: 2CL 1EL/)).toBeInTheDocument();
    });

    it("should render copy button", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const copyButton = screen.getByRole("button", {
        name: /copy to clipboard/i,
      });
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe("Dialog interactions", () => {
    it("should call onCopy when copy button is clicked", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const copyButton = screen.getByRole("button", {
        name: /copy to clipboard/i,
      });
      fireEvent.click(copyButton);

      expect(mockOnCopy).toHaveBeenCalledTimes(1);
    });

    it("should call onOpenChange when dialog is closed via escape key", async () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      // Simulate escape key press
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("should not call onCopy multiple times on double-click", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const copyButton = screen.getByRole("button", {
        name: /copy to clipboard/i,
      });
      fireEvent.click(copyButton);
      fireEvent.click(copyButton);

      // Should only be called twice (once per click)
      expect(mockOnCopy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Different job scenarios", () => {
    it("should handle job without optional fields", () => {
      const minimalJob: Job = {
        ...mockJob,
        startTime: null,
        finishTime: null,
        citylink: null,
        eastlink: null,
        jobReference: null,
        comments: null,
      };

      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={minimalJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/Driver: John Doe/)).toBeInTheDocument();
      expect(screen.queryByText(/Tolls:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Job Ref:/)).not.toBeInTheDocument();
    });

    it("should handle job with only citylink tolls", () => {
      const jobWithCitylink: Job = {
        ...mockJob,
        citylink: 5,
        eastlink: 0,
      };

      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={jobWithCitylink}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/Tolls: 5CL/)).toBeInTheDocument();
      expect(screen.queryByText(/EL/)).not.toBeInTheDocument();
    });

    it("should handle job with only eastlink tolls", () => {
      const jobWithEastlink: Job = {
        ...mockJob,
        citylink: 0,
        eastlink: 3,
      };

      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={jobWithEastlink}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/Tolls: 3EL/)).toBeInTheDocument();
      expect(screen.queryByText(/CL/)).not.toBeInTheDocument();
    });

    it("should handle job with multiline comments", () => {
      const jobWithMultilineComments: Job = {
        ...mockJob,
        comments: "Line 1\nLine 2\nLine 3",
      };

      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={jobWithMultilineComments}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Line 2/)).toBeInTheDocument();
      expect(screen.getByText(/Line 3/)).toBeInTheDocument();
    });

    it("should handle job with pickup but no dropoff", () => {
      const jobPickupOnly: Job = {
        ...mockJob,
        pickup: "Melbourne CBD",
        dropoff: "",
      };

      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={jobPickupOnly}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/Melbourne CBD/)).toBeInTheDocument();
      const text = screen.getByText(/Melbourne CBD/).textContent;
      expect(text).not.toContain(" to ");
    });

    it("should calculate fractional hours correctly (3h45m = 3.75h)", () => {
      const jobWith3h45m: Job = {
        ...mockJob,
        startTime: "2024-01-15T09:00:00",
        finishTime: "2024-01-15T12:45:00",
      };

      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={jobWith3h45m}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText(/3\.75h/)).toBeInTheDocument();
    });
  });

  describe("Formatting consistency", () => {
    it("should use monospace font for details", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const preElement = screen.getByText(/Driver: John Doe/).closest("pre");
      expect(preElement).toHaveClass("font-mono");
    });

    it("should preserve whitespace in formatted details", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const preElement = screen.getByText(/Driver: John Doe/).closest("pre");
      expect(preElement).toHaveClass("whitespace-pre-wrap");
    });

    it("should display details in a muted background container", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const container = screen
        .getByText(/Driver: John Doe/)
        .closest("div.bg-muted");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper dialog role", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should have descriptive title and description", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      expect(screen.getByText("Copy Job Details")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The following job details will be copied to your clipboard."
        )
      ).toBeInTheDocument();
    });

    it("should have accessible copy button", () => {
      render(
        <JobCopyDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          job={mockJob}
          onCopy={mockOnCopy}
        />
      );

      const button = screen.getByRole("button", {
        name: /copy to clipboard/i,
      });
      expect(button).toBeEnabled();
    });
  });
});
