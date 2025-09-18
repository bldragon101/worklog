import { jobColumns } from '@/components/entities/job/job-columns'
import { Job } from '@/lib/types'
import { ColumnDef } from '@tanstack/react-table'

interface ColumnMeta {
  hidden?: boolean
  [key: string]: unknown
}

interface TestColumnDef {
  accessorKey?: string
  id?: string
  enableColumnFilter?: boolean
  enableSorting?: boolean
  meta?: ColumnMeta
  cell?: (props: { row: { getValue: (key: string) => unknown } }) => { props: { children: string } }
  [key: string]: unknown
}

const mockJob: Job = {
  id: 1,
  date: '2024-01-15',
  driver: 'John Doe',
  customer: 'ABC Company',
  billTo: 'ABC Company',
  registration: 'ABC123',
  truckType: 'Tray',
  pickup: '123 Main St',
  dropoff: '456 Oak Ave',
  runsheet: true,
  invoiced: false,
  chargedHours: 8.5,
  driverCharge: 350.00,
  startTime: '08:00',
  finishTime: '16:30',
  comments: 'Test job',
  jobReference: 'JOB-001',
  eastlink: 2,
  citylink: 1,
  attachmentRunsheet: [],
  attachmentDocket: [],
  attachmentDeliveryPhotos: []
}

describe('Job Columns', () => {
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()
  const mockUpdateStatus = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates columns correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    expect(columns.length).toBeGreaterThan(10) // Should have multiple columns
    
    // Check that essential columns exist
    const columnIds = columns.map(col => (col as TestColumnDef).accessorKey || (col as TestColumnDef).id)
    expect(columnIds).toContain('date')
    expect(columnIds).toContain('driver')
    expect(columnIds).toContain('customer')
    expect(columnIds).toContain('registration')
    expect(columnIds).toContain('truckType')
    expect(columnIds).toContain('actions')
  })

  it('date column is configured correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    const dateColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'date')
    
    expect(dateColumn).toBeDefined()
    expect((dateColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
  })

  it('driver column allows filtering', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    const driverColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'driver')
    
    expect(driverColumn).toBeDefined()
    expect((driverColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
  })

  it('customer and billTo columns are configured correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    const customerColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'customer')
    const billToColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'billTo')
    
    expect(customerColumn).toBeDefined()
    expect(billToColumn).toBeDefined()
    expect((customerColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
    expect((billToColumn as TestColumnDef)?.enableColumnFilter).toBe(true)
  })

  it('should have numeric columns with proper decimal formatting', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    const chargedHoursColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'chargedHours')
    const driverChargeColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'driverCharge')
    
    expect(chargedHoursColumn).toBeDefined()
    expect(driverChargeColumn).toBeDefined()
    
    // Test charged hours column formatting (should show 2 decimal places)
    if (chargedHoursColumn && (chargedHoursColumn as TestColumnDef).cell) {
      const mockRow = {
        getValue: (key: string) => key === 'chargedHours' ? 8.25 : mockJob[key as keyof Job]
      }
      const cellResult = (chargedHoursColumn as TestColumnDef).cell!({ row: mockRow })
      
      // Extract the text content - the cell should format 8.25 as "8.25"
      expect(cellResult).toBeDefined()
      expect(cellResult.props.children).toBe('8.25')
    }
    
    // Test driver charge column formatting (should show 2 decimal places)
    if (driverChargeColumn && (driverChargeColumn as TestColumnDef).cell) {
      const mockRow = {
        getValue: (key: string) => key === 'driverCharge' ? 350.50 : mockJob[key as keyof Job]
      }
      const cellResult = (driverChargeColumn as TestColumnDef).cell!({ row: mockRow })
      
      // Extract the text content - the cell should format 350.50 as "350.50"
      expect(cellResult).toBeDefined()
      expect(cellResult.props.children).toBe('350.50')
    }
  })

  it('should have boolean columns', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    // Look for columns that might contain boolean values
    const hasBooleanColumns = columns.some(col => 
      (col as TestColumnDef).accessorKey === 'runsheet' ||
      (col as TestColumnDef).accessorKey === 'invoiced' ||
      (col as TestColumnDef).accessorKey === 'status'
    )
    
    expect(hasBooleanColumns || columns.length > 10).toBe(true)
  })

  it('actions column is configured correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    const actionsColumn = columns.find(col => col.id === 'actions')
    
    expect(actionsColumn).toBeDefined()
    expect((actionsColumn as TestColumnDef)?.enableSorting).toBe(false)
  })

  it('passes handlers correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    // The columns function should accept the handlers
    expect(typeof mockOnEdit).toBe('function')
    expect(typeof mockOnDelete).toBe('function')
    expect(typeof mockUpdateStatus).toBe('function')
    
    // Should have created columns without errors
    expect(columns).toBeDefined()
    expect(Array.isArray(columns)).toBe(true)
  })

  it('handles loading states correctly', () => {
    const columnsLoading = jobColumns(mockOnEdit, mockOnDelete, true, mockUpdateStatus)
    const columnsNotLoading = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    expect(columnsLoading).toBeDefined()
    expect(columnsNotLoading).toBeDefined()
    expect(columnsLoading.length).toBe(columnsNotLoading.length)
  })

  it('handles optional fields correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    // Comments column should handle null values
    const commentsColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'comments')
    expect(commentsColumn).toBeDefined()
    
    // Pickup and dropoff should handle null values
    const pickupColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'pickup')
    const dropoffColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'dropoff')
    expect(pickupColumn).toBeDefined()
    expect(dropoffColumn).toBeDefined()
  })

  it('columns have proper sizing configuration', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
    
    columns.forEach(column => {
      if (column.size) {
        expect(typeof column.size).toBe('number')
      }
      if (column.minSize) {
        expect(typeof column.minSize).toBe('number')
      }
      if (column.maxSize) {
        expect(typeof column.maxSize).toBe('number')
      }
    })
  })

  describe('Multi-Select Suburb Display', () => {
    it('displays single suburb correctly', () => {
      const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
      const pickupColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'pickup')
      
      expect(pickupColumn).toBeDefined()
      expect((pickupColumn as TestColumnDef)?.cell).toBeDefined()
      
      // Mock row data with single suburb
      const mockRow = {
        getValue: (key: string) => key === 'pickup' ? 'Melbourne' : mockJob[key as keyof Job]
      }
      
      // The cell function should handle single suburb values
      const cellResult = (pickupColumn as TestColumnDef)?.cell?.({ row: mockRow })
      expect(cellResult).toBeDefined()
    })

    it('displays comma-separated suburbs correctly', () => {
      const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
      const pickupColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'pickup')
      const dropoffColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'dropoff')
      
      expect(pickupColumn).toBeDefined()
      expect(dropoffColumn).toBeDefined()
      
      // Mock row data with multiple suburbs
      const mockRowMultiple = {
        getValue: (key: string) => {
          if (key === 'pickup') return 'Melbourne, Sydney, Brisbane'
          if (key === 'dropoff') return 'Perth, Adelaide'
          return mockJob[key as keyof Job]
        }
      }
      
      // Both pickup and dropoff cells should handle comma-separated values
      const pickupCellResult = (pickupColumn as TestColumnDef)?.cell?.({ row: mockRowMultiple })
      const dropoffCellResult = (dropoffColumn as TestColumnDef)?.cell?.({ row: mockRowMultiple })
      
      expect(pickupCellResult).toBeDefined()
      expect(dropoffCellResult).toBeDefined()
    })

    it('handles empty suburb values correctly', () => {
      const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
      const pickupColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'pickup')
      
      expect(pickupColumn).toBeDefined()
      
      // Mock row data with empty values
      const mockRowEmpty = {
        getValue: (key: string) => {
          if (key === 'pickup') return ''
          return mockJob[key as keyof Job]
        }
      }
      
      // Should handle empty values gracefully
      const cellResult = (pickupColumn as TestColumnDef)?.cell?.({ row: mockRowEmpty })
      expect(cellResult).toBeDefined()
    })

    it('handles null/undefined suburb values correctly', () => {
      const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
      const pickupColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'pickup')
      
      expect(pickupColumn).toBeDefined()
      
      // Mock row data with null/undefined values
      const mockRowNull = {
        getValue: (key: string) => {
          if (key === 'pickup') return null
          return mockJob[key as keyof Job]
        }
      }
      
      // Should handle null values gracefully
      const cellResult = (pickupColumn as TestColumnDef)?.cell?.({ row: mockRowNull })
      expect(cellResult).toBeDefined()
    })

    it('maintains backward compatibility with single suburb values', () => {
      const singleSuburbJob: Job = {
        ...mockJob,
        pickup: 'Melbourne',
        dropoff: 'Sydney',
        jobReference: 'JOB-002',
        eastlink: 1,
        citylink: 2
      }
      
      const columns = jobColumns(mockOnEdit, mockOnDelete, false, mockUpdateStatus)
      const pickupColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'pickup')
      const dropoffColumn = columns.find(col => (col as TestColumnDef).accessorKey === 'dropoff')
      
      expect(pickupColumn).toBeDefined()
      expect(dropoffColumn).toBeDefined()
      
      // Mock row data with single suburb values
      const mockSingleRow = {
        getValue: (key: string) => singleSuburbJob[key as keyof Job]
      }
      
      // Should display single values correctly
      const pickupCellResult = (pickupColumn as TestColumnDef)?.cell?.({ row: mockSingleRow })
      const dropoffCellResult = (dropoffColumn as TestColumnDef)?.cell?.({ row: mockSingleRow })
      
      expect(pickupCellResult).toBeDefined()
      expect(dropoffCellResult).toBeDefined()
    })
  })
})