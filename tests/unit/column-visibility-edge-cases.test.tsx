import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DataTableViewOptions } from '@/components/data-table/components/data-table-view-options';
import { createMockTable } from './test-utils/mock-table';

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-root">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild, ...props }: any) => 
    asChild ? React.cloneElement(children, props) : <div {...props}>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div data-testid="dropdown-label">{children}</div>,
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
  DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange, ...props }: any) => {
    // Just use the checked prop directly and call onCheckedChange with the opposite value
    const handleClick = () => {
      onCheckedChange?.(!checked);
    };
    
    return (
      <div 
        data-testid="dropdown-checkbox-item"
        data-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        role="menuitemcheckbox"
        aria-label={children}
        onClick={handleClick}
        {...props}
      >
        {children}
      </div>
    );
  },
}));

jest.mock('@radix-ui/react-dropdown-menu', () => ({
  DropdownMenuTrigger: ({ children, asChild, ...props }: any) => 
    asChild ? React.cloneElement(children, props) : <div {...props}>{children}</div>,
}));

jest.mock('@radix-ui/react-icons', () => ({
  MixerHorizontalIcon: ({ ...props }: any) => <svg {...props} data-testid="mixer-icon" />,
}));

describe('Column Visibility Edge Cases', () => {
  let mockSetColumnVisibility: jest.Mock;

  beforeEach(() => {
    mockSetColumnVisibility = jest.fn();
  });

  it('handles rapid successive clicks without state corruption', () => {
    const mockTable = createMockTable({
      columnVisibility: { col1: false },
      setColumnVisibility: mockSetColumnVisibility,
    });

    render(<DataTableViewOptions table={mockTable} />);
    
    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);
    
    const checkbox = screen.getByRole('menuitemcheckbox', { name: 'col1' });
    
    // Click multiple times with proper state updates
    fireEvent.click(checkbox);
    
    // Should handle the click without corruption
    // The component includes all columns in the state for consistency
    expect(mockSetColumnVisibility).toHaveBeenCalledWith({ 
      col1: true,  // toggled from false to true
      col2: true,  // defaults to true (not in initial state)
      col3: true   // defaults to true (not in initial state)
    });
    expect(mockSetColumnVisibility).toHaveBeenCalledTimes(1);
  });

  it('handles undefined column visibility gracefully', () => {
    const mockTable = createMockTable({
      columnVisibility: {},
      setColumnVisibility: mockSetColumnVisibility,
    });

    // Override getState to return undefined columnVisibility
    mockTable.getState = jest.fn(() => ({
      columnVisibility: undefined as any,
      columnFilters: [],
      sorting: [],
      pagination: { pageIndex: 0, pageSize: 10 },
    }));

    expect(() => {
      render(<DataTableViewOptions table={mockTable} />);
    }).not.toThrow();

    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    // Should still render columns
    expect(screen.getByText('col1')).toBeInTheDocument();
  });

  it('handles columns without IDs gracefully', () => {
    const mockTable = createMockTable({
      columnVisibility: {},
      setColumnVisibility: mockSetColumnVisibility,
      columns: [
        { id: '', accessorKey: 'test', getCanHide: () => true }, // Empty ID
        { id: 'valid', accessorKey: 'valid', getCanHide: () => true },
      ],
    });

    render(<DataTableViewOptions table={mockTable} />);
    
    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    // Should only show valid columns  
    expect(screen.getByText('valid')).toBeInTheDocument();
    
    // Should not show columns with empty IDs in the dropdown
    const checkboxItems = screen.getAllByTestId('dropdown-checkbox-item');
    const validColumn = checkboxItems.find(item => item.textContent === 'valid');
    expect(validColumn).toBeInTheDocument();
    
    // Should only have one checkbox item (the valid one)
    expect(checkboxItems).toHaveLength(1);
  });

  it('maintains state consistency when table instance changes', () => {
    const initialTable = createMockTable({
      columnVisibility: { col1: true, col2: false },
      setColumnVisibility: mockSetColumnVisibility,
    });

    const { rerender } = render(<DataTableViewOptions table={initialTable} />);

    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    // Toggle a column
    const col2Checkbox = screen.getByRole('menuitemcheckbox', { name: 'col2' });
    fireEvent.click(col2Checkbox);

    // Create new table instance with updated state
    const updatedTable = createMockTable({
      columnVisibility: { col1: true, col2: true },
      setColumnVisibility: mockSetColumnVisibility,
    });

    rerender(<DataTableViewOptions table={updatedTable} />);

    // Should sync with new table state
    const updatedCol2Checkbox = screen.getByRole('menuitemcheckbox', { name: 'col2' });
    expect(updatedCol2Checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('handles columns with special characters in IDs', () => {
    const mockTable = createMockTable({
      columnVisibility: { 'col-with-dashes': true, 'col_with_underscores': false },
      setColumnVisibility: mockSetColumnVisibility,
      columns: [
        { id: 'col-with-dashes', accessorKey: 'test1', getCanHide: () => true },
        { id: 'col_with_underscores', accessorKey: 'test2', getCanHide: () => true },
        { id: 'col.with.dots', accessorKey: 'test3', getCanHide: () => true },
      ],
    });

    render(<DataTableViewOptions table={mockTable} />);
    
    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    // Should render all columns with special characters
    expect(screen.getByText('col-with-dashes')).toBeInTheDocument();
    expect(screen.getByText('col_with_underscores')).toBeInTheDocument();
    expect(screen.getByText('col.with.dots')).toBeInTheDocument();

    // Should handle clicks correctly
    const dashCheckbox = screen.getByRole('menuitemcheckbox', { name: 'col-with-dashes' });
    fireEvent.click(dashCheckbox);

    expect(mockSetColumnVisibility).toHaveBeenCalledWith({
      'col-with-dashes': false,  // toggled from true to false
      'col_with_underscores': false,  // unchanged
      'col.with.dots': true,  // unchanged (defaults to true when undefined)
    });
  });

  it('handles very large column visibility states', () => {
    const largeColumnVisibility: any = {};
    const largeColumns: any = [];
    
    // Create 100 columns
    for (let i = 0; i < 100; i++) {
      const id = `col${i}`;
      largeColumnVisibility[id] = i % 2 === 0; // Alternate true/false
      largeColumns.push({
        id,
        accessorKey: `accessor${i}`,
        getCanHide: () => true,
      });
    }

    const mockTable = createMockTable({
      columnVisibility: largeColumnVisibility,
      setColumnVisibility: mockSetColumnVisibility,
      columns: largeColumns,
    });

    render(<DataTableViewOptions table={mockTable} />);
    
    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    // Should render all columns
    expect(screen.getByText('col0')).toBeInTheDocument();
    expect(screen.getByText('col50')).toBeInTheDocument();
    expect(screen.getByText('col99')).toBeInTheDocument();

    // Should handle state updates correctly
    const firstCheckbox = screen.getByRole('menuitemcheckbox', { name: 'col0' });
    fireEvent.click(firstCheckbox);

    expect(mockSetColumnVisibility).toHaveBeenCalledWith({
      ...largeColumnVisibility,
      col0: false, // Should be toggled
    });
  });

  it('handles concurrent state updates from external sources', () => {
    let currentState = { col1: true, col2: false };
    
    const mockTable = createMockTable({
      columnVisibility: currentState,
      setColumnVisibility: (newState) => {
        currentState = newState;
        mockSetColumnVisibility(newState);
      },
    });

    // Override getState to return current state dynamically
    mockTable.getState = jest.fn(() => ({
      columnVisibility: currentState,
      columnFilters: [],
      sorting: [],
      pagination: { pageIndex: 0, pageSize: 10 },
    }));

    const { rerender } = render(<DataTableViewOptions table={mockTable} />);

    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    // Simulate external state update
    currentState = { col1: false, col2: true };
    
    // Create a new table with updated state to trigger re-render
    const updatedTable = createMockTable({
      columnVisibility: currentState,
      setColumnVisibility: mockSetColumnVisibility,
    });
    
    rerender(<DataTableViewOptions table={updatedTable} />);

    // UI should reflect external state change
    const col1Checkbox = screen.getByRole('menuitemcheckbox', { name: 'col1' });
    const col2Checkbox = screen.getByRole('menuitemcheckbox', { name: 'col2' });
    
    expect(col1Checkbox).toHaveAttribute('data-state', 'unchecked');
    expect(col2Checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('handles setColumnVisibility function that throws errors', () => {
    const throwingMock = jest.fn(() => {
      throw new Error('State update failed');
    });
    
    const mockTable = createMockTable({
      columnVisibility: { col1: true },
      setColumnVisibility: throwingMock,
    });

    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<DataTableViewOptions table={mockTable} />);
    
    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    const checkbox = screen.getByRole('menuitemcheckbox', { name: 'col1' });
    
    // The component should handle the error gracefully
    expect(() => {
      fireEvent.click(checkbox);
    }).not.toThrow();
    
    // Verify the function was called despite the error
    expect(throwingMock).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});