import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedDataTable } from '@/components/data-table/core/unified-data-table';
import type { VisibilityState, Table } from '@tanstack/react-table';

// Mock the components to avoid complex dependencies
jest.mock('@/components/data-table/components/data-table-view-options', () => ({
  DataTableViewOptions: ({ table }: { table: Table<{ id: number; name: string }> }) => {
    const [localState, setLocalState] = React.useState(table.getState().columnVisibility);
    
    return (
      <div data-testid="view-options">
        <button
          data-testid="toggle-column"
          onClick={() => {
            const newState = { ...localState, testColumn: !localState.testColumn };
            table.setColumnVisibility(newState);
            setLocalState(newState);
          }}
        >
          Toggle Test Column
        </button>
        <span data-testid="column-state">
          {JSON.stringify(localState)}
        </span>
      </div>
    );
  },
}));

jest.mock('@/components/data-table/responsive/responsive-data-display', () => ({
  ResponsiveDataDisplay: ({ 
    columnVisibility, 
    onColumnVisibilityChange,
    onTableReady,
  }: { columnVisibility?: VisibilityState; onColumnVisibilityChange?: (visibility: VisibilityState) => void; onTableReady?: (table: Table<{ id: number; name: string }>) => void }) => {
    // Create a stable mock table reference
    const tableRef = React.useRef<Partial<Table<{ id: number; name: string }>>>(null);
    
    if (!tableRef.current) {
      tableRef.current = {
        getState: () => ({
          columnVisibility: columnVisibility || {},
          columnOrder: [],
          columnPinning: {},
          rowPinning: {},
          columnFilters: [],
          globalFilter: undefined,
          sorting: [],
          rowSelection: {},
          pagination: { pageIndex: 0, pageSize: 10 },
          expanded: {},
          grouping: [],
          columnSizing: {},
          columnSizingInfo: {
            columnSizingStart: [],
            deltaOffset: null,
            deltaPercentage: null,
            isResizingColumn: false,
            startOffset: null,
            startSize: null
          }
        }),
        setColumnVisibility: onColumnVisibilityChange ? (updater) => {
          if (typeof updater === 'function') {
            const newState = updater(columnVisibility || {});
            onColumnVisibilityChange(newState);
          } else {
            onColumnVisibilityChange(updater);
          }
        } : (() => {}),
      };
    }
    
    // Update the table's state getter when columnVisibility changes
    if (tableRef.current) {
      tableRef.current.getState = () => ({
      columnVisibility: columnVisibility || {},
      columnOrder: [],
      columnPinning: {},
      rowPinning: {},
      columnFilters: [],
      globalFilter: undefined,
      sorting: [],
      rowSelection: {},
      pagination: { pageIndex: 0, pageSize: 10 },
      expanded: {},
      grouping: [],
      columnSizing: {},
      columnSizingInfo: {
        columnSizingStart: [],
        deltaOffset: null,
        deltaPercentage: null,
        isResizingColumn: false,
        startOffset: null,
        startSize: null
      }
    });
      tableRef.current.setColumnVisibility = onColumnVisibilityChange ? (updater) => {
        if (typeof updater === 'function') {
          const newState = updater(columnVisibility || {});
          onColumnVisibilityChange(newState);
        } else {
          onColumnVisibilityChange(updater);
        }
      } : (() => {});
    }
    
    // Call onTableReady only once per component mount
    React.useEffect(() => {
      if (onTableReady && tableRef.current) {
        onTableReady(tableRef.current as Table<{ id: number; name: string }>);
      }
    }, [onTableReady]); // Include onTableReady in dependency array
    
    return (
      <div data-testid="data-display">
        <span data-testid="display-state">
          {JSON.stringify(columnVisibility)}
        </span>
      </div>
    );
  },
}));

const MockToolbar = ({ table }: { table: Table<{ id: number; name: string }> }) => {
  const [localState, setLocalState] = React.useState(table.getState().columnVisibility);
  
  return (
    <div data-testid="toolbar">
      <button
        data-testid="toggle-column"
        onClick={() => {
          const newState = { ...localState, testColumn: !localState.testColumn };
          table.setColumnVisibility(newState);
          setLocalState(newState);
        }}
      >
        Toggle Test Column
      </button>
      <span data-testid="toolbar-state">
        {JSON.stringify(table.getState().columnVisibility)}
      </span>
    </div>
  );
};

describe('Jobs Column Visibility Integration', () => {
  const mockData = [
    { id: 1, name: 'Test Job 1' },
    { id: 2, name: 'Test Job 2' },
  ];

  const mockColumns = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
  ];

  const mockMobileFields = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
  ];

  it('maintains column visibility state across data changes', async () => {
    let columnVisibility: VisibilityState = { testColumn: false };
    const setColumnVisibility = jest.fn((newState) => {
      columnVisibility = newState;
    });

    const { rerender } = render(
      <UnifiedDataTable
        data={mockData}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />
    );

    // Initial state should be reflected in toolbar
    expect(screen.getByTestId('toolbar-state')).toHaveTextContent('{"testColumn":false}');

    // Toggle column visibility
    fireEvent.click(screen.getByTestId('toggle-column'));

    // State should be updated
    expect(setColumnVisibility).toHaveBeenCalledWith({ testColumn: true });

    // Simulate data change (like changing week ending filter)
    const newData = [
      { id: 3, name: 'Test Job 3' },
      { id: 4, name: 'Test Job 4' },
    ];

    rerender(
      <UnifiedDataTable
        data={newData}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
        columnVisibility={{ testColumn: true }} // State should persist
        onColumnVisibilityChange={setColumnVisibility}
      />
    );

    // Column visibility should persist across data changes
    await waitFor(() => {
      expect(screen.getByTestId('display-state')).toHaveTextContent('{"testColumn":true}');
    });
  });

  it('synchronizes state between toolbar and data display', async () => {
    let columnVisibility: VisibilityState = { col1: true, col2: false };
    const setColumnVisibility = jest.fn((newState) => {
      columnVisibility = newState;
    });

    render(
      <UnifiedDataTable
        data={mockData}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />
    );

    // Both components should show the same initial state
    expect(screen.getByTestId('toolbar-state')).toHaveTextContent('{"col1":true,"col2":false}');
    expect(screen.getByTestId('display-state')).toHaveTextContent('{"col1":true,"col2":false}');

    // Toggle column
    fireEvent.click(screen.getByTestId('toggle-column'));

    // Callback should be called with new state
    expect(setColumnVisibility).toHaveBeenCalledWith({ 
      col1: true, 
      col2: false, 
      testColumn: true 
    });
  });

  it('handles external column visibility updates', () => {
    const setColumnVisibility = jest.fn();
    
    const { rerender } = render(
      <UnifiedDataTable
        data={mockData}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
        columnVisibility={{ col1: true, col2: false }}
        onColumnVisibilityChange={setColumnVisibility}
      />
    );

    // Update external state
    rerender(
      <UnifiedDataTable
        data={mockData}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
        columnVisibility={{ col1: false, col2: true }}
        onColumnVisibilityChange={setColumnVisibility}
      />
    );

    // Components should reflect the new external state
    expect(screen.getByTestId('display-state')).toHaveTextContent('{"col1":false,"col2":true}');
  });

  it('works without external column visibility state', () => {
    render(
      <UnifiedDataTable
        data={mockData}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
      />
    );

    // Should render without errors and use internal state
    expect(screen.getByTestId('data-display')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('handles empty data with column visibility', () => {
    render(
      <UnifiedDataTable
        data={[]}
        columns={mockColumns}
        mobileFields={mockMobileFields}
        ToolbarComponent={MockToolbar}
        columnVisibility={{ col1: true, col2: false }}
        onColumnVisibilityChange={jest.fn()}
      />
    );

    // Should render without errors even with empty data
    expect(screen.getByTestId('display-state')).toHaveTextContent('{"col1":true,"col2":false}');
  });
});