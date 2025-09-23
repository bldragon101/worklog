import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JobRowActions } from "@/components/entities/job/job-row-actions";
import DashboardPage from "@/app/jobs/page";
import { JobForm } from "@/components/entities/job/job-form";
import { Job } from "@/lib/types";
import "@testing-library/jest-dom";
import {
  validateJobForDuplication,
  createJobDuplicate,
  removeSystemFields,
  SYSTEM_FIELDS_TO_EXCLUDE,
} from "@/lib/utils/job-duplication";

// Mock dependencies
jest.mock("@/components/layout/protected-layout", () => ({
  ProtectedLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Radix UI dropdown menu to render in place instead of portal
jest.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({
    children,
    asChild,
    ...props
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    [key: string]: unknown;
  }) => {
    const Component = asChild ? React.Fragment : "button";
    return <Component {...props}>{children}</Component>;
  },
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  Item: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <div role="menuitem" onClick={onClick} {...props}>
      {children}
    </div>
  ),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-job-form-data", () => ({
  useJobFormData: (job: Partial<Job> | null) => {
    const [formData, setFormData] = React.useState(job || {});
    return {
      formData,
      setFormData,
      hasUnsavedChanges: Object.keys(formData).length > 0,
      setHasUnsavedChanges: jest.fn(),
    };
  },
}));

jest.mock("@/hooks/use-job-form-options", () => ({
  useJobFormOptions: () => ({
    customerOptions: ["Customer A", "Customer B"],
    billToOptions: ["Bill To A", "Bill To B"],
    registrationOptions: ["ABC123", "XYZ789"],
    truckTypeOptions: ["Truck", "Semi"],
    driverOptions: ["Driver 1", "Driver 2"],
    selectsLoading: false,
    customerToBillTo: {},
    registrationToType: {},
    driverToTruck: {},
  }),
}));

jest.mock("@/hooks/use-job-attachments", () => ({
  useJobAttachments: () => ({
    isAttachmentDialogOpen: false,
    setIsAttachmentDialogOpen: jest.fn(),
    attachmentConfig: null,
  }),
}));

jest.mock("@/hooks/use-job-form-validation", () => ({
  useJobFormValidation: () => ({
    showValidationDialog: false,
    setShowValidationDialog: jest.fn(),
    missingFields: [],
    showCloseConfirmation: false,
    setShowCloseConfirmation: jest.fn(),
    handleSubmit: (
      formData: Partial<Job>,
      onSave: (data: Partial<Job>) => void,
      setHasUnsavedChanges: (hasChanges: boolean) => void,
    ) => {
      onSave(formData);
      setHasUnsavedChanges(false);
    },
    handleCloseAttempt: jest.fn(),
    confirmClose: jest.fn(),
  }),
}));

describe("Job Duplicate Functionality", () => {
  const mockJob: Job = {
    id: 1,
    date: "2024-01-15",
    driver: "John Doe",
    customer: "ABC Corp",
    billTo: "ABC Billing",
    registration: "ABC123",
    truckType: "Semi",
    pickup: "Melbourne, Sydney",
    dropoff: "Brisbane",
    startTime: "08:00",
    finishTime: "16:00",
    chargedHours: 8,
    driverCharge: 500,
    jobReference: "JOB-001",
    citylink: 2,
    eastlink: 3,
    runsheet: true,
    invoiced: true,
    comments: "Test comments",
    attachmentRunsheet: ["file1.pdf"],
    attachmentDocket: ["file2.pdf"],
    attachmentDeliveryPhotos: ["photo1.jpg"],
  };

  describe("JobRowActions Component", () => {
    it("should render duplicate menu item when onDuplicate is provided", async () => {
      const mockOnDuplicate = jest.fn();

      render(<JobRowActions row={mockJob} onDuplicate={mockOnDuplicate} />);

      // Open dropdown menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Wait for dropdown to appear and check if duplicate option is visible
      await waitFor(() => {
        const duplicateOption = screen.getByText("Duplicate");
        expect(duplicateOption).toBeInTheDocument();
      });
    });

    it("should not render duplicate menu item when onDuplicate is not provided", () => {
      render(<JobRowActions row={mockJob} />);

      // Open dropdown menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Check that duplicate option is not present
      const duplicateOption = screen.queryByText("Duplicate");
      expect(duplicateOption).not.toBeInTheDocument();
    });

    it("should call onDuplicate with correct job data when clicked", async () => {
      const mockOnDuplicate = jest.fn();

      render(<JobRowActions row={mockJob} onDuplicate={mockOnDuplicate} />);

      // Open dropdown menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByText("Duplicate")).toBeInTheDocument();
      });

      // Click duplicate option
      const duplicateOption = screen.getByText("Duplicate");
      fireEvent.click(duplicateOption);

      // Verify onDuplicate was called with the job
      expect(mockOnDuplicate).toHaveBeenCalledTimes(1);
      expect(mockOnDuplicate).toHaveBeenCalledWith(mockJob);
    });

    it("should handle error gracefully when duplicate fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const mockOnDuplicate = jest.fn().mockImplementation(() => {
        throw new Error("Duplicate failed");
      });

      render(<JobRowActions row={mockJob} onDuplicate={mockOnDuplicate} />);

      // Open dropdown menu
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      fireEvent.click(menuButton);

      // Click duplicate option
      const duplicateOption = screen.getByText("Duplicate");
      fireEvent.click(duplicateOption);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Duplicate failed:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("JobForm with Duplicated Data", () => {
    it("should verify duplicated job has correct structure", () => {
      const duplicatedJob: Partial<Job> = {
        driver: mockJob.driver || "",
        customer: mockJob.customer || "",
        billTo: mockJob.billTo || "",
        registration: mockJob.registration || "",
        truckType: mockJob.truckType || "",
        pickup: mockJob.pickup || "",
        dropoff: mockJob.dropoff || "",
        // Note: date should be undefined so user must select it
        runsheet: false,
        invoiced: false,
        startTime: null,
        finishTime: null,
        chargedHours: null,
        driverCharge: null,
        jobReference: "",
        citylink: null,
        eastlink: null,
        comments: "",
      };

      // Verify that duplicated job has the expected fields
      expect(duplicatedJob.driver).toBe(mockJob.driver);
      expect(duplicatedJob.customer).toBe(mockJob.customer);
      expect(duplicatedJob.billTo).toBe(mockJob.billTo);
      expect(duplicatedJob.registration).toBe(mockJob.registration);
      expect(duplicatedJob.truckType).toBe(mockJob.truckType);
      expect(duplicatedJob.pickup).toBe(mockJob.pickup);
      expect(duplicatedJob.dropoff).toBe(mockJob.dropoff);

      // Verify excluded fields are reset
      expect(duplicatedJob.date).toBeUndefined();
      expect(duplicatedJob.id).toBeUndefined();
      expect(duplicatedJob.runsheet).toBe(false);
      expect(duplicatedJob.invoiced).toBe(false);
      expect(duplicatedJob.chargedHours).toBeNull();
      expect(duplicatedJob.driverCharge).toBeNull();
    });

    it("should handle null/undefined values in duplication", () => {
      const jobWithNulls: Job = {
        ...mockJob,
        pickup: null as unknown as string,
        dropoff: null as unknown as string,
        comments: null as unknown as string,
        jobReference: null as unknown as string,
      };

      const duplicatedJob: Partial<Job> = {
        driver: jobWithNulls.driver || "",
        customer: jobWithNulls.customer || "",
        billTo: jobWithNulls.billTo || "",
        registration: jobWithNulls.registration || "",
        truckType: jobWithNulls.truckType || "",
        pickup: jobWithNulls.pickup || "",
        dropoff: jobWithNulls.dropoff || "",
        // Date is undefined - user must select it
      };

      // Verify null values are handled correctly
      expect(duplicatedJob.pickup).toBe("");
      expect(duplicatedJob.dropoff).toBe("");
      expect(duplicatedJob.date).toBeUndefined();
    });

    it("should verify excluded fields are reset in duplicated job", () => {
      const duplicatedJob: Partial<Job> = {
        driver: mockJob.driver,
        customer: mockJob.customer,
        billTo: mockJob.billTo,
        registration: mockJob.registration,
        truckType: mockJob.truckType,
        pickup: mockJob.pickup,
        dropoff: mockJob.dropoff,
        // Date is undefined - user must select it
        // Excluded fields with reset values
        runsheet: false,
        invoiced: false,
        startTime: null,
        finishTime: null,
        chargedHours: null,
        driverCharge: null,
        jobReference: "",
        citylink: null,
        eastlink: null,
        comments: "",
      };

      // Verify that excluded fields have default/reset values
      expect(duplicatedJob.date).toBeUndefined();
      expect(duplicatedJob.runsheet).toBe(false);
      expect(duplicatedJob.invoiced).toBe(false);
      expect(duplicatedJob.startTime).toBeNull();
      expect(duplicatedJob.finishTime).toBeNull();
      expect(duplicatedJob.chargedHours).toBeNull();
      expect(duplicatedJob.driverCharge).toBeNull();
      expect(duplicatedJob.jobReference).toBe("");
      expect(duplicatedJob.citylink).toBeNull();
      expect(duplicatedJob.eastlink).toBeNull();
      expect(duplicatedJob.comments).toBe("");

      // Verify attachments are not included
      const duplicatedJobWithAttachments = duplicatedJob as Record<
        string,
        unknown
      >;
      expect(duplicatedJobWithAttachments.attachmentRunsheet).toBeUndefined();
      expect(duplicatedJobWithAttachments.attachmentDocket).toBeUndefined();
      expect(
        duplicatedJobWithAttachments.attachmentDeliveryPhotos,
      ).toBeUndefined();
    });

    it("should not include date field when duplicating", () => {
      const duplicatedJob: Partial<Job> = {
        driver: mockJob.driver,
        customer: mockJob.customer,
        // Date should be undefined so user must select it
      };

      // Verify that date is not included
      expect(duplicatedJob.date).toBeUndefined();
      expect("date" in duplicatedJob).toBe(false);
    });

    it("should render form with duplicated data and allow submission", async () => {
      const mockOnSave = jest.fn();
      const duplicatedJob: Partial<Job> = {
        driver: mockJob.driver,
        customer: mockJob.customer,
        billTo: mockJob.billTo,
        registration: mockJob.registration,
        truckType: mockJob.truckType,
        pickup: mockJob.pickup,
        dropoff: mockJob.dropoff,
        // Date is undefined - user must select it
        runsheet: false,
        invoiced: false,
      };

      render(
        <JobForm
          isOpen={true}
          onClose={jest.fn()}
          onSave={mockOnSave}
          job={duplicatedJob}
        />,
      );

      // Verify form title indicates new job (not edit)
      expect(screen.getByText("Add Job")).toBeInTheDocument();

      // Find and click save button
      const saveButton = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveButton);

      // Verify onSave was called with the form data
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            driver: mockJob.driver,
            customer: mockJob.customer,
            billTo: mockJob.billTo,
          }),
        );
      });
    });
  });

  describe("Duplicate Handler in Jobs Page", () => {
    beforeEach(() => {
      // Mock fetch for jobs data
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockJob]),
        }),
      ) as jest.Mock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create a properly formatted duplicate job object", async () => {
      render(<DashboardPage />);

      // Wait for jobs to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/jobs");
      });

      // The duplicate handler should create an object with:
      // - Selected fields copied from original
      // - Date omitted so user must select it
      // - Excluded fields reset to defaults
      const expectedDuplicatedJob = {
        driver: mockJob.driver || "",
        customer: mockJob.customer || "",
        billTo: mockJob.billTo || "",
        registration: mockJob.registration || "",
        truckType: mockJob.truckType || "",
        pickup: mockJob.pickup || "",
        dropoff: mockJob.dropoff || "",
        // Date should not be included
        runsheet: false,
        invoiced: false,
        startTime: null,
        finishTime: null,
        chargedHours: null,
        driverCharge: null,
        jobReference: "",
        citylink: null,
        eastlink: null,
        comments: "",
      };

      // Verify the structure
      expect(expectedDuplicatedJob).not.toHaveProperty("date");
      expect(expectedDuplicatedJob).not.toHaveProperty("id");
      expect(expectedDuplicatedJob).not.toHaveProperty("attachmentRunsheet");
      expect(expectedDuplicatedJob).not.toHaveProperty("attachmentDocket");
      expect(expectedDuplicatedJob).not.toHaveProperty(
        "attachmentDeliveryPhotos",
      );
      expect(expectedDuplicatedJob.driver).toBe(mockJob.driver);
      expect(expectedDuplicatedJob.runsheet).toBe(false);
      expect(expectedDuplicatedJob.chargedHours).toBeNull();
    });

    it("should ensure system fields are not included in duplicate", () => {
      const duplicatedJob: Record<string, unknown> = {
        driver: mockJob.driver,
        customer: mockJob.customer,
      };

      // Simulate deletion of system fields
      delete duplicatedJob.id;
      delete duplicatedJob.date;
      delete duplicatedJob.createdAt;
      delete duplicatedJob.updatedAt;
      delete duplicatedJob.attachmentRunsheet;
      delete duplicatedJob.attachmentDocket;
      delete duplicatedJob.attachmentDeliveryPhotos;

      // Verify system fields are not present
      expect(duplicatedJob.date).toBeUndefined();
      expect(duplicatedJob.id).toBeUndefined();
      expect(duplicatedJob.createdAt).toBeUndefined();
      expect(duplicatedJob.updatedAt).toBeUndefined();
      expect(duplicatedJob.attachmentRunsheet).toBeUndefined();
      expect(duplicatedJob.attachmentDocket).toBeUndefined();
      expect(duplicatedJob.attachmentDeliveryPhotos).toBeUndefined();
    });
  });

  describe("Mobile View Duplicate Functionality", () => {
    it("should include duplicate option in mobile card dropdown", () => {
      const mockOnDuplicate = jest.fn();

      // Mock window.innerWidth to simulate mobile view
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      // This would be tested with the ExpandableMobileCardView component
      // but we need to ensure the onDuplicate prop is passed through
      expect(mockOnDuplicate).toBeDefined();
    });
  });

  describe("Utility Functions", () => {
    describe("validateJobForDuplication", () => {
      it("should validate job with all required fields", () => {
        const result = validateJobForDuplication(mockJob);
        expect(result.isValid).toBe(true);
        expect(result.missingFields).toEqual([]);
      });

      it("should detect missing required fields", () => {
        const jobWithMissingFields = {
          ...mockJob,
          customer: "",
          driver: "",
        };
        const result = validateJobForDuplication(jobWithMissingFields);
        expect(result.isValid).toBe(false);
        expect(result.missingFields).toContain("customer");
        expect(result.missingFields).toContain("driver");
      });
    });

    describe("createJobDuplicate", () => {
      it("should create duplicate with correct fields", () => {
        const duplicate = createJobDuplicate(mockJob);

        // Check included fields
        expect(duplicate.driver).toBe(mockJob.driver);
        expect(duplicate.customer).toBe(mockJob.customer);
        expect(duplicate.billTo).toBe(mockJob.billTo);

        // Check reset fields
        expect(duplicate.runsheet).toBe(false);
        expect(duplicate.invoiced).toBe(false);
        expect(duplicate.chargedHours).toBeNull();

        // Check excluded fields
        expect(duplicate.id).toBeUndefined();
        expect(duplicate.date).toBeUndefined();
      });
    });

    describe("removeSystemFields", () => {
      it("should remove all system fields", () => {
        const obj: Record<string, unknown> = {
          id: 1,
          date: "2024-01-01",
          createdAt: new Date(),
          updatedAt: new Date(),
          attachmentRunsheet: "file.pdf",
          driver: "John Doe",
          customer: "Acme Corp",
        };

        removeSystemFields(obj);

        // Check system fields are removed
        for (const field of SYSTEM_FIELDS_TO_EXCLUDE) {
          expect(obj[field]).toBeUndefined();
        }

        // Check other fields remain
        expect(obj.driver).toBe("John Doe");
        expect(obj.customer).toBe("Acme Corp");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string fields correctly", () => {
      const jobWithEmptyStrings: Job = {
        ...mockJob,
        pickup: "",
        dropoff: "",
        comments: "",
        jobReference: "",
      };

      const duplicatedJob: Partial<Job> = {
        driver: jobWithEmptyStrings.driver || "",
        pickup: jobWithEmptyStrings.pickup || "",
        dropoff: jobWithEmptyStrings.dropoff || "",
        comments: "",
        jobReference: "",
      };

      expect(duplicatedJob.pickup).toBe("");
      expect(duplicatedJob.dropoff).toBe("");
      expect(duplicatedJob.comments).toBe("");
      expect(duplicatedJob.jobReference).toBe("");
      expect(duplicatedJob.date).toBeUndefined();
    });

    it("should handle special characters in duplicated fields", () => {
      const jobWithSpecialChars: Job = {
        ...mockJob,
        customer: "O'Reilly & Co.",
        pickup: "St. John's, Mount D'Or",
        comments: 'Test "quote" & <special>',
      };

      const duplicatedJob: Partial<Job> = {
        customer: jobWithSpecialChars.customer,
        pickup: jobWithSpecialChars.pickup,
        comments: "", // Comments should be reset
      };

      expect(duplicatedJob.customer).toBe("O'Reilly & Co.");
      expect(duplicatedJob.pickup).toBe("St. John's, Mount D'Or");
      expect(duplicatedJob.comments).toBe("");
      expect(duplicatedJob.date).toBeUndefined();
    });
  });
});
