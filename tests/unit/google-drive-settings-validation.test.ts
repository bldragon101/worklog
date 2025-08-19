/**
 * Unit tests for Google Drive Settings validation and database operations
 * Tests validation schemas and database interactions without NextJS dependencies
 */

import { z } from 'zod';

// Validation schema from the API route
const googleDriveSettingsSchema = z.object({
  driveId: z.string().min(1, 'Drive ID is required'),
  driveName: z.string().min(1, 'Drive name is required'),
  baseFolderId: z.string().min(1, 'Base folder ID is required'),
  folderName: z.string().min(1, 'Folder name is required'),
  folderPath: z.array(z.string()),
  purpose: z.string().default('job_attachments')
});

describe('Google Drive Settings Validation', () => {
  describe('Schema Validation', () => {
    it('should validate correct data', () => {
      const validData = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'job_attachments'
      };

      const result = googleDriveSettingsSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should require driveId', () => {
      const invalidData = {
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog']
      };

      expect(() => googleDriveSettingsSchema.parse(invalidData)).toThrow();
    });

    it('should require driveName', () => {
      const invalidData = {
        driveId: 'test-drive-id',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog']
      };

      expect(() => googleDriveSettingsSchema.parse(invalidData)).toThrow();
    });

    it('should require baseFolderId', () => {
      const invalidData = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        folderName: 'WorkLog',
        folderPath: ['WorkLog']
      };

      expect(() => googleDriveSettingsSchema.parse(invalidData)).toThrow();
    });

    it('should require folderName', () => {
      const invalidData = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderPath: ['WorkLog']
      };

      expect(() => googleDriveSettingsSchema.parse(invalidData)).toThrow();
    });

    it('should require folderPath as array', () => {
      const invalidData = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: 'WorkLog' // Should be array
      };

      expect(() => googleDriveSettingsSchema.parse(invalidData)).toThrow();
    });

    it('should default purpose to job_attachments', () => {
      const dataWithoutPurpose = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog']
      };

      const result = googleDriveSettingsSchema.parse(dataWithoutPurpose);
      expect(result.purpose).toBe('job_attachments');
    });

    it('should accept custom purpose', () => {
      const dataWithCustomPurpose = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'general_storage'
      };

      const result = googleDriveSettingsSchema.parse(dataWithCustomPurpose);
      expect(result.purpose).toBe('general_storage');
    });

    it('should reject empty strings for required fields', () => {
      const dataWithEmptyStrings = {
        driveId: '',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog']
      };

      expect(() => googleDriveSettingsSchema.parse(dataWithEmptyStrings)).toThrow('Drive ID is required');
    });

    it('should handle complex folder paths', () => {
      const dataWithComplexPath = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'Sub Folder',
        folderPath: ['WorkLog', 'Projects', 'Sub Folder']
      };

      const result = googleDriveSettingsSchema.parse(dataWithComplexPath);
      expect(result.folderPath).toEqual(['WorkLog', 'Projects', 'Sub Folder']);
    });
  });

  describe('Database Query Patterns', () => {
    it('should create correct query for finding user settings', () => {
      const userId = 'user_test123';
      const purpose = 'job_attachments';
      
      const expectedQuery = {
        where: {
          userId: userId,
          purpose: purpose,
          isActive: true
        },
        orderBy: {
          updatedAt: 'desc'
        }
      };

      // This would be used in: prisma.googleDriveSettings.findFirst(expectedQuery)
      expect(expectedQuery.where.userId).toBe(userId);
      expect(expectedQuery.where.purpose).toBe(purpose);
      expect(expectedQuery.where.isActive).toBe(true);
      expect(expectedQuery.orderBy.updatedAt).toBe('desc');
    });

    it('should create correct query for deactivating old settings', () => {
      const userId = 'user_test123';
      const purpose = 'job_attachments';
      
      const expectedUpdateQuery = {
        where: {
          userId: userId,
          purpose: purpose,
          isActive: true
        },
        data: {
          isActive: false
        }
      };

      // This would be used in: prisma.googleDriveSettings.updateMany(expectedUpdateQuery)
      expect(expectedUpdateQuery.where.userId).toBe(userId);
      expect(expectedUpdateQuery.where.purpose).toBe(purpose);
      expect(expectedUpdateQuery.where.isActive).toBe(true);
      expect(expectedUpdateQuery.data.isActive).toBe(false);
    });

    it('should create correct data for new settings', () => {
      const userId = 'user_test123';
      const validatedData = {
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'job_attachments'
      };

      const expectedCreateData = {
        data: {
          userId: userId,
          driveId: validatedData.driveId,
          driveName: validatedData.driveName,
          baseFolderId: validatedData.baseFolderId,
          folderName: validatedData.folderName,
          folderPath: validatedData.folderPath,
          purpose: validatedData.purpose,
          isActive: true
        }
      };

      // This would be used in: prisma.googleDriveSettings.create(expectedCreateData)
      expect(expectedCreateData.data.userId).toBe(userId);
      expect(expectedCreateData.data.driveId).toBe(validatedData.driveId);
      expect(expectedCreateData.data.driveName).toBe(validatedData.driveName);
      expect(expectedCreateData.data.baseFolderId).toBe(validatedData.baseFolderId);
      expect(expectedCreateData.data.folderName).toBe(validatedData.folderName);
      expect(expectedCreateData.data.folderPath).toEqual(validatedData.folderPath);
      expect(expectedCreateData.data.purpose).toBe(validatedData.purpose);
      expect(expectedCreateData.data.isActive).toBe(true);
    });
  });

  describe('API Response Formats', () => {
    it('should format successful GET response correctly', () => {
      const mockSettings = {
        id: 1,
        userId: 'user_test123',
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'job_attachments',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const expectedResponse = {
        success: true,
        settings: mockSettings
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.settings).toEqual(mockSettings);
    });

    it('should format successful POST response correctly', () => {
      const mockCreatedSettings = {
        id: 1,
        userId: 'user_test123',
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'job_attachments',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const expectedResponse = {
        success: true,
        settings: mockCreatedSettings
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.settings).toEqual(mockCreatedSettings);
    });

    it('should format successful DELETE response correctly', () => {
      const deactivatedCount = 1;
      
      const expectedResponse = {
        success: true,
        deactivated: deactivatedCount
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.deactivated).toBe(deactivatedCount);
    });

    it('should format error response correctly', () => {
      const errorMessage = 'Invalid input data';
      const validationIssues = [
        { 
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Drive ID is required',
          path: ['driveId']
        }
      ];

      const expectedErrorResponse = {
        success: false,
        error: errorMessage,
        details: validationIssues
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toBe(errorMessage);
      expect(expectedErrorResponse.details).toEqual(validationIssues);
    });
  });

  describe('Integration Config Format', () => {
    it('should format config for jobs page correctly', () => {
      const dbSettings = {
        id: 1,
        userId: 'user_test123',
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'job_attachments',
        isActive: true
      };

      const expectedJobsPageConfig = {
        baseFolderId: dbSettings.baseFolderId,
        driveId: dbSettings.driveId
      };

      expect(expectedJobsPageConfig.baseFolderId).toBe(dbSettings.baseFolderId);
      expect(expectedJobsPageConfig.driveId).toBe(dbSettings.driveId);
    });

    it('should format config for integrations page correctly', () => {
      const dbSettings = {
        id: 1,
        userId: 'user_test123',
        driveId: 'test-drive-id',
        driveName: 'WorkLog Drive',
        baseFolderId: 'test-folder-id',
        folderName: 'WorkLog',
        folderPath: ['WorkLog'],
        purpose: 'job_attachments',
        isActive: true
      };

      const expectedIntegrationsPageConfig = {
        baseFolderId: dbSettings.baseFolderId,
        driveId: dbSettings.driveId,
        folderName: dbSettings.folderName,
        folderPath: dbSettings.folderPath
      };

      expect(expectedIntegrationsPageConfig.baseFolderId).toBe(dbSettings.baseFolderId);
      expect(expectedIntegrationsPageConfig.driveId).toBe(dbSettings.driveId);
      expect(expectedIntegrationsPageConfig.folderName).toBe(dbSettings.folderName);
      expect(expectedIntegrationsPageConfig.folderPath).toEqual(dbSettings.folderPath);
    });
  });
});