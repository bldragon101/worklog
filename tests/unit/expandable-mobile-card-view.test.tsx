import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExpandableMobileCardView } from '@/components/data-table/mobile/expandable-mobile-card-view';

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div data-testid="card" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string; [key: string]: unknown }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, disabled, onClick, id }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean; onClick?: () => void; id?: string }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      onClick={onClick}
      id={id}
      data-testid="checkbox"
    />
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="dropdown-item" onClick={onClick}>
      {children}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MoreHorizontal: () => <span data-testid="more-horizontal-icon">⋯</span>,
  Edit: () => <span data-testid="edit-icon">✏️</span>,
  Trash2: () => <span data-testid="trash-icon">🗑️</span>,
  ChevronDown: () => <span data-testid="chevron-down-icon">▼</span>,
  ChevronUp: () => <span data-testid="chevron-up-icon">▲</span>,
  Paperclip: () => <span data-testid="paperclip-icon">📎</span>,
}));

// Mock JobAttachmentViewer component
vi.mock('@/components/ui/job-attachment-viewer', () => ({
  JobAttachmentViewer: ({ attachments, jobId }: { attachments: { runsheet: string[]; docket: string[]; delivery_photos: string[] }; jobId: number }) => (
    <div data-testid="job-attachment-viewer">
      <span>Attachments for job {jobId}</span>
      {attachments.runsheet.length > 0 && <span data-testid="runsheet-attachments">Runsheet: {attachments.runsheet.length}</span>}
      {attachments.docket.length > 0 && <span data-testid="docket-attachments">Docket: {attachments.docket.length}</span>}
      {attachments.delivery_photos.length > 0 && <span data-testid="photos-attachments">Photos: {attachments.delivery_photos.length}</span>}
    </div>
  ),
}));

const mockData = [
  {
    id: 1,
    date: '2024-01-15',
    customer: 'Test Customer',
    driver: 'John Doe',
    truckType: 'Tray',
    runsheet: false,
    invoiced: true,
    billTo: 'Test Bill To',
    registration: 'ABC123',
    pickup: 'Test Pickup',
    dropoff: 'Test Dropoff',
    startTime: '08:00',
    finishTime: '16:00',
    chargedHours: 8,
    driverCharge: 400,
    comments: 'Test comments',
    attachmentRunsheet: ['runsheet1.pdf', 'runsheet2.pdf'],
    attachmentDocket: ['docket1.pdf'],
    attachmentDeliveryPhotos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
  },
  {
    id: 2,
    date: '2024-01-16',
    customer: 'Another Customer',
    driver: 'Jane Smith',
    truckType: 'Crane',
    runsheet: true,
    invoiced: false,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
];

const mockFields = [
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
  {
    key: 'driver',
    label: 'Driver',
  },
  {
    key: 'truckType',
    label: 'Truck Type',
    isBadge: true,
  },
  {
    key: 'runsheet',
    label: 'Runsheet',
    isCheckbox: true,
    onCheckboxChange: vi.fn(),
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
  {
    key: 'pickup',
    label: 'Pickup Location',
    hideIfEmpty: true,
  },
  {
    key: 'comments',
    label: 'Comments',
    hideIfEmpty: true,
  },
  {
    key: 'attachments',
    label: 'Attachments',
    render: (value: unknown, item: unknown) => {
      const job = item as { attachmentRunsheet: string[]; attachmentDocket: string[]; attachmentDeliveryPhotos: string[] };
      const hasAttachments = job.attachmentRunsheet?.length > 0 || 
                            job.attachmentDocket?.length > 0 || 
                            job.attachmentDeliveryPhotos?.length > 0;
      
      if (!hasAttachments) {
        return 'No attachments';
      }

      // Mobile-friendly attachment summary
      const totalAttachments = job.attachmentRunsheet.length + 
                              job.attachmentDocket.length + 
                              job.attachmentDeliveryPhotos.length;
      
      return (
        <div data-testid="attachment-summary" className="space-y-1 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-medium">{totalAttachments} file{totalAttachments !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            {job.attachmentRunsheet?.length > 0 && (
              <span data-testid="runsheet-count">• Runsheet: {job.attachmentRunsheet.length}</span>
            )}
            {job.attachmentDocket?.length > 0 && (
              <span data-testid="docket-count">• Docket: {job.attachmentDocket.length}</span>
            )}
            {job.attachmentDeliveryPhotos?.length > 0 && (
              <span data-testid="photos-count">• Photos: {job.attachmentDeliveryPhotos.length}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Tap &quot;Attach Files&quot; to view/manage
          </div>
        </div>
      );
    },
  },
];

describe('ExpandableMobileCardView', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnAttachFiles = vi.fn();
  const mockGetItemId = (item: { id: number }) => item.id;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(
      <ExpandableMobileCardView
        data={[]}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        isLoading={true}
      />
    );

    expect(screen.getAllByTestId('card')).toHaveLength(6); // 6 skeleton cards
  });

  it('renders no results message when data is empty', () => {
    render(
      <ExpandableMobileCardView
        data={[]}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        isLoading={false}
      />
    );

    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('renders cards with basic fields', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    expect(screen.getByText('Test Customer')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getAllByTestId('badge')[0]).toHaveTextContent('Tray');
  });

  it('expands card to show additional details when clicked', async () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Initially, expanded details should not be visible
    expect(screen.queryByText('Additional Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Bill To:')).not.toBeInTheDocument();

    // Click the chevron button to expand
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    fireEvent.click(chevronDownButtons[0].closest('button')!);

    // Expanded details should now be visible
    await waitFor(() => {
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
      expect(screen.getByText('Bill To:')).toBeInTheDocument();
      expect(screen.getByText('Test Bill To')).toBeInTheDocument();
    });
  });

  it('toggles expansion state correctly', async () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Get the chevron button
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    const chevronButton = chevronDownButtons[0].closest('button')!;
    
    // Expand
    fireEvent.click(chevronButton);
    await waitFor(() => {
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });

    // Collapse - now the icon should be chevron-up
    const chevronUpButtons = screen.getAllByTestId('chevron-up-icon');
    const chevronUpButton = chevronUpButtons[0].closest('button')!;
    fireEvent.click(chevronUpButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Additional Details')).not.toBeInTheDocument();
    });
  });

  it('shows chevron icons correctly based on expansion state', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Initially should show chevron down
    expect(screen.getAllByTestId('chevron-down-icon')).toHaveLength(2);
    expect(screen.queryAllByTestId('chevron-up-icon')).toHaveLength(0);

    // Click first card's chevron button to expand
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    const firstChevronButton = chevronDownButtons[0].closest('button')!;
    fireEvent.click(firstChevronButton);

    // First card should show chevron up, second should still show chevron down
    expect(screen.getAllByTestId('chevron-down-icon')).toHaveLength(1);
    expect(screen.getAllByTestId('chevron-up-icon')).toHaveLength(1);
  });

  it('handles checkbox changes correctly', () => {
    const mockCheckboxChange = vi.fn();
    const fieldsWithCheckbox = [
      ...mockFields.slice(0, -1),
      {
        ...mockFields[mockFields.length - 1],
        onCheckboxChange: mockCheckboxChange,
      },
    ];

    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={fieldsWithCheckbox}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    const checkboxes = screen.getAllByTestId('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(mockCheckboxChange).toHaveBeenCalledWith(mockData[0], true);
  });

  it('calls onEdit when edit menu item is clicked', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    const editItems = screen.getAllByTestId('dropdown-item');
    const editItem = editItems.find(item => item.textContent?.includes('✏️'));
    
    if (editItem) {
      fireEvent.click(editItem);
      expect(mockOnEdit).toHaveBeenCalledWith(mockData[0]);
    }
  });

  it('calls onDelete when delete menu item is clicked', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    const deleteItems = screen.getAllByTestId('dropdown-item');
    const deleteItem = deleteItems.find(item => item.textContent?.includes('🗑️'));
    
    if (deleteItem) {
      fireEvent.click(deleteItem);
      expect(mockOnDelete).toHaveBeenCalledWith(mockData[0]);
    }
  });

  it('calls onAttachFiles when attach files menu item is clicked', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    const attachItems = screen.getAllByTestId('dropdown-item');
    const attachItem = attachItems.find(item => item.textContent?.includes('📎'));
    
    if (attachItem) {
      fireEvent.click(attachItem);
      expect(mockOnAttachFiles).toHaveBeenCalledWith(mockData[0]);
    }
  });

  it('shows attach files option in dropdown menu', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.getAllByTestId('paperclip-icon')).toHaveLength(2); // One for each card
    expect(screen.getAllByText('Attach Files')).toHaveLength(2); // One for each card
  });

  it('does not show dropdown menu when no actions are provided', () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        getItemId={mockGetItemId}
      />
    );

    expect(screen.queryByTestId('more-horizontal-icon')).not.toBeInTheDocument();
  });

  it('hides expandable fields that are empty when hideIfEmpty is true', async () => {
    const dataWithEmptyFields = [
      {
        ...mockData[0],
        billTo: '', // Empty field
        pickup: null, // Null field
        registration: undefined, // Undefined field
      },
    ];

    render(
      <ExpandableMobileCardView
        data={dataWithEmptyFields}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Click the chevron button to expand
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    fireEvent.click(chevronDownButtons[0].closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });

    // Empty fields should be hidden
    expect(screen.queryByText('Bill To:')).not.toBeInTheDocument();
    expect(screen.queryByText('Pickup Location:')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration:')).not.toBeInTheDocument();

    // Non-empty field should still be shown
    expect(screen.getByText('Comments:')).toBeInTheDocument();
    expect(screen.getByText('Test comments')).toBeInTheDocument();
  });

  it('renders custom field renderers correctly in expandable section', async () => {
    const fieldsWithCustomRender = [
      ...mockExpandableFields,
      {
        key: 'chargedHours',
        label: 'Charged Hours',
        render: (value: unknown) => `${value} hrs`,
      },
    ];

    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={fieldsWithCustomRender}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Click the chevron button to expand
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    fireEvent.click(chevronDownButtons[0].closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
      expect(screen.getByText('8 hrs')).toBeInTheDocument();
    });
  });

  it('displays attachments summary in expanded view when job has attachments', async () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Click the chevron button to expand the first card (which has attachments)
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    fireEvent.click(chevronDownButtons[0].closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
      expect(screen.getByText('Attachments:')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-summary')).toBeInTheDocument();
      expect(screen.getByText('6 files')).toBeInTheDocument();
      expect(screen.getByTestId('runsheet-count')).toHaveTextContent('• Runsheet: 2');
      expect(screen.getByTestId('docket-count')).toHaveTextContent('• Docket: 1');
      expect(screen.getByTestId('photos-count')).toHaveTextContent('• Photos: 3');
      expect(screen.getByText('Tap "Attach Files" to view/manage')).toBeInTheDocument();
    });
  });

  it('shows "No attachments" for jobs without attachments when expanded', async () => {
    render(
      <ExpandableMobileCardView
        data={mockData}
        fields={mockFields}
        expandableFields={mockExpandableFields}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onAttachFiles={mockOnAttachFiles}
        getItemId={mockGetItemId}
      />
    );

    // Click the chevron button to expand the second card (which has no attachments)
    const chevronDownButtons = screen.getAllByTestId('chevron-down-icon');
    fireEvent.click(chevronDownButtons[1].closest('button')!);

    await waitFor(() => {
      const expandedCards = screen.getAllByText('Additional Details');
      expect(expandedCards).toHaveLength(1);
      expect(screen.getByText('Attachments:')).toBeInTheDocument();
      expect(screen.getByText('No attachments')).toBeInTheDocument();
    });
  });
});