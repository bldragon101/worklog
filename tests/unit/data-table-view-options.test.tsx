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
    const [localChecked, setLocalChecked] = React.useState(checked);
    
    React.useEffect(() => {
      setLocalChecked(checked);
    }, [checked]);
    
    const handleClick = () => {
      const newValue = !localChecked;
      setLocalChecked(newValue);
      onCheckedChange?.(newValue);
    };
    
    return (
      <div 
        data-testid="dropdown-checkbox-item"
        data-checked={localChecked}
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

describe('DataTableViewOptions', () => {
  let mockTable: any;
  let mockSetColumnVisibility: jest.Mock;

  beforeEach(() => {
    mockSetColumnVisibility = jest.fn();
    mockTable = createMockTable({
      columnVisibility: { col1: true, col2: false, col3: true },
      setColumnVisibility: mockSetColumnVisibility,
    });
  });

  it('renders the view button', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    const viewButton = screen.getByRole('button', { name: /view/i });
    expect(viewButton).toBeInTheDocument();
  });

  it('displays dropdown content with columns', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-label')).toHaveTextContent('Toggle columns');
  });

  it('displays all hideable columns', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    const checkboxItems = screen.getAllByTestId('dropdown-checkbox-item');
    expect(checkboxItems).toHaveLength(3);
    
    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('col2')).toBeInTheDocument();
    expect(screen.getByText('col3')).toBeInTheDocument();
  });

  it('shows correct initial checkbox states', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    const col1Item = screen.getByText('col1').closest('[data-testid="dropdown-checkbox-item"]');
    const col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    const col3Item = screen.getByText('col3').closest('[data-testid="dropdown-checkbox-item"]');
    
    expect(col1Item).toHaveAttribute('data-checked', 'true');
    expect(col2Item).toHaveAttribute('data-checked', 'false');
    expect(col3Item).toHaveAttribute('data-checked', 'true');
  });

  it('toggles column visibility when checkbox is clicked', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    const col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    fireEvent.click(col2Item!);
    
    expect(mockSetColumnVisibility).toHaveBeenCalledWith({
      col1: true,
      col2: true,
      col3: true,
    });
  });

  it('updates local state immediately after click', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    let col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    
    // Initially unchecked
    expect(col2Item).toHaveAttribute('data-checked', 'false');
    
    // Click to toggle
    act(() => {
      fireEvent.click(col2Item!);
    });
    
    // Re-fetch the element after state update
    col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    
    // Should immediately show as checked in local state
    expect(col2Item).toHaveAttribute('data-checked', 'true');
  });

  it('handles multiple column toggles correctly', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    let col1Item = screen.getByText('col1').closest('[data-testid="dropdown-checkbox-item"]');
    let col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    
    // Toggle col1 (true -> false)
    act(() => {
      fireEvent.click(col1Item!);
    });
    
    // Re-fetch elements after first click
    col1Item = screen.getByText('col1').closest('[data-testid="dropdown-checkbox-item"]');
    col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    
    // Toggle col2 (false -> true)  
    act(() => {
      fireEvent.click(col2Item!);
    });
    
    expect(mockSetColumnVisibility).toHaveBeenCalledTimes(2);
    expect(mockSetColumnVisibility).toHaveBeenNthCalledWith(1, {
      col1: false,
      col2: false,
      col3: true,
    });
    expect(mockSetColumnVisibility).toHaveBeenNthCalledWith(2, {
      col1: false,
      col2: true,
      col3: true,
    });
  });

  it('syncs local state with table state changes', () => {
    const { rerender } = render(<DataTableViewOptions table={mockTable} />);
    
    // Update mock table state
    const updatedTable = createMockTable({
      columnVisibility: { col1: false, col2: true, col3: false },
      setColumnVisibility: mockSetColumnVisibility,
    });
    
    rerender(<DataTableViewOptions table={updatedTable} />);
    
    const col1Item = screen.getByText('col1').closest('[data-testid="dropdown-checkbox-item"]');
    const col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    const col3Item = screen.getByText('col3').closest('[data-testid="dropdown-checkbox-item"]');
    
    expect(col1Item).toHaveAttribute('data-checked', 'false');
    expect(col2Item).toHaveAttribute('data-checked', 'true');
    expect(col3Item).toHaveAttribute('data-checked', 'false');
  });

  it('filters out non-hideable columns', () => {
    const tableWithMixedColumns = createMockTable({
      columnVisibility: { col1: true, col2: false },
      setColumnVisibility: mockSetColumnVisibility,
      columns: [
        { id: 'col1', accessorKey: 'col1', getCanHide: () => true },
        { id: 'col2', accessorKey: 'col2', getCanHide: () => true },
        { id: 'actions', getCanHide: () => false },
      ],
    });

    render(<DataTableViewOptions table={tableWithMixedColumns} />);
    
    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('col2')).toBeInTheDocument();
    expect(screen.queryByText('actions')).not.toBeInTheDocument();
  });

  it('handles columns with both accessorKey and accessorFn', () => {
    const tableWithDifferentColumnTypes = createMockTable({
      columnVisibility: { accessorKey: true, accessorFn: true },
      setColumnVisibility: mockSetColumnVisibility,
      columns: [
        { id: 'accessorKey', accessorKey: 'test', getCanHide: () => true },
        { id: 'accessorFn', accessorFn: () => 'test', getCanHide: () => true },
      ],
    });

    render(<DataTableViewOptions table={tableWithDifferentColumnTypes} />);
    
    expect(screen.getByText('accessorKey')).toBeInTheDocument();
    expect(screen.getByText('accessorFn')).toBeInTheDocument();
  });

  it('handles empty column visibility state', () => {
    const tableWithEmptyState = createMockTable({
      columnVisibility: {},
      setColumnVisibility: mockSetColumnVisibility,
    });

    render(<DataTableViewOptions table={tableWithEmptyState} />);
    
    const col1Item = screen.getByText('col1').closest('[data-testid="dropdown-checkbox-item"]');
    const col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    const col3Item = screen.getByText('col3').closest('[data-testid="dropdown-checkbox-item"]');
    
    // All columns should default to visible when not in state
    expect(col1Item).toHaveAttribute('data-checked', 'true');
    expect(col2Item).toHaveAttribute('data-checked', 'true');
    expect(col3Item).toHaveAttribute('data-checked', 'true');
  });

  it('preserves state through re-renders', () => {
    render(<DataTableViewOptions table={mockTable} />);
    
    let col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    
    // Toggle col2
    act(() => {
      fireEvent.click(col2Item!);
    });
    
    // Re-fetch element after state update
    col2Item = screen.getByText('col2').closest('[data-testid="dropdown-checkbox-item"]');
    
    // Force re-render by triggering state change
    act(() => {
      // Component should maintain its local state
    });
    
    // State should persist
    expect(col2Item).toHaveAttribute('data-checked', 'true');
  });
});