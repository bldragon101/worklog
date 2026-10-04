import type { DataTableColumnDef, DataTableInstance } from "@/components/data-table/core/table-features";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { JobsUnifiedDataTable } from '@/components/data-table/jobs/jobs-unified-data-table';
import type { Job } from '@/lib/types';


// Mock the dependent components
vi.mock('@/components/data-table/core/data-table', () => ({
  DataTable: ({ data, columns }: { data: Job[]; columns: DataTableColumnDef<Job>[] }) => (
    <div data-testid="desktop-data-table">
      Desktop Table with {data.length} items and {columns.length} columns
    </div>
  ),
}));

vi.mock('@/components/data-table/jobs/responsive-jobs-data-display', () => ({
  ResponsiveJobsDataDisplay: ({ data, columns, onUpdateStatus, onTableReady }: { data: Job[]; columns: DataTableColumnDef<Job>[]; onUpdateStatus?: unknown; onTableReady?: (table: DataTableInstance<Job>) => void }) => {
    // Simulate table ready callback
    React.useEffect(() => {
      if (onTableReady) {
        onTableReady({
          mock: 'table-instance',
          atoms: {},
          setColumnVisibility: () => {},
          getAllFlatColumnsById: () => ({})
        } as unknown as DataTableInstance<Job>);
      }
    }, [onTableReady]);

    return (
      <div data-testid="responsive-jobs-display">
        Responsive Jobs Display with {data.length} items and {columns.length} columns
        {onUpdateStatus ? ', status updates enabled' : ''}
      </div>
    );
  },
}));

vi.mock('@/components/data-table/components/mobile-toolbar-wrapper', () => ({
  MobileToolbarWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mobile-toolbar-wrapper">{children}</div>
  ),
}));

const mockJob: Job = {
  id: 1,
  date: '2024-01-15',
  driver: 'John Doe',
  customer: 'Test Customer',
  billTo: 'Test Bill To',
  registration: 'ABC123',
  truckType: 'Tray',
  pickup: 'Test Pickup',
  dropoff: 'Test Dropoff',
  runsheet: false,
  invoiced: true,
  chargedHours: 8,
  driverCharge: 400,
  startTime: '08:00:00',
  finishTime: '16:00:00',
  comments: 'Test comments',
  jobReference: 'JOB-001',
  eastlink: 2,
  citylink: 1,
  attachmentRunsheet: [],
  attachmentDocket: [],
  attachmentDeliveryPhotos: [],
};

const mockColumns = [
  {
    id: 'date',
    accessorKey: 'date',
    header: 'Date',
  },
  {
    id: 'customer',
    accessorKey: 'customer',
    header: 'Customer',
  },
];

const mockSheetFields = [
  {
    id: 'date' as keyof Job,
    label: 'Date',
    type: 'readonly' as const,
  },
];

describe('JobsUnifiedDataTable', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnAttachFiles = vi.fn();
  const mockOnAdd = vi.fn();
  const mockOnImportSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always renders the responsive jobs display', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    expect(screen.getByText(/Responsive Jobs Display with 1 items and 2 columns/)).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-data-table')).not.toBeInTheDocument();
  });

  it('renders toolbar when provided and table is ready', () => {
    const MockToolbar = ({ table, onImportSuccess, onAdd }: { table?: DataTableInstance<Job>; onImportSuccess?: () => void; onAdd?: () => void }) => (
      <div data-testid="mock-toolbar">
        Mock Toolbar - Ready: {!!table}, Import: {!!onImportSuccess}, Add: {!!onAdd}
      </div>
    );

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        ToolbarComponent={MockToolbar}
        onImportSuccess={mockOnImportSuccess}
        onAdd={mockOnAdd}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // The toolbar should be wrapped in mobile toolbar wrapper
    expect(screen.getByTestId('mobile-toolbar-wrapper')).toBeInTheDocument();
  });

  it('keeps a custom actions column', () => {
    const columnsWithCustomActions = [
      ...mockColumns,
      {
        id: 'actions',
        header: 'Actions',
      },
    ];

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={columnsWithCustomActions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/with 1 items and 3 columns/)).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    render(
      <JobsUnifiedDataTable
        data={[]}
        columns={mockColumns}
        isLoading={true}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    expect(screen.getByText(/with 0 items/)).toBeInTheDocument();
  });

  it('passes all props correctly to responsive jobs display', () => {
    const mockFilters = { status: 'active' };
    const mockColumnVisibility = { date: true, customer: false };
    const mockOnColumnVisibilityChange = vi.fn();

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        sheetFields={mockSheetFields}
        isLoading={false}
        loadingRowId={1}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAdd={mockOnAdd}
        onImportSuccess={mockOnImportSuccess}
        filters={mockFilters}
        columnVisibility={mockColumnVisibility}
        onColumnVisibilityChange={mockOnColumnVisibilityChange}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
  });

  it('handles empty data array', () => {
    render(
      <JobsUnifiedDataTable
        data={[]}
        columns={mockColumns}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/with 0 items/)).toBeInTheDocument();
  });

  it('passes the status update handler through for the mobile cards', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        onUpdateStatus={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText(/status updates enabled/)).toBeInTheDocument();
  });

  it('passes onAttachFiles callback correctly', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    // The ResponsiveJobsDataDisplay mock doesn't verify the callback, but the component receives it
  });
});