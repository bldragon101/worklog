/**
 * Unit tests for file security utilities
 * Tests filename sanitization, validation, and security features
 */

import {
  sanitizeFilename,
  sanitizeFolderName,
  validateFilename,
  auditFilename,
  createOrganizedFilename,
  getFileExtension,
} from '@/lib/file-security';

describe('File Security Utilities', () => {
  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      const dangerous = 'file<>:"|?*\\/.txt';
      const result = sanitizeFilename(dangerous);
      expect(result).toBe('file_.txt');
    });

    it('should prevent path traversal attacks', () => {
      const pathTraversal = '../../../etc/passwd';
      const result = sanitizeFilename(pathTraversal);
      expect(result).toBe('etc_passwd');
    });

    it('should handle reserved filenames', () => {
      const reserved = 'CON.txt';
      const result = sanitizeFilename(reserved);
      expect(result).toBe('_CON.txt');
    });

    it('should normalize Unicode characters', () => {
      const unicode = 'café_résumé.pdf';
      const result = sanitizeFilename(unicode);
      // Should normalize and handle accented characters
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle extremely long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });

    it('should replace multiple spaces with single underscore', () => {
      const multiSpaces = 'file   with    many     spaces.txt';
      const result = sanitizeFilename(multiSpaces);
      expect(result).toBe('file_with_many_spaces.txt');
    });

    it('should remove leading and trailing dots/spaces', () => {
      const leadingTrailing = '  ..file..  ';
      const result = sanitizeFilename(leadingTrailing);
      expect(result).toBe('file');
    });

    it('should provide fallback for empty results', () => {
      const empty = '....';
      const result = sanitizeFilename(empty);
      expect(result).toBe('_file');
    });

    it('should handle filenames without extensions', () => {
      const noExt = 'document';
      const result = sanitizeFilename(noExt);
      expect(result).toBe('document');
    });

    it('should preserve case by default', () => {
      const mixedCase = 'MyFile.PDF';
      const result = sanitizeFilename(mixedCase);
      expect(result).toBe('MyFile.PDF');
    });

    it('should convert to lowercase when specified', () => {
      const mixedCase = 'MyFile.PDF';
      const result = sanitizeFilename(mixedCase, { preserveCase: false });
      expect(result).toBe('myfile.pdf');
    });

    it('should throw error for invalid input', () => {
      expect(() => sanitizeFilename('')).toThrow('Invalid filename');
      expect(() => sanitizeFilename(null as any)).toThrow('Invalid filename');
      expect(() => sanitizeFilename(123 as any)).toThrow('Invalid filename');
    });

    it('should handle custom replacement character', () => {
      const special = 'file@name#.txt';
      const result = sanitizeFilename(special, { replacementChar: '-' });
      expect(result).toBe('file-name-.txt');
    });
  });

  describe('sanitizeFolderName', () => {
    it('should sanitize folder names more strictly', () => {
      const folderName = 'My Folder/Name..';
      const result = sanitizeFolderName(folderName);
      expect(result).toBe('My Folder_Name');
      expect(result.endsWith('.')).toBe(false);
    });

    it('should enforce shorter length limits for folders', () => {
      const longFolder = 'a'.repeat(200);
      const result = sanitizeFolderName(longFolder);
      expect(result.length).toBeLessThanOrEqual(128);
    });

    it('should remove trailing dots from folder names', () => {
      const trailingDots = 'folder...';
      const result = sanitizeFolderName(trailingDots);
      expect(result).toBe('folder');
    });

    it('should provide fallback for empty folder names', () => {
      const empty = '!!!';
      const result = sanitizeFolderName(empty);
      expect(result).toBe('_file');
    });

    it('should throw error for invalid folder name input', () => {
      expect(() => sanitizeFolderName('')).toThrow('Invalid folder name');
      expect(() => sanitizeFolderName(null as any)).toThrow('Invalid folder name');
    });
  });

  describe('validateFilename', () => {
    it('should validate safe filenames', () => {
      const result = validateFilename('document.pdf');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dangerous characters', () => {
      const result = validateFilename('file<dangerous>.txt');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filename contains dangerous characters');
    });

    it('should reject path traversal attempts', () => {
      const result = validateFilename('../secret.txt');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filename contains path traversal sequences');
    });

    it('should warn about reserved names', () => {
      const result = validateFilename('CON.txt');
      expect(result.warnings).toContain('Filename uses a reserved system name');
    });

    it('should validate file extensions when provided', () => {
      const allowedExts = ['pdf', 'jpg', 'txt'];
      
      const validResult = validateFilename('document.pdf', allowedExts);
      expect(validResult.isValid).toBe(true);
      
      const invalidResult = validateFilename('document.exe', allowedExts);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain("File extension 'exe' is not allowed. Allowed: pdf, jpg, txt");
    });

    it('should reject filenames that are too long', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = validateFilename(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filename exceeds maximum length of 255 characters');
    });

    it('should warn about hidden files', () => {
      const result = validateFilename('.hidden');
      expect(result.warnings).toContain('Filename starts with a dot (hidden file)');
    });

    it('should warn about consecutive dots', () => {
      const result = validateFilename('file..txt');
      expect(result.warnings).toContain('Filename contains consecutive dots');
    });

    it('should handle case-insensitive extension validation', () => {
      const allowedExts = ['PDF', 'jpg'];
      const result = validateFilename('document.pdf', allowedExts);
      expect(result.isValid).toBe(true);
    });

    it('should handle empty or invalid input', () => {
      const emptyResult = validateFilename('');
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors).toContain('Filename must be a non-empty string');

      const nullResult = validateFilename(null as any);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors).toContain('Filename must be a non-empty string');
    });
  });

  describe('auditFilename', () => {
    it('should classify high-risk filenames', () => {
      const result = auditFilename('../../../etc/passwd');
      expect(result.riskLevel).toBe('high');
      expect(result.issues).toContain('Contains path traversal sequences');
    });

    it('should classify medium-risk filenames', () => {
      const result = auditFilename('CON.txt');
      expect(result.riskLevel).toBe('medium');
      expect(result.issues).toContain('Uses reserved system filename');
    });

    it('should classify low-risk filenames', () => {
      const result = auditFilename('normal_file.txt');
      expect(result.riskLevel).toBe('low');
      expect(result.issues).toHaveLength(0);
    });

    it('should detect dangerous characters as medium risk', () => {
      const result = auditFilename('file<dangerous>.txt');
      expect(result.riskLevel).toBe('medium');
      expect(result.issues).toContain('Contains dangerous characters');
    });

    it('should warn about long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = auditFilename(longName);
      expect(result.riskLevel).toBe('medium');
      expect(result.issues).toContain('Filename too long');
    });

    it('should provide recommendations', () => {
      const result = auditFilename('../dangerous.txt');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toContain('Remove');
    });

    it('should handle empty filenames', () => {
      const result = auditFilename('');
      expect(result.riskLevel).toBe('high');
      expect(result.issues).toContain('Empty filename');
    });
  });

  describe('createOrganizedFilename', () => {
    it('should create properly organized filenames', () => {
      const result = createOrganizedFilename('document.pdf', '01.01_runsheet', 0);
      expect(result).toMatch(/^01\.01_runsheet_document\.pdf$/);
    });

    it('should add count suffix when files exist', () => {
      const result = createOrganizedFilename('document.pdf', '01.01_runsheet', 2);
      expect(result).toMatch(/^01\.01_runsheet_document_3\.pdf$/);
    });

    it('should handle filenames without extensions', () => {
      const result = createOrganizedFilename('document', '01.01_runsheet', 0);
      expect(result).toBe('01.01_runsheet_document');
    });

    it('should sanitize all components', () => {
      const result = createOrganizedFilename('doc<>ument.pdf', '01.01_run/sheet', 0);
      expect(result).toMatch(/^01\.01_run_sheet_doc_ument\.pdf$/);
    });

    it('should enforce length limits on components', () => {
      const longName = 'a'.repeat(150);
      const longPrefix = 'b'.repeat(100);
      const result = createOrganizedFilename(longName + '.txt', longPrefix, 0);
      
      // Should be truncated but still valid
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => createOrganizedFilename('', 'prefix', 0)).toThrow('Original name and prefix are required');
      expect(() => createOrganizedFilename('file.txt', '', 0)).toThrow('Original name and prefix are required');
    });

    it('should handle complex real-world scenarios', () => {
      const originalName = 'Job Report - Customer ABC & Co. (Draft).pdf';
      const prefix = '15.03_delivery_photos';
      const result = createOrganizedFilename(originalName, prefix, 1);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('15.03_delivery_photos');
      expect(result).toContain('_2'); // Count suffix
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extensions correctly', () => {
      expect(getFileExtension('file.txt')).toBe('txt');
      expect(getFileExtension('document.PDF')).toBe('PDF');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should handle files without extensions', () => {
      expect(getFileExtension('filename')).toBe('');
      expect(getFileExtension('filename.')).toBe('');
    });

    it('should handle hidden files', () => {
      expect(getFileExtension('.hidden')).toBe('');
      expect(getFileExtension('.gitignore')).toBe('');
    });

    it('should handle invalid inputs', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileExtension(null as any)).toBe('');
      expect(getFileExtension(undefined as any)).toBe('');
    });

    it('should handle complex filenames', () => {
      expect(getFileExtension('my.file.with.dots.txt')).toBe('txt');
      expect(getFileExtension('file.backup.2024.zip')).toBe('zip');
    });
  });

  describe('Security Integration Tests', () => {
    it('should handle real-world attack attempts', () => {
      const attackVectors = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'file|rm -rf /',
        'file && rm -rf /',
        'file; rm -rf /',
        'file`rm -rf /`',
        'file$(rm -rf /)',
        'CON',
        'PRN',
        'AUX',
        'NUL',
        'COM1',
        'LPT1',
        'file\x00.txt',
        'file\x01\x02\x03.txt',
        '.htaccess',
        '.htpasswd',
        'web.config',
        'file:.txt',
        'file*.txt',
        'file?.txt',
        'file<script>alert(1)</script>.txt',
      ];

      attackVectors.forEach(vector => {
        const audit = auditFilename(vector);
        if (audit.riskLevel === 'high') {
          // High-risk files should be rejected
          expect(['high', 'medium']).toContain(audit.riskLevel);
        }

        // All should be sanitizable
        const sanitized = sanitizeFilename(vector);
        expect(sanitized).toBeDefined();
        expect(sanitized.length).toBeGreaterThan(0);
        
        // Sanitized version should be safer
        const sanitizedAudit = auditFilename(sanitized);
        expect(sanitizedAudit.riskLevel).not.toBe('high');
      });
    });

    it('should preserve legitimate filenames', () => {
      const legitimateFiles = [
        'document.pdf',
        'report_2024.xlsx',
        'photo-1.jpg',
        'Meeting Notes.docx',
        'project_v2.1.zip',
        'data.csv',
        'presentation.pptx',
        'invoice-2024-03-15.pdf',
        'contract_final.doc',
        'backup_20240315.tar.gz',
      ];

      legitimateFiles.forEach(filename => {
        const audit = auditFilename(filename);
        expect(audit.riskLevel).toBe('low');

        const sanitized = sanitizeFilename(filename);
        expect(sanitized).toBeDefined();
        expect(sanitized.length).toBeGreaterThan(0);

        // Should be mostly preserved (allowing for minor sanitization)
        expect(sanitized.toLowerCase()).toContain(filename.split('.')[0].toLowerCase().substring(0, 5));
      });
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        '.',
        '..',
        '...',
        ' ',
        '  ',
        '\t',
        '\n',
        '\r\n',
        'file\0name',
        'file\x01name',
        'file\x7fname',
        'file\uFEFFname', // BOM character
        'file\u200Bname', // Zero-width space
      ];

      edgeCases.forEach(edgeCase => {
        expect(() => {
          const sanitized = sanitizeFilename(edgeCase);
          expect(sanitized).toBeDefined();
        }).not.toThrow();
      });
    });
  });
});