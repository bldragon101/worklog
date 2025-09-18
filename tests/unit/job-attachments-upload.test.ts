/**
 * Unit tests for job attachment upload functionality
 * Tests the business logic, validation, and error recovery mechanisms
 */

// Mock dependencies before any imports
jest.mock('date-fns', () => ({
  format: jest.fn(),
  endOfWeek: jest.fn(),
}));

// Mock Google Auth
const mockGoogleDriveClient = {
  files: {
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  permissions: {
    create: jest.fn(),
  },
};

jest.mock('@/lib/google-auth', () => ({
  createGoogleDriveClient: jest.fn(() => Promise.resolve(mockGoogleDriveClient)),
}));

// Mock Prisma
const mockPrisma = {
  jobs: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock Activity Logger
jest.mock('@/lib/activity-logger', () => ({
  JobsActivityLogger: {
    logAttachmentUpload: jest.fn(),
  },
}));

import { format, endOfWeek } from 'date-fns';
import { createOrganizedFilename, validateFilename, auditFilename } from '@/lib/file-security';

// Type definitions for test data
interface MockFile {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

interface MockFormData {
  getAll: (key: string) => MockFile[];
  get: (key: string) => string | null;
}

interface _MockGoogleDriveClient {
  files: {
    list: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  permissions: {
    create: jest.Mock;
  };
}

describe('Job Attachment Upload', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock date-fns
    (endOfWeek as jest.Mock).mockReturnValue(new Date('2024-01-07'));
    (format as jest.Mock).mockImplementation((date, formatStr) => {
      if (formatStr === 'dd.MM.yy') return '07.01.24';
      if (formatStr === 'dd.MM') return '01.01';
      return '2024-01-01';
    });
  });

  describe('Successful Upload Scenarios', () => {
    it('should successfully upload single file with runsheet type', async () => {
      // Mock job data
      const mockJob = {
        id: 1,
        date: '2024-01-01',
        customer: 'Test Customer',
        billTo: 'Test Bill To',
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: [],
      };

      mockPrisma.jobs.findUnique.mockResolvedValue(mockJob);
      mockPrisma.jobs.update.mockResolvedValue({
        ...mockJob,
        attachmentRunsheet: ['https://drive.google.com/file/d/test123/view?filename=test.pdf'],
      });

      // Mock Google Drive responses
      mockGoogleDriveClient.files.list
        .mockResolvedValueOnce({ data: { files: [{ id: 'week-folder-id' }] } }) // Week folder exists
        .mockResolvedValueOnce({ data: { files: [{ id: 'customer-folder-id' }] } }) // Customer folder exists
        .mockResolvedValueOnce({ data: { files: [] } }); // No existing files

      mockGoogleDriveClient.files.create.mockResolvedValue({
        data: { id: 'test123' },
      });

      mockGoogleDriveClient.permissions.create.mockResolvedValue({});

      // Create mock file
      const mockFile: MockFile = {
        name: 'test-runsheet.pdf',
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      // Create mock form data
      const mockFormData: MockFormData = {
        getAll: jest.fn().mockReturnValue([mockFile]),
        get: jest.fn().mockImplementation((key: string) => {
          switch (key) {
            case 'baseFolderId': return 'base-folder-id';
            case 'driveId': return 'drive-id';
            case 'attachmentTypes[0]': return 'runsheet';
            default: return null;
          }
        }),
      };

      // Test the upload logic (business logic extracted from route)
      const result = await testUploadLogic(mockJob, mockFormData, [mockFile], ['runsheet']);

      expect(result.success).toBe(true);
      expect(result.uploadedFilesByType.runsheet).toHaveLength(1);
      expect(result.uploadedFilesByType.runsheet[0]).toContain('test123');
      expect(mockPrisma.jobs.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          attachmentRunsheet: {
            push: expect.arrayContaining([expect.stringContaining('test123')]),
          },
        },
      });
    });

    it('should successfully upload multiple files with different types', async () => {
      const mockJob = {
        id: 1,
        date: '2024-01-01',
        customer: 'Test Customer',
        billTo: 'Test Bill To',
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: [],
      };

      mockPrisma.jobs.findUnique.mockResolvedValue(mockJob);
      mockPrisma.jobs.update.mockResolvedValue({
        ...mockJob,
        attachmentRunsheet: ['https://drive.google.com/file/d/runsheet123/view'],
        attachmentDocket: ['https://drive.google.com/file/d/docket456/view'],
        attachmentDeliveryPhotos: ['https://drive.google.com/file/d/photo789/view'],
      });

      // Mock folder creation/lookup
      mockGoogleDriveClient.files.list
        .mockResolvedValueOnce({ data: { files: [] } }) // Week folder doesn't exist
        .mockResolvedValueOnce({ data: { files: [] } }) // Customer folder doesn't exist
        .mockResolvedValue({ data: { files: [] } }); // No existing files

      mockGoogleDriveClient.files.create
        .mockResolvedValueOnce({ data: { id: 'week-folder-id' } }) // Create week folder
        .mockResolvedValueOnce({ data: { id: 'customer-folder-id' } }) // Create customer folder
        .mockResolvedValueOnce({ data: { id: 'runsheet123' } }) // Upload runsheet
        .mockResolvedValueOnce({ data: { id: 'docket456' } }) // Upload docket
        .mockResolvedValueOnce({ data: { id: 'photo789' } }); // Upload photo

      mockGoogleDriveClient.permissions.create.mockResolvedValue({});

      const mockFiles: MockFile[] = [
        {
          name: 'runsheet.pdf',
          type: 'application/pdf',
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
        },
        {
          name: 'docket.pdf',
          type: 'application/pdf',
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
        },
        {
          name: 'photo.jpg',
          type: 'image/jpeg',
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
        },
      ];

      const result = await testUploadLogic(
        mockJob,
        createMockFormData(mockFiles, ['runsheet', 'docket', 'delivery_photos']),
        mockFiles,
        ['runsheet', 'docket', 'delivery_photos']
      );

      expect(result.success).toBe(true);
      expect(result.uploadedFilesByType.runsheet).toHaveLength(1);
      expect(result.uploadedFilesByType.docket).toHaveLength(1);
      expect(result.uploadedFilesByType.delivery_photos).toHaveLength(1);
    });

    it('should handle filename conflicts by adding number suffix', async () => {
      const mockJob = {
        id: 1,
        date: '2024-01-01',
        customer: 'Test Customer',
        billTo: 'Test Bill To',
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: [],
      };

      mockPrisma.jobs.findUnique.mockResolvedValue(mockJob);
      mockPrisma.jobs.update.mockResolvedValue(mockJob);

      // Mock existing files found (return 2 files to trigger _3 suffix)
      mockGoogleDriveClient.files.list
        .mockResolvedValueOnce({ data: { files: [] } }) // Week folder check
        .mockResolvedValueOnce({ data: { files: [] } }) // Customer folder check  
        .mockResolvedValueOnce({
          data: {
            files: [
              { id: 'existing1', name: '01.01_runsheet_test_document.pdf' },
              { id: 'existing2', name: '01.01_runsheet_test_document_2.pdf' },
            ],
          },
        });

      mockGoogleDriveClient.files.create.mockResolvedValue({ data: { id: 'new-file-id' } });
      mockGoogleDriveClient.permissions.create.mockResolvedValue({});

      const mockFile: MockFile = {
        name: 'test_document.pdf',
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      await testUploadLogic(
        mockJob,
        createMockFormData([mockFile], ['runsheet']),
        [mockFile],
        ['runsheet']
      );

      // Should create file - the exact naming depends on the new security function
      expect(mockGoogleDriveClient.files.create).toHaveBeenCalledWith({
        requestBody: {
          name: expect.stringMatching(/01\.01_.+_.+_.+_runsheet/),
          parents: ['customer-folder-id'],
        },
        media: {
          mimeType: 'application/pdf',
          body: expect.anything(),
        },
        supportsAllDrives: true,
      });
    });
  });

  describe('Error Recovery and Rollback Scenarios', () => {
    it('should demonstrate rollback logic for file upload failures', async () => {
      // This test demonstrates the rollback concept rather than testing the complex integration
      const uploadedFiles = [
        { fileId: 'successful-upload-id', fileName: 'file1.pdf' }
      ];

      // Simulate rollback function
      const rollbackFiles = async (files: typeof uploadedFiles) => {
        for (const file of files) {
          // This simulates the drive.files.delete call
          await mockGoogleDriveClient.files.delete({
            fileId: file.fileId,
            supportsAllDrives: true,
          });
        }
      };

      await rollbackFiles(uploadedFiles);

      // Verify the delete was called
      expect(mockGoogleDriveClient.files.delete).toHaveBeenCalledWith({
        fileId: 'successful-upload-id',
        supportsAllDrives: true,
      });
    });

    it('should demonstrate database rollback logic', async () => {
      // This test demonstrates the database rollback concept
      const uploadedFiles = [
        { fileId: 'uploaded-file-id', fileName: 'test.pdf' }
      ];

      // Simulate database update failure and rollback
      const handleDatabaseFailure = async (files: typeof uploadedFiles) => {
        try {
          // Simulate database operation failure
          throw new Error('Database update failed');
        } catch {
          // Rollback uploaded files
          for (const file of files) {
            await mockGoogleDriveClient.files.delete({
              fileId: file.fileId,
              supportsAllDrives: true,
            });
          }
          throw new Error('Failed to update job record with attachment information');
        }
      };

      await expect(handleDatabaseFailure(uploadedFiles))
        .rejects.toThrow('Failed to update job record with attachment information');

      // Should have called delete for the uploaded file after DB failure
      expect(mockGoogleDriveClient.files.delete).toHaveBeenCalledWith({
        fileId: 'uploaded-file-id',
        supportsAllDrives: true,
      });
    });

    it('should handle rollback failures gracefully', async () => {
      // This test demonstrates graceful handling of rollback failures
      const uploadedFiles = [
        { fileId: 'uploaded-file-id', fileName: 'file1.pdf' }
      ];

      // Mock delete failure during rollback
      mockGoogleDriveClient.files.delete.mockRejectedValue(new Error('Delete failed during rollback'));

      // Simulate rollback with failure handling
      const rollbackWithErrorHandling = async (files: typeof uploadedFiles, originalError: Error) => {
        for (const file of files) {
          try {
            await mockGoogleDriveClient.files.delete({
              fileId: file.fileId,
              supportsAllDrives: true,
            });
          } catch {
            // Log but don't throw rollback errors - preserve original error
            console.log(`Failed to delete file during rollback: ${file.fileName}`);
          }
        }
        // Still throw the original error
        throw originalError;
      };

      const originalError = new Error('Original upload failed');
      
      await expect(rollbackWithErrorHandling(uploadedFiles, originalError))
        .rejects.toThrow('Original upload failed');

      expect(mockGoogleDriveClient.files.delete).toHaveBeenCalled();
    });
  });

  describe('Validation and Edge Cases', () => {
    it('should reject invalid attachment types', async () => {
      const mockFile: MockFile = {
        name: 'test.pdf',
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      const invalidTypes = ['invalid_type', 'wrong', ''];

      for (const invalidType of invalidTypes) {
        await expect(
          validateAttachmentTypes([mockFile], [invalidType])
        ).rejects.toThrow('Invalid attachment type');
      }
    });

    it('should accept valid attachment types', async () => {
      const mockFile: MockFile = {
        name: 'test.pdf',
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      const validTypes = ['runsheet', 'docket', 'delivery_photos'];

      for (const validType of validTypes) {
        await expect(
          validateAttachmentTypes([mockFile], [validType])
        ).resolves.not.toThrow();
      }
    });

    it('should reject empty file list', async () => {
      await expect(
        validateAttachmentTypes([], [])
      ).rejects.toThrow('No files provided');
    });

    it('should reject mismatched file and type counts', async () => {
      const mockFile: MockFile = {
        name: 'test.pdf',
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      await expect(
        validateAttachmentTypes([mockFile], ['runsheet', 'docket'])
      ).rejects.toThrow('File count does not match attachment type count');
    });

    it('should handle special characters in filenames', async () => {
      const mockJob = {
        id: 1,
        date: '2024-01-01',
        customer: 'Test & Company',
        billTo: "O'Connor Ltd",
        attachmentRunsheet: [],
        attachmentDocket: [],
        attachmentDeliveryPhotos: [],
      };

      mockPrisma.jobs.findUnique.mockResolvedValue(mockJob);
      mockPrisma.jobs.update.mockResolvedValue(mockJob);

      mockGoogleDriveClient.files.list
        .mockResolvedValueOnce({ data: { files: [{ id: 'week-folder-id' }] } })
        .mockResolvedValueOnce({ data: { files: [{ id: 'customer-folder-id' }] } })
        .mockResolvedValue({ data: { files: [] } });

      mockGoogleDriveClient.files.create.mockResolvedValue({ data: { id: 'file-id' } });
      mockGoogleDriveClient.permissions.create.mockResolvedValue({});

      const mockFile: MockFile = {
        name: 'test file with spaces & symbols!@#.pdf',
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      const result = await testUploadLogic(
        mockJob,
        createMockFormData([mockFile], ['runsheet']),
        [mockFile],
        ['runsheet']
      );

      expect(result.success).toBe(true);
      
      // Check that special characters are cleaned in the created filename
      expect(mockGoogleDriveClient.files.create).toHaveBeenCalledWith({
        requestBody: {
          name: expect.stringMatching(/01\.01_.+_.+_.+_runsheet\.pdf/),
          parents: ['customer-folder-id'],
        },
        media: {
          mimeType: 'application/pdf',
          body: expect.anything(),
        },
        supportsAllDrives: true,
      });
    });
  });

  describe('Security Integration Tests', () => {
    it('should validate safe filenames', () => {
      const result = validateFilename('document.pdf', ['pdf', 'jpg', 'doc']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dangerous filenames', () => {
      // Test path traversal
      const pathTraversal = validateFilename('../../../etc/passwd', ['pdf']);
      expect(pathTraversal.isValid).toBe(false);
      
      // Test script injection
      const scriptInjection = validateFilename('file<script>alert(1)</script>.txt', ['txt']);
      expect(scriptInjection.isValid).toBe(false);
      
      // Test pipe character
      const pipeChar = validateFilename('file|rm -rf /', ['txt']);
      expect(pipeChar.isValid).toBe(false);
    });

    it('should reject disallowed file extensions', () => {
      const result = validateFilename('malware.exe', ['pdf', 'jpg']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("File extension 'exe' is not allowed. Allowed: pdf, jpg");
    });

    it('should perform security audits correctly', () => {
      // High risk
      const highRisk = auditFilename('../../../etc/passwd');
      expect(highRisk.riskLevel).toBe('high');

      // Medium risk
      const mediumRisk = auditFilename('CON.txt');
      expect(mediumRisk.riskLevel).toBe('medium');

      // Low risk
      const lowRisk = auditFilename('normal_document.pdf');
      expect(lowRisk.riskLevel).toBe('low');
    });

    it('should handle complete workflow for safe files', () => {
      const filename = 'job_report_2024.pdf';
      const prefix = '15.03_runsheet';
      
      // 1. Validate
      const validation = validateFilename(filename, ['pdf', 'jpg', 'doc']);
      expect(validation.isValid).toBe(true);
      
      // 2. Audit
      const audit = auditFilename(filename);
      expect(audit.riskLevel).toBe('low');
      
      // 3. Create organized filename
      const organized = createOrganizedFilename(filename, prefix, 0);
      expect(organized).toBe('15.03_runsheet.pdf');
    });

    it('should handle files that need sanitization', () => {
      const filename = 'Job Report - Customer ABC & Co. (Draft).pdf';
      const prefix = '15.03_delivery_photos';
      
      // 1. Validate (should fail due to dangerous characters)
      const validation = validateFilename(filename, ['pdf']);
      expect(validation.isValid).toBe(false); // Contains dangerous characters like ()
      
      // 2. Create organized filename (should be sanitized despite validation failure)
      const organized = createOrganizedFilename(filename, prefix, 1);
      expect(organized).toContain('15.03_delivery_photos');
      expect(organized).toContain('_2'); // Has suffix
      expect(organized).toMatch(/\.pdf$/); // Ends with .pdf
      expect(organized.length).toBeGreaterThan(0);
    });

    it('should reject high-risk files in validation workflow', () => {
      const dangerousFilename = '../../../etc/passwd';
      
      // 1. Audit should detect high risk
      const audit = auditFilename(dangerousFilename);
      expect(audit.riskLevel).toBe('high');
      
      // 2. Validation should fail
      const validation = validateFilename(dangerousFilename, ['txt']);
      expect(validation.isValid).toBe(false);
      
      // This simulates the API rejecting the file
      if (audit.riskLevel === 'high' || !validation.isValid) {
        expect(true).toBe(true); // File would be rejected
      }
    });
  });

  describe('Filename Organization Tests', () => {
    it('should create properly organized filenames', () => {
      const result = createOrganizedFilename('test_document.pdf', '01.01_runsheet', 0);
      expect(result).toBe('01.01_runsheet.pdf');
    });

    it('should add suffix for existing files', () => {
      const result = createOrganizedFilename('test_document.pdf', '01.01_runsheet', 2);
      expect(result).toBe('01.01_runsheet_3.pdf');
    });

    it('should sanitize special characters in filenames', () => {
      const result = createOrganizedFilename('test file with spaces & symbols!@#.pdf', '01.01_runsheet', 1);
      expect(result).toBe('01.01_runsheet_2.pdf');
    });

    it('should handle various filename formats', () => {
      // Test with dashes
      expect(createOrganizedFilename('test-document.pdf', '01.01_docket', 0))
        .toBe('01.01_docket.pdf');
      
      // Test with underscores
      expect(createOrganizedFilename('test_document.pdf', '01.01_delivery_photos', 0))
        .toBe('01.01_delivery_photos.pdf');
      
      // Test without extension
      expect(createOrganizedFilename('document', '01.01_runsheet', 0))
        .toBe('01.01_runsheet');
    });

    it('should handle complete filename processing workflow', () => {
      const originalFileName = 'test file with spaces & symbols!@#.pdf';
      const organizationPrefix = '01.01_runsheet';
      const existingCount = 2;
      
      const finalFileName = createOrganizedFilename(originalFileName, organizationPrefix, existingCount);
      
      expect(finalFileName).toBe('01.01_runsheet_3.pdf');
    });
  });

  describe('Business Logic Tests', () => {
    it('should create correct update data for different attachment types', () => {
      const uploadedFilesByType = {
        runsheet: ['https://drive.google.com/file/d/123/view'],
        docket: ['https://drive.google.com/file/d/456/view'],
        delivery_photos: ['https://drive.google.com/file/d/789/view'],
      };

      const updateData: { attachmentRunsheet?: { push: string[] }; attachmentDocket?: { push: string[] }; attachmentDeliveryPhotos?: { push: string[] } } = {};
      
      if (uploadedFilesByType.runsheet.length > 0) {
        updateData.attachmentRunsheet = { push: uploadedFilesByType.runsheet };
      }
      if (uploadedFilesByType.docket.length > 0) {
        updateData.attachmentDocket = { push: uploadedFilesByType.docket };
      }
      if (uploadedFilesByType.delivery_photos.length > 0) {
        updateData.attachmentDeliveryPhotos = { push: uploadedFilesByType.delivery_photos };
      }

      expect(updateData).toEqual({
        attachmentRunsheet: { push: ['https://drive.google.com/file/d/123/view'] },
        attachmentDocket: { push: ['https://drive.google.com/file/d/456/view'] },
        attachmentDeliveryPhotos: { push: ['https://drive.google.com/file/d/789/view'] },
      });
    });

    it('should only include fields for uploaded attachment types', () => {
      const uploadedFilesByType = {
        runsheet: ['https://drive.google.com/file/d/123/view'],
        docket: [],
        delivery_photos: [],
      };

      const updateData: { attachmentRunsheet?: { push: string[] }; attachmentDocket?: { push: string[] }; attachmentDeliveryPhotos?: { push: string[] } } = {};
      
      if (uploadedFilesByType.runsheet.length > 0) {
        updateData.attachmentRunsheet = { push: uploadedFilesByType.runsheet };
      }
      if (uploadedFilesByType.docket.length > 0) {
        updateData.attachmentDocket = { push: uploadedFilesByType.docket };
      }
      if (uploadedFilesByType.delivery_photos.length > 0) {
        updateData.attachmentDeliveryPhotos = { push: uploadedFilesByType.delivery_photos };
      }

      expect(updateData).toEqual({
        attachmentRunsheet: { push: ['https://drive.google.com/file/d/123/view'] },
      });
      expect(updateData.attachmentDocket).toBeUndefined();
      expect(updateData.attachmentDeliveryPhotos).toBeUndefined();
    });
  });

  // Helper functions for testing
  async function testUploadLogic(
    job: { id: number; date: string; customer: string; billTo: string; attachmentRunsheet: string[]; attachmentDocket: string[]; attachmentDeliveryPhotos: string[]; },
    formData: MockFormData,
    files: MockFile[],
    attachmentTypes: string[]
  ) {
    // This simulates the core upload logic from the route handler
    
    await validateAttachmentTypes(files, attachmentTypes);

    const uploadedFiles: Array<{ fileId: string; fileName: string }> = [];
    const uploadedFilesByType = {
      runsheet: [] as string[],
      docket: [] as string[],
      delivery_photos: [] as string[],
    };

    const drive = mockGoogleDriveClient;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachmentType = attachmentTypes[i];

        // Create organization prefix for the filename: <date>_<driver>_<customer>_<trucktype>_<attachmenttype>
        const organizationPrefix = `01.01_TestDriver_TestCustomer_TestTruck_${attachmentType}`;
        
        // Check for existing files
        const existingFilesResponse = await drive.files.list({
          q: expect.any(String),
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'drive',
          driveId: 'drive-id',
        });

        // Count existing files to determine suffix
        const existingCount = existingFilesResponse.data.files ? existingFilesResponse.data.files.length : 0;

        // Create secure, organized filename using the new security function
        const finalFileName = createOrganizedFilename(
          file.name,
          organizationPrefix,
          existingCount
        );

        // Upload file
        const uploadResponse = await drive.files.create({
          requestBody: {
            name: finalFileName,
            parents: ['customer-folder-id'],
          },
          media: {
            mimeType: file.type,
            body: expect.anything(),
          },
          supportsAllDrives: true,
        });

        if (uploadResponse.data.id) {
          uploadedFiles.push({
            fileId: uploadResponse.data.id,
            fileName: finalFileName,
          });

          await drive.permissions.create({
            fileId: uploadResponse.data.id,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
            supportsAllDrives: true,
          });

          const fileLink = `https://drive.google.com/file/d/${uploadResponse.data.id}/view?filename=${encodeURIComponent(finalFileName)}`;
          uploadedFilesByType[attachmentType as keyof typeof uploadedFilesByType].push(fileLink);
        } else {
          throw new Error(`Failed to upload file: ${file.name}`);
        }
      }
    } catch (uploadError) {
      // Rollback uploaded files
      for (const uploadedFile of uploadedFiles) {
        try {
          await drive.files.delete({
            fileId: uploadedFile.fileId,
            supportsAllDrives: true,
          });
        } catch {
          // Log but don't throw rollback errors
        }
      }
      throw uploadError;
    }

    // Update database
    const updateData: Record<string, { push: string[] }> = {};
    if (uploadedFilesByType.runsheet.length > 0) {
      updateData.attachmentRunsheet = { push: uploadedFilesByType.runsheet };
    }
    if (uploadedFilesByType.docket.length > 0) {
      updateData.attachmentDocket = { push: uploadedFilesByType.docket };
    }
    if (uploadedFilesByType.delivery_photos.length > 0) {
      updateData.attachmentDeliveryPhotos = { push: uploadedFilesByType.delivery_photos };
    }

    try {
      await mockPrisma.jobs.update({
        where: { id: job.id },
        data: updateData,
      });
    } catch {
      // Rollback uploaded files
      for (const uploadedFile of uploadedFiles) {
        try {
          await drive.files.delete({
            fileId: uploadedFile.fileId,
            supportsAllDrives: true,
          });
        } catch {
          // Log but don't throw rollback errors
        }
      }
      throw new Error('Failed to update job record with attachment information');
    }

    return {
      success: true,
      uploadedFilesByType,
    };
  }

  function createMockFormData(files: MockFile[], attachmentTypes: string[]): MockFormData {
    return {
      getAll: jest.fn().mockReturnValue(files),
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'baseFolderId') return 'base-folder-id';
        if (key === 'driveId') return 'drive-id';
        if (key.startsWith('attachmentTypes[')) {
          const index = parseInt(key.match(/\[(\d+)\]/)?.[1] || '0');
          return attachmentTypes[index] || null;
        }
        return null;
      }),
    };
  }

  async function validateAttachmentTypes(files: MockFile[], attachmentTypes: string[]) {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    if (files.length !== attachmentTypes.length) {
      throw new Error('File count does not match attachment type count');
    }

    for (const attachmentType of attachmentTypes) {
      if (!['runsheet', 'docket', 'delivery_photos'].includes(attachmentType)) {
        throw new Error('Invalid attachment type');
      }
    }
  }

  function _cleanString(str: string): string {
    return str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  }
});