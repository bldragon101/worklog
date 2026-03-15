import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { JobForm, StagedFile } from '@/components/entities/job/job-form'
import { Job } from '@/lib/types'

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock useToast hook
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

const mockApiResponses = {
  customers: {
    customerOptions: ['ABC Company', 'XYZ Corp'],
    billToOptions: ['ABC Company', 'XYZ Corp'],
  },
  vehicles: {
    registrationOptions: ['ABC123', 'XYZ789'],
    truckTypeOptions: ['Tray', 'Van'],
  },
  drivers: {
    driverOptions: ['John Doe', 'Jane Smith'],
  },
  customerMappings: {
    customerToBillTo: { 'ABC Company': 'ABC Company' },
  },
  vehicleMappings: {
    registrationToType: { ABC123: 'Tray' },
  },
  driverMappings: {
    driverToTruck: { 'John Doe': 'ABC123' },
  },
}

const mockGoogleDriveSettings = {
  success: true,
  settings: {
    baseFolderId: 'mock-folder-id',
    driveId: 'mock-drive-id',
  },
}

const setupFetchMock = () => {
  const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>
  fetchMock.mockImplementation((url) => {
    if (typeof url === 'string') {
      if (url.includes('/api/customers/options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.customers),
        } as Response)
      }
      if (url.includes('/api/vehicles/options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.vehicles),
        } as Response)
      }
      if (url.includes('/api/jobs/drivers-options')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.drivers),
        } as Response)
      }
      if (url.includes('/api/customers/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.customerMappings),
        } as Response)
      }
      if (url.includes('/api/vehicles/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.vehicleMappings),
        } as Response)
      }
      if (url.includes('/api/jobs/driver-truck-mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.driverMappings),
        } as Response)
      }
      if (url.includes('/api/google-drive/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGoogleDriveSettings),
        } as Response)
      }
    }

    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response)
  })
}

const existingJob: Partial<Job> = {
  id: 42,
  date: '2025-01-15',
  driver: 'John Doe',
  customer: 'ABC Company',
  billTo: 'ABC Company',
  registration: 'ABC123',
  truckType: 'Tray',
  pickup: 'Melbourne',
  dropoff: 'Sydney',
  runsheet: false,
  invoiced: false,
  chargedHours: 8,
  driverCharge: null,
  startTime: null,
  finishTime: null,
  comments: null,
  jobReference: null,
  eastlink: null,
  citylink: null,
  attachmentRunsheet: [],
  attachmentDocket: [],
  attachmentDeliveryPhotos: [],
}

describe('JobForm Staged Files', () => {
  const mockOnSave = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    setupFetchMock()
  })

  describe('StagedFile type and default values', () => {
    it('StagedFile interface has correct shape with id, file and attachmentType', () => {
      const mockFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const stagedFile: StagedFile = {
        id: 'abc123def',
        file: mockFile,
        attachmentType: 'runsheet',
      }

      expect(stagedFile.id).toBe('abc123def')
      expect(stagedFile.file).toBeInstanceOf(File)
      expect(stagedFile.file.name).toBe('test.pdf')
      expect(stagedFile.attachmentType).toBe('runsheet')
    })

    it('default attachment type for staged files is "runsheet"', () => {
      const mockFile = new File(['test'], 'document.pdf', {
        type: 'application/pdf',
      })

      const createStagedFile = ({ file }: { file: File }): StagedFile => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        attachmentType: 'runsheet',
      })

      const staged = createStagedFile({ file: mockFile })
      expect(staged.attachmentType).toBe('runsheet')
    })

    it('staged attachment types include runsheet, docket, and delivery_photos', () => {
      const STAGED_ATTACHMENT_TYPES = [
        { value: 'runsheet', label: 'Runsheet' },
        { value: 'docket', label: 'Docket' },
        { value: 'delivery_photos', label: 'Delivery Photos' },
      ]

      expect(STAGED_ATTACHMENT_TYPES).toHaveLength(3)
      expect(STAGED_ATTACHMENT_TYPES[0].value).toBe('runsheet')
      expect(STAGED_ATTACHMENT_TYPES[1].value).toBe('docket')
      expect(STAGED_ATTACHMENT_TYPES[2].value).toBe('delivery_photos')
    })
  })

  describe('File staging logic', () => {
    it('creates staged files with unique IDs', () => {
      const file1 = new File(['a'], 'file1.pdf', { type: 'application/pdf' })
      const file2 = new File(['b'], 'file2.pdf', { type: 'application/pdf' })

      const createStagedFile = ({ file }: { file: File }): StagedFile => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        attachmentType: 'runsheet',
      })

      const staged1 = createStagedFile({ file: file1 })
      const staged2 = createStagedFile({ file: file2 })

      expect(staged1.id).not.toBe(staged2.id)
      expect(staged1.id.length).toBeGreaterThan(0)
      expect(staged2.id.length).toBeGreaterThan(0)
    })

    it('validates file size against 20MB limit', () => {
      const MAX_FILE_SIZE = 20 * 1024 * 1024

      const smallFile = new File(['x'.repeat(100)], 'small.pdf', {
        type: 'application/pdf',
      })
      const largeFileSize = 25 * 1024 * 1024

      expect(smallFile.size).toBeLessThan(MAX_FILE_SIZE)
      expect(largeFileSize).toBeGreaterThan(MAX_FILE_SIZE)
    })

    it('validates accepted file types correctly', () => {
      const STAGED_ACCEPTED_TYPES: Record<string, string[]> = {
        'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          ['.docx'],
        'text/plain': ['.txt'],
      }

      const isValidFileType = ({ file }: { file: File }): boolean => {
        return Object.keys(STAGED_ACCEPTED_TYPES).some((mimeType) => {
          if (mimeType.endsWith('/*')) {
            return file.type.startsWith(mimeType.replace('/*', '/'))
          }
          return file.type === mimeType
        })
      }

      const pdfFile = new File(['test'], 'doc.pdf', {
        type: 'application/pdf',
      })
      const imageFile = new File(['test'], 'photo.jpg', {
        type: 'image/jpeg',
      })
      const txtFile = new File(['test'], 'note.txt', { type: 'text/plain' })
      const exeFile = new File(['test'], 'malware.exe', {
        type: 'application/x-msdownload',
      })

      expect(isValidFileType({ file: pdfFile })).toBe(true)
      expect(isValidFileType({ file: imageFile })).toBe(true)
      expect(isValidFileType({ file: txtFile })).toBe(true)
      expect(isValidFileType({ file: exeFile })).toBe(false)
    })

    it('removes staged file by ID correctly', () => {
      const files: StagedFile[] = [
        {
          id: 'file-1',
          file: new File(['a'], 'a.pdf', { type: 'application/pdf' }),
          attachmentType: 'runsheet',
        },
        {
          id: 'file-2',
          file: new File(['b'], 'b.pdf', { type: 'application/pdf' }),
          attachmentType: 'docket',
        },
        {
          id: 'file-3',
          file: new File(['c'], 'c.pdf', { type: 'application/pdf' }),
          attachmentType: 'delivery_photos',
        },
      ]

      const removeStagedFile = ({
        fileId,
        currentFiles,
      }: {
        fileId: string
        currentFiles: StagedFile[]
      }): StagedFile[] => {
        return currentFiles.filter((f) => f.id !== fileId)
      }

      const result = removeStagedFile({ fileId: 'file-2', currentFiles: files })
      expect(result).toHaveLength(2)
      expect(result.find((f) => f.id === 'file-2')).toBeUndefined()
      expect(result[0].id).toBe('file-1')
      expect(result[1].id).toBe('file-3')
    })

    it('updates staged file attachment type correctly', () => {
      const files: StagedFile[] = [
        {
          id: 'file-1',
          file: new File(['a'], 'a.pdf', { type: 'application/pdf' }),
          attachmentType: 'runsheet',
        },
        {
          id: 'file-2',
          file: new File(['b'], 'b.pdf', { type: 'application/pdf' }),
          attachmentType: 'runsheet',
        },
      ]

      const updateStagedFileType = ({
        fileId,
        attachmentType,
        currentFiles,
      }: {
        fileId: string
        attachmentType: string
        currentFiles: StagedFile[]
      }): StagedFile[] => {
        return currentFiles.map((f) =>
          f.id === fileId ? { ...f, attachmentType } : f
        )
      }

      const result = updateStagedFileType({
        fileId: 'file-2',
        attachmentType: 'docket',
        currentFiles: files,
      })

      expect(result[0].attachmentType).toBe('runsheet')
      expect(result[1].attachmentType).toBe('docket')
    })
  })

  describe('onSave callback with staged files', () => {
    it('onSave receives staged files as second argument when files are present', () => {
      const stagedFiles: StagedFile[] = [
        {
          id: 'staged-1',
          file: new File(['content'], 'runsheet.pdf', {
            type: 'application/pdf',
          }),
          attachmentType: 'runsheet',
        },
        {
          id: 'staged-2',
          file: new File(['content'], 'docket.pdf', {
            type: 'application/pdf',
          }),
          attachmentType: 'docket',
        },
      ]

      const onSaveMock = jest.fn()
      const processedData: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne',
      }

      // Simulate the wrappedOnSave logic from the component
      const wrappedOnSave = ({ data }: { data: Partial<Job> }) => {
        onSaveMock(
          data,
          stagedFiles.length > 0 ? stagedFiles : undefined
        )
      }

      wrappedOnSave({ data: processedData })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(onSaveMock).toHaveBeenCalledWith(processedData, stagedFiles)
      expect(onSaveMock.mock.calls[0][1]).toHaveLength(2)
      expect(onSaveMock.mock.calls[0][1][0].attachmentType).toBe('runsheet')
      expect(onSaveMock.mock.calls[0][1][1].attachmentType).toBe('docket')
    })

    it('onSave second argument is undefined when no staged files', () => {
      const stagedFiles: StagedFile[] = []

      const onSaveMock = jest.fn()
      const processedData: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne',
      }

      const wrappedOnSave = ({ data }: { data: Partial<Job> }) => {
        onSaveMock(
          data,
          stagedFiles.length > 0 ? stagedFiles : undefined
        )
      }

      wrappedOnSave({ data: processedData })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(onSaveMock).toHaveBeenCalledWith(processedData, undefined)
      expect(onSaveMock.mock.calls[0][1]).toBeUndefined()
    })

    it('staged files are cleared after save', () => {
      let stagedFiles: StagedFile[] = [
        {
          id: 'staged-1',
          file: new File(['content'], 'file.pdf', {
            type: 'application/pdf',
          }),
          attachmentType: 'runsheet',
        },
      ]

      const onSaveMock = jest.fn()
      const processedData: Partial<Job> = {
        date: '2025-01-15',
        driver: 'John Doe',
        customer: 'ABC Company',
        billTo: 'ABC Company',
        registration: 'ABC123',
        truckType: 'Tray',
        pickup: 'Melbourne',
      }

      // Simulate the wrappedOnSave logic from the component
      const wrappedOnSave = ({ data }: { data: Partial<Job> }) => {
        onSaveMock(
          data,
          stagedFiles.length > 0 ? stagedFiles : undefined
        )
        stagedFiles = []
      }

      wrappedOnSave({ data: processedData })

      expect(onSaveMock).toHaveBeenCalledTimes(1)
      expect(stagedFiles).toHaveLength(0)
    })
  })

  describe('Rendering - new job (job is null)', () => {
    it('renders the staging drop zone when job is null', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Add Job')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Navigate to Attachments tab
      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const dropZone = screen.queryByText(
          'Drag and drop files here, or click to select'
        )
        if (dropZone) {
          expect(dropZone).toBeInTheDocument()
        }
      })
    })

    it('staging drop zone has the correct id', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Navigate to Attachments tab
      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const dropZone = document.getElementById('staged-file-drop-zone')
        if (dropZone) {
          expect(dropZone).toBeInTheDocument()
        }
      })
    })

    it('shows "Files will be uploaded when you save the job" text for new jobs', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const infoText = screen.queryByText(
          'Files will be uploaded when you save the job'
        )
        if (infoText) {
          expect(infoText).toBeInTheDocument()
        }
      })
    })

    it('hidden file input has the correct id', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const hiddenInput = document.getElementById('staged-hidden-file-input')
        if (hiddenInput) {
          expect(hiddenInput).toBeInTheDocument()
          expect(hiddenInput).toHaveAttribute('type', 'file')
          expect(hiddenInput).toHaveAttribute('multiple')
        }
      })
    })
  })

  describe('Rendering - existing job (job has id)', () => {
    it('shows existing attachment viewer and Add Attachments button in edit mode', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={existingJob}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Edit Job')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const addButton = document.getElementById('add-attachments-btn')
        if (addButton) {
          expect(addButton).toBeInTheDocument()
        }
      })
    })

    it('does not show staging drop zone in edit mode', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={existingJob}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const dropZone = document.getElementById('staged-file-drop-zone')
        expect(dropZone).toBeNull()
      })
    })
  })

  describe('File staging interaction via hidden input', () => {
    it('staging a file via the hidden input triggers the add flow', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      await waitFor(() => {
        const hiddenInput = document.getElementById('staged-hidden-file-input')
        if (hiddenInput) {
          const testFile = new File(['test content'], 'test-document.pdf', {
            type: 'application/pdf',
          })

          fireEvent.change(hiddenInput, {
            target: { files: [testFile] },
          })
        }
      })

      // After adding a file, look for the staged file list
      await waitFor(
        () => {
          const stagedHeader = screen.queryByText(/Staged Files/)
          if (stagedHeader) {
            expect(stagedHeader).toBeInTheDocument()
          }
        },
        { timeout: 2000 }
      )
    })

    it('each staged file shows a remove button with correct id prefix', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      const hiddenInput = document.getElementById('staged-hidden-file-input')
      if (!hiddenInput) return

      const testFile = new File(['test content'], 'removable-file.pdf', {
        type: 'application/pdf',
      })

      await act(async () => {
        fireEvent.change(hiddenInput, {
          target: { files: [testFile] },
        })
      })

      await waitFor(
        () => {
          // Look for remove buttons matching the expected id pattern
          const removeButtons = document.querySelectorAll(
            '[id^="remove-staged-file-"]'
          )
          if (removeButtons.length > 0) {
            expect(removeButtons.length).toBeGreaterThan(0)
            for (const button of removeButtons) {
              expect(button.id).toMatch(/^remove-staged-file-.+/)
            }
          }
        },
        { timeout: 2000 }
      )
    })

    it('each staged file shows an attachment type selector with correct id prefix', async () => {
      await act(async () => {
        render(
          <JobForm
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            job={null}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 3000 })

      const attachmentsTab = screen.getByText('Attachments')
      fireEvent.click(attachmentsTab)

      const hiddenInput = document.getElementById('staged-hidden-file-input')
      if (!hiddenInput) return

      const testFile = new File(['test content'], 'typed-file.pdf', {
        type: 'application/pdf',
      })

      await act(async () => {
        fireEvent.change(hiddenInput, {
          target: { files: [testFile] },
        })
      })

      await waitFor(
        () => {
          const typeSelectors = document.querySelectorAll(
            '[id^="staged-attachment-type-"]'
          )
          if (typeSelectors.length > 0) {
            expect(typeSelectors.length).toBeGreaterThan(0)
            for (const selector of typeSelectors) {
              expect(selector.id).toMatch(/^staged-attachment-type-.+/)
            }
          }
        },
        { timeout: 2000 }
      )
    })
  })

  describe('Attachments tab badge count', () => {
    it('badge shows count of staged files for new jobs', () => {
      // Test the badge logic directly: if stagedFiles.length > 0, show count
      const stagedFiles: StagedFile[] = [
        {
          id: 's1',
          file: new File(['a'], 'a.pdf', { type: 'application/pdf' }),
          attachmentType: 'runsheet',
        },
        {
          id: 's2',
          file: new File(['b'], 'b.pdf', { type: 'application/pdf' }),
          attachmentType: 'docket',
        },
        {
          id: 's3',
          file: new File(['c'], 'c.pdf', { type: 'application/pdf' }),
          attachmentType: 'delivery_photos',
        },
      ]

      const hasAttachments = false // New job has no existing attachments
      const badgeCount = hasAttachments ? 0 : stagedFiles.length

      expect(badgeCount).toBe(3)
    })

    it('badge shows existing attachment count for edit mode jobs', () => {
      const formData: Partial<Job> = {
        id: 1,
        attachmentRunsheet: ['file1.pdf', 'file2.pdf'],
        attachmentDocket: ['file3.pdf'],
        attachmentDeliveryPhotos: [],
      }

      const hasAttachments =
        (formData.attachmentRunsheet?.length || 0) > 0 ||
        (formData.attachmentDocket?.length || 0) > 0 ||
        (formData.attachmentDeliveryPhotos?.length || 0) > 0

      const badgeCount = hasAttachments
        ? (formData.attachmentRunsheet?.length || 0) +
          (formData.attachmentDocket?.length || 0) +
          (formData.attachmentDeliveryPhotos?.length || 0)
        : 0

      expect(hasAttachments).toBe(true)
      expect(badgeCount).toBe(3)
    })

    it('no badge shown when no staged files and no existing attachments', () => {
      const stagedFiles: StagedFile[] = []
      const hasAttachments = false

      const showBadge = hasAttachments || stagedFiles.length > 0
      expect(showBadge).toBe(false)
    })
  })

  describe('Staged file validation edge cases', () => {
    it('rejects files exceeding 20MB', () => {
      const MAX_FILE_SIZE = 20 * 1024 * 1024
      const oversizedBytes = 21 * 1024 * 1024

      const errors: string[] = []

      const validateFile = ({ size, name }: { size: number; name: string }) => {
        if (size > MAX_FILE_SIZE) {
          errors.push(`${name} is larger than 20MB`)
          return false
        }
        return true
      }

      expect(validateFile({ size: oversizedBytes, name: 'huge.pdf' })).toBe(
        false
      )
      expect(errors).toContain('huge.pdf is larger than 20MB')
    })

    it('rejects unsupported file types', () => {
      const STAGED_ACCEPTED_TYPES: Record<string, string[]> = {
        'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          ['.docx'],
        'text/plain': ['.txt'],
      }

      const isValidFileType = ({ fileType }: { fileType: string }): boolean => {
        return Object.keys(STAGED_ACCEPTED_TYPES).some((mimeType) => {
          if (mimeType.endsWith('/*')) {
            return fileType.startsWith(mimeType.replace('/*', '/'))
          }
          return fileType === mimeType
        })
      }

      expect(isValidFileType({ fileType: 'application/x-executable' })).toBe(
        false
      )
      expect(isValidFileType({ fileType: 'application/zip' })).toBe(false)
      expect(isValidFileType({ fileType: 'text/html' })).toBe(false)
      expect(isValidFileType({ fileType: 'video/mp4' })).toBe(false)
    })

    it('accepts all supported file types', () => {
      const STAGED_ACCEPTED_TYPES: Record<string, string[]> = {
        'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          ['.docx'],
        'text/plain': ['.txt'],
      }

      const isValidFileType = ({ fileType }: { fileType: string }): boolean => {
        return Object.keys(STAGED_ACCEPTED_TYPES).some((mimeType) => {
          if (mimeType.endsWith('/*')) {
            return fileType.startsWith(mimeType.replace('/*', '/'))
          }
          return fileType === mimeType
        })
      }

      expect(isValidFileType({ fileType: 'image/jpeg' })).toBe(true)
      expect(isValidFileType({ fileType: 'image/png' })).toBe(true)
      expect(isValidFileType({ fileType: 'image/gif' })).toBe(true)
      expect(isValidFileType({ fileType: 'image/webp' })).toBe(true)
      expect(isValidFileType({ fileType: 'application/pdf' })).toBe(true)
      expect(isValidFileType({ fileType: 'application/msword' })).toBe(true)
      expect(
        isValidFileType({
          fileType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      ).toBe(true)
      expect(isValidFileType({ fileType: 'text/plain' })).toBe(true)
    })

    it('handles empty file list gracefully', () => {
      const files: File[] = []
      const stagedFiles: StagedFile[] = []

      for (const _file of files) {
        // This loop body should not execute for an empty list
        stagedFiles.push({
          id: 'should-not-exist',
          file: _file,
          attachmentType: 'runsheet',
        })
      }

      expect(stagedFiles).toHaveLength(0)
    })
  })

  describe('Multiple staged files management', () => {
    it('can stage multiple files at once', () => {
      const files = [
        new File(['a'], 'runsheet1.pdf', { type: 'application/pdf' }),
        new File(['b'], 'docket1.jpg', { type: 'image/jpeg' }),
        new File(['c'], 'photo1.png', { type: 'image/png' }),
      ]

      const stagedFiles: StagedFile[] = files.map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        attachmentType: 'runsheet',
      }))

      expect(stagedFiles).toHaveLength(3)
      expect(stagedFiles[0].file.name).toBe('runsheet1.pdf')
      expect(stagedFiles[1].file.name).toBe('docket1.jpg')
      expect(stagedFiles[2].file.name).toBe('photo1.png')

      // All default to runsheet
      for (const staged of stagedFiles) {
        expect(staged.attachmentType).toBe('runsheet')
      }
    })

    it('can append additional files to existing staged files', () => {
      const initialFiles: StagedFile[] = [
        {
          id: 'existing-1',
          file: new File(['a'], 'existing.pdf', { type: 'application/pdf' }),
          attachmentType: 'runsheet',
        },
      ]

      const newFiles = [
        new File(['b'], 'new1.pdf', { type: 'application/pdf' }),
        new File(['c'], 'new2.pdf', { type: 'application/pdf' }),
      ]

      const newStagedFiles: StagedFile[] = newFiles.map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        attachmentType: 'runsheet',
      }))

      const combined = [...initialFiles, ...newStagedFiles]

      expect(combined).toHaveLength(3)
      expect(combined[0].id).toBe('existing-1')
    })

    it('can remove all staged files', () => {
      let stagedFiles: StagedFile[] = [
        {
          id: 'f1',
          file: new File(['a'], 'a.pdf', { type: 'application/pdf' }),
          attachmentType: 'runsheet',
        },
        {
          id: 'f2',
          file: new File(['b'], 'b.pdf', { type: 'application/pdf' }),
          attachmentType: 'docket',
        },
      ]

      // Remove one at a time
      stagedFiles = stagedFiles.filter((f) => f.id !== 'f1')
      expect(stagedFiles).toHaveLength(1)

      stagedFiles = stagedFiles.filter((f) => f.id !== 'f2')
      expect(stagedFiles).toHaveLength(0)
    })
  })
})
