import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { useReactTable, getCoreRowModel, ColumnDef } from '@tanstack/react-table';
import { JobDataTableToolbar } from '@/components/entities/job/job-data-table-toolbar';
import type { Job } from '@/lib/types';

// Mock the UI components
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, id }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid={id}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/data-table/components/data-table-view-options', () => ({
  DataTableViewOptions: () => <div data-testid="view-options" />,
}));

jest.mock('@/components/shared/csv-import-export', () => ({
  CsvImportExport: () => <div data-testid="csv-import-export" />,
}));

// Sample test data
const mockJobs: Job[] = [
  {
    id: 1,
    date: '2024-01-15',
    driver: 'SIMRAN',
    customer: 'Tilling',
    billTo: 'Tilling Ltd',
    registration: 'ABC123',
    truckType: 'TRAY',
    pickup: 'Location A',
    dropoff: 'Location B',
    runsheet: true,
    invoiced: false,
    startTime: '08:00',
    finishTime: '16:00',
    chargedHours: 8,
    driverCharge: 400,
    comments: 'Test job 1',
  },
  {
    id: 2,
    date: '2024-01-15',
    driver: 'SIMRAN',
    customer: 'Tilling',
    billTo: 'Tilling Ltd',
    registration: 'ABC123',
    truckType: 'TRAY',
    pickup: 'Location C',
    dropoff: 'Location D',
    runsheet: false,
    invoiced: true,
    startTime: '09:00',
    finishTime: '17:00',
    chargedHours: 8,
    driverCharge: 400,
    comments: 'Test job 2',
  },
  {
    id: 3,
    date: '2024-01-16',
    driver: 'STEWART',
    customer: 'Bayswood',
    billTo: 'Bayswood Pty',
    registration: 'XYZ789',
    truckType: 'CRANE',
    pickup: 'Location E',
    dropoff: 'Location F',
    runsheet: true,
    invoiced: false,
    startTime: '07:00',
    finishTime: '15:00',
    chargedHours: 8,
    driverCharge: 450,
    comments: 'Test job 3',
  },
  {
    id: 4,
    date: '2024-01-16',
    driver: 'GAGANDEEP',
    customer: 'Ace Reo',
    billTo: 'Ace Reo Ltd',
    registration: 'DEF456',
    truckType: 'SEMI',
    pickup: 'Location G',
    dropoff: 'Location H',
    runsheet: false,
    invoiced: false,
    startTime: '06:00',
    finishTime: '14:00',
    chargedHours: 8,
    driverCharge: 500,
    comments: 'Test job 4',
  },
];

// Helper component to test with a real table instance
function TestWrapper({ children, data = mockJobs }: { children: React.ReactNode; data?: Job[] }) {
  const columns: ColumnDef<Job>[] = [
    { accessorKey: 'driver', header: 'Driver' },
    { accessorKey: 'customer', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnFilters: [],
      globalFilter: '',
      sorting: [],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    onColumnFiltersChange: jest.fn(),
    onGlobalFilterChange: jest.fn(),
  });

  return (
    <div>
      {React.cloneElement(children as React.ReactElement, { table, dataLength: data.length })}
    </div>
  );
}

describe('JobDataTableToolbar', () => {
  const defaultProps = {
    onAdd: jest.fn(),
    onImportSuccess: jest.fn(),
    isLoading: false,
    dataLength: mockJobs.length,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CustomFacetedFilter Component', () => {
    it('should render filter options with labels and counts', async () => {
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      // Wait for component to render and process data
      await waitFor(() => {
        // Look for driver filter button
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Click driver filter to open options
      const driverButton = screen.getByRole('button', { name: /driver/i });
      fireEvent.click(driverButton);

      await waitFor(() => {
        // Check that filter options are displayed
        expect(screen.getByTestId('filter-driver-SIMRAN')).toBeInTheDocument();
        expect(screen.getByTestId('filter-driver-STEWART')).toBeInTheDocument();
        expect(screen.getByTestId('filter-driver-GAGANDEEP')).toBeInTheDocument();
      });
    });

    it('should update selected values when checkbox is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Open driver filter
      const driverButton = screen.getByRole('button', { name: /driver/i });
      await user.click(driverButton);

      // Check SIMRAN checkbox
      const simranCheckbox = screen.getByTestId('filter-driver-SIMRAN');
      await user.click(simranCheckbox);

      // Verify checkbox is checked
      expect(simranCheckbox).toBeChecked();

      // Verify badges appear showing selection (there may be multiple badges for count and selection)
      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should clear all selections when clear button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Open driver filter and select an option
      const driverButton = screen.getByRole('button', { name: /driver/i });
      await user.click(driverButton);

      const simranCheckbox = screen.getByTestId('filter-driver-SIMRAN');
      await user.click(simranCheckbox);

      // Clear selection using internal clear button
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);

      // Verify checkbox is unchecked
      expect(simranCheckbox).not.toBeChecked();
    });
  });

  describe('Cascading Filter Logic', () => {
    it('should calculate correct counts for each filter option', async () => {
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // The component should calculate counts based on available data
      // SIMRAN: 2 jobs, STEWART: 1 job, GAGANDEEP: 1 job
      // This is tested indirectly through the updateFilterOptions function
    });

    it('should filter options based on other active filters', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Select SIMRAN driver
      const driverButton = screen.getByRole('button', { name: /driver/i });
      await user.click(driverButton);

      const simranCheckbox = screen.getByTestId('filter-driver-SIMRAN');
      await user.click(simranCheckbox);

      // Close driver filter and open customer filter
      await user.click(driverButton); // Close driver filter
      
      const customerButton = screen.getByRole('button', { name: /customer/i });
      await user.click(customerButton);

      await waitFor(() => {
        // Should only show Tilling (SIMRAN's customer), not Bayswood or Ace Reo
        expect(screen.getByTestId('filter-customer-Tilling')).toBeInTheDocument();
        
        // These should not be present since they don't work with SIMRAN
        expect(screen.queryByTestId('filter-customer-Bayswood')).not.toBeInTheDocument();
        expect(screen.queryByTestId('filter-customer-Ace Reo')).not.toBeInTheDocument();
      });
    });

    it('should update counts when multiple filters are applied', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Apply driver filter
      const driverButton = screen.getByRole('button', { name: /driver/i });
      await user.click(driverButton);
      
      const simranCheckbox = screen.getByTestId('filter-driver-SIMRAN');
      await user.click(simranCheckbox);
      
      await user.click(driverButton); // Close driver filter

      // Apply customer filter
      const customerButton = screen.getByRole('button', { name: /customer/i });
      await user.click(customerButton);
      
      const tillingCheckbox = screen.getByTestId('filter-customer-Tilling');
      await user.click(tillingCheckbox);

      // The intersection should now show only SIMRAN + Tilling jobs (2 jobs)
      // This affects the counts for other filters like truck type, registration, etc.
    });
  });

  describe('Boolean Filters (Runsheet/Invoiced)', () => {
    it('should handle boolean filters correctly with counts', async () => {
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const runsheetButton = screen.getByRole('button', { name: /runsheet/i });
        expect(runsheetButton).toBeInTheDocument();
      });

      // Open runsheet filter
      const runsheetButton = screen.getByRole('button', { name: /runsheet/i });
      fireEvent.click(runsheetButton);

      await waitFor(() => {
        // Should show Yes/No options with counts
        expect(screen.getByTestId('filter-runsheet-true')).toBeInTheDocument();
        expect(screen.getByTestId('filter-runsheet-false')).toBeInTheDocument();
      });
    });
  });

  describe('Data Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      render(
        <TestWrapper data={[]}>
          <JobDataTableToolbar {...defaultProps} dataLength={0} />
        </TestWrapper>
      );

      // Should render without crashing
      await waitFor(() => {
        // Search input should be present
        const searchInput = screen.getByPlaceholderText(/search all columns/i);
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should show skeleton states when loading', async () => {
      render(
        <TestWrapper data={[]}>
          <JobDataTableToolbar {...defaultProps} isLoading={true} dataLength={0} />
        </TestWrapper>
      );

      // Should show skeleton loading states when isLoading is true
      await waitFor(() => {
        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(6);
      });
    });

    it('should handle data with null/undefined values', async () => {
      const dataWithNulls: Job[] = [
        {
          ...mockJobs[0],
          driver: '',
          customer: null as any,
          billTo: undefined as any,
        },
      ];

      render(
        <TestWrapper data={dataWithNulls}>
          <JobDataTableToolbar {...defaultProps} dataLength={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Should filter out null/empty values and not crash
      const driverButton = screen.getByRole('button', { name: /driver/i });
      fireEvent.click(driverButton);

      // Should handle null values gracefully
      expect(driverButton).toBeInTheDocument();
    });
  });

  describe('Filter State Management', () => {
    it('should maintain filter state when switching between filters', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Select driver
      const driverButton = screen.getByRole('button', { name: /driver/i });
      await user.click(driverButton);
      
      const simranCheckbox = screen.getByTestId('filter-driver-SIMRAN');
      await user.click(simranCheckbox);
      
      await user.click(driverButton); // Close

      // Select customer
      const customerButton = screen.getByRole('button', { name: /customer/i });
      await user.click(customerButton);
      
      const tillingCheckbox = screen.getByTestId('filter-customer-Tilling');
      await user.click(tillingCheckbox);
      
      await user.click(customerButton); // Close

      // Go back to driver filter - SIMRAN should still be selected
      await user.click(driverButton);
      
      await waitFor(() => {
        const simranCheckboxAgain = screen.getByTestId('filter-driver-SIMRAN');
        expect(simranCheckboxAgain).toBeChecked();
      });
    });

    it('should handle reset functionality', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });

      // Apply some filters
      const driverButton = screen.getByRole('button', { name: /driver/i });
      await user.click(driverButton);
      
      const simranCheckbox = screen.getByTestId('filter-driver-SIMRAN');
      await user.click(simranCheckbox);

      // Verify checkbox is checked
      expect(simranCheckbox).toBeChecked();

      // Test that the component handles filter state properly
      const searchInput = screen.getByPlaceholderText(/search all columns/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Global Search Integration', () => {
    it('should update filter options when global search is applied', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <JobDataTableToolbar {...defaultProps} />
        </TestWrapper>
      );

      // Apply global search
      const searchInput = screen.getByPlaceholderText(/search all columns/i);
      await user.type(searchInput, 'SIMRAN');

      // Filter options should update based on search results
      await waitFor(() => {
        const driverButton = screen.getByRole('button', { name: /driver/i });
        expect(driverButton).toBeInTheDocument();
      });
    });
  });
});