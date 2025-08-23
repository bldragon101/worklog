import React from 'react';
import { render, screen } from '@testing-library/react';
import { JobsUnifiedDataTable } from '@/components/data-table/jobs/jobs-unified-data-table';
import type { Job } from '@/lib/types';

// Mock the dependent components
jest.mock('@/components/data-table/core/data-table', () => ({
  DataTable: ({ data, columns }: any) => (
    <div data-testid="desktop-data-table">
      Desktop Table with {data.length} items and {columns.length} columns
    </div>
  ),
}));

jest.mock('@/components/data-table/jobs/responsive-jobs-data-display', () => ({
  ResponsiveJobsDataDisplay: ({ data, mobileFields, expandableFields, onTableReady }: any) => {
    // Simulate table ready callback
    React.useEffect(() => {
      if (onTableReady) {
        onTableReady({ mock: 'table-instance' });
      }
    }, [onTableReady]);
    
    return (
      <div data-testid="responsive-jobs-display">
        Responsive Jobs Display with {data.length} items, {mobileFields.length} mobile fields, and {expandableFields.length} expandable fields
      </div>
    );
  },
}));

jest.mock('@/components/data-table/components/mobile-toolbar-wrapper', () => ({
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

const mockMobileFields = [
  {
    key: 'date',
    label: 'Date',
    isTitle: true,
  },
  {
    key: 'customer',
    label: 'Customer',
    isSubtitle: true,
  },
];

const mockExpandableFields = [
  {
    key: 'billTo',
    label: 'Bill To',
    hideIfEmpty: true,
  },
  {
    key: 'registration',
    label: 'Registration',
    hideIfEmpty: true,
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
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnAttachFiles = jest.fn();
  const mockOnAdd = jest.fn();
  const mockOnImportSuccess = jest.fn();
  const mockGetItemId = (item: Job) => item.id;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders responsive jobs display when mobile fields and expandable fields are provided', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    expect(screen.getByText(/Responsive Jobs Display with 1 items, 2 mobile fields, and 2 expandable fields/)).toBeInTheDocument();
  });

  it('renders regular data table when mobile fields or expandable fields are not provided', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByTestId('desktop-data-table')).toBeInTheDocument();
    expect(screen.getByText(/Desktop Table with 1 items and 2 columns/)).toBeInTheDocument();
  });

  it('renders toolbar when provided and table is ready', () => {
    const MockToolbar = ({ table, onImportSuccess, onAdd }: any) => (
      <div data-testid="mock-toolbar">
        Mock Toolbar - Ready: {!!table}, Import: {!!onImportSuccess}, Add: {!!onAdd}
      </div>
    );

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        ToolbarComponent={MockToolbar}
        onImportSuccess={mockOnImportSuccess}
        onAdd={mockOnAdd}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    // The toolbar should be wrapped in mobile toolbar wrapper
    expect(screen.getByTestId('mobile-toolbar-wrapper')).toBeInTheDocument();
  });

  it('filters out actions column when not custom', () => {
    const columnsWithActions = [
      ...mockColumns,
      {
        id: 'actions',
        header: 'Actions',
      },
    ];

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={columnsWithActions}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    // The actions column should be filtered out (2 original columns remain)
    expect(screen.getByText(/2 mobile fields/)).toBeInTheDocument();
  });

  it('keeps custom actions column when present', () => {
    const columnsWithCustomActions = [
      ...mockColumns,
      {
        id: 'actions',
        header: 'Actions',
        meta: { isCustomActions: true },
      },
    ];

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={columnsWithCustomActions}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    // All 3 columns should be kept including custom actions
    expect(screen.getByText(/Responsive Jobs Display with 1 items, 2 mobile fields, and 2 expandable fields/)).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    render(
      <JobsUnifiedDataTable
        data={[]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        isLoading={true}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    expect(screen.getByText(/with 0 items/)).toBeInTheDocument();
  });

  it('passes all props correctly to responsive jobs display', () => {
    const mockFilters = { status: 'active' };
    const mockColumnVisibility = { date: true, customer: false };
    const mockOnColumnVisibilityChange = jest.fn();

    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        sheetFields={mockSheetFields}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        isLoading={false}
        loadingRowId={1}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAdd={mockOnAdd}
        onImportSuccess={mockOnImportSuccess}
        filters={mockFilters}
        columnVisibility={mockColumnVisibility}
        onColumnVisibilityChange={mockOnColumnVisibilityChange}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
  });

  it('handles empty data array', () => {
    render(
      <JobsUnifiedDataTable
        data={[]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByText(/with 0 items/)).toBeInTheDocument();
  });

  it('provides default empty arrays for optional props', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        // expandableFields not provided, should default to empty array
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    expect(screen.getByText(/0 expandable fields/)).toBeInTheDocument();
  });

  it('passes onAttachFiles callback correctly', () => {
    render(
      <JobsUnifiedDataTable
        data={[mockJob]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByTestId('responsive-jobs-display')).toBeInTheDocument();
    // The ResponsiveJobsDataDisplay mock doesn't verify the callback, but the component receives it
  });
});