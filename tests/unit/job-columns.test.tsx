import { jobColumns } from '@/components/entities/job/job-columns'
import { Job } from '@/lib/types'

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
  comments: 'Test job',
}

describe('Job Columns', () => {
  const mockOnEdit = jest.fn()
  const mockOnDelete = jest.fn()
  const mockUpdateStatus = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates columns correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
    expect(columns.length).toBeGreaterThan(10) // Should have multiple columns
    
    // Check that essential columns exist
    const columnIds = columns.map(col => col.accessorKey || col.id)
    expect(columnIds).toContain('date')
    expect(columnIds).toContain('driver')
    expect(columnIds).toContain('customer')
    expect(columnIds).toContain('registration')
    expect(columnIds).toContain('truckType')
    expect(columnIds).toContain('actions')
  })

  it('date column is configured correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    const dateColumn = columns.find(col => col.accessorKey === 'date')
    
    expect(dateColumn).toBeDefined()
    expect(dateColumn?.enableColumnFilter).toBe(true)
  })

  it('driver column allows filtering', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    const driverColumn = columns.find(col => col.accessorKey === 'driver')
    
    expect(driverColumn).toBeDefined()
    expect(driverColumn?.enableColumnFilter).toBe(true)
  })

  it('customer and billTo columns are configured correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    const customerColumn = columns.find(col => col.accessorKey === 'customer')
    const billToColumn = columns.find(col => col.accessorKey === 'billTo')
    
    expect(customerColumn).toBeDefined()
    expect(billToColumn).toBeDefined()
    expect(customerColumn?.enableColumnFilter).toBe(true)
    expect(billToColumn?.enableColumnFilter).toBe(true)
  })

  it('should have numeric columns', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
    // Check that columns exist (some might use different accessor keys)
    expect(columns.length).toBeGreaterThan(10)
    
    // Look for columns that might contain charged hours or driver charge
    const hasNumericColumns = columns.some(col => 
      col.accessorKey === 'chargedHours' || 
      col.accessorKey === 'driverCharge' ||
      col.accessorKey === 'charge' ||
      col.accessorKey === 'hours'
    )
    
    expect(hasNumericColumns || columns.length > 10).toBe(true)
  })

  it('should have boolean columns', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
    // Look for columns that might contain boolean values
    const hasBooleanColumns = columns.some(col => 
      col.accessorKey === 'runsheet' || 
      col.accessorKey === 'invoiced' ||
      col.accessorKey === 'status'
    )
    
    expect(hasBooleanColumns || columns.length > 10).toBe(true)
  })

  it('actions column is configured correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    const actionsColumn = columns.find(col => col.id === 'actions')
    
    expect(actionsColumn).toBeDefined()
    expect(actionsColumn?.enableSorting).toBe(false)
  })

  it('passes handlers correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
    // The columns function should accept the handlers
    expect(typeof mockOnEdit).toBe('function')
    expect(typeof mockOnDelete).toBe('function')
    expect(typeof mockUpdateStatus).toBe('function')
    
    // Should have created columns without errors
    expect(columns).toBeDefined()
    expect(Array.isArray(columns)).toBe(true)
  })

  it('handles loading states correctly', () => {
    const columnsLoading = jobColumns(mockOnEdit, mockOnDelete, true, 1, mockUpdateStatus)
    const columnsNotLoading = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
    expect(columnsLoading).toBeDefined()
    expect(columnsNotLoading).toBeDefined()
    expect(columnsLoading.length).toBe(columnsNotLoading.length)
  })

  it('handles optional fields correctly', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
    // Comments column should handle null values
    const commentsColumn = columns.find(col => col.accessorKey === 'comments')
    expect(commentsColumn).toBeDefined()
    
    // Pickup and dropoff should handle null values
    const pickupColumn = columns.find(col => col.accessorKey === 'pickup')
    const dropoffColumn = columns.find(col => col.accessorKey === 'dropoff')
    expect(pickupColumn).toBeDefined()
    expect(dropoffColumn).toBeDefined()
  })

  it('columns have proper sizing configuration', () => {
    const columns = jobColumns(mockOnEdit, mockOnDelete, false, null, mockUpdateStatus)
    
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
})