/**
 * File security utilities for robust filename sanitization and validation
 * Prevents path traversal attacks and handles special characters safely
 */

/**
 * Configuration for filename sanitization
 */
interface SanitizationConfig {
  maxLength: number;
  allowedExtensions?: string[];
  preserveCase?: boolean;
  replacementChar: string;
}

/**
 * Default sanitization configuration
 */
const DEFAULT_CONFIG: SanitizationConfig = {
  maxLength: 255, // Maximum filename length (most filesystems support this)
  preserveCase: true,
  replacementChar: '_',
};

/**
 * Reserved filenames that should be rejected (Windows and other systems)
 */
const RESERVED_NAMES = new Set([
  // Windows reserved names
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  // Common problematic names
  '.', '..', '$Recycle.Bin', 'System Volume Information',
]);

/**
 * Characters that are potentially dangerous in filenames
 * Includes path traversal, shell metacharacters, and filesystem-specific chars
 */
const DANGEROUS_CHARS = /[<>:"|?*\\/\x00-\x1f\x7f-\x9f@#$%^&(){}[\]+=`~!]/g;

/**
 * Path traversal patterns to detect and prevent
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./g,           // Parent directory traversal
  /~\//g,            // Home directory access
  /^\/+/g,           // Absolute paths
  /\/\/+/g,          // Multiple slashes
  /^\.+$/g,          // Only dots
];

/**
 * Sanitizes a filename to prevent security issues and ensure filesystem compatibility
 * 
 * @param filename - The original filename to sanitize
 * @param config - Optional configuration for sanitization
 * @returns Sanitized filename safe for use in file operations
 * 
 * Security protections:
 * - Removes path traversal sequences (../, ~/, etc.)
 * - Strips dangerous characters (<>:"|?*\/ and control chars)
 * - Prevents reserved system filenames
 * - Enforces length limits
 * - Normalizes Unicode characters
 * - Removes leading/trailing dots and spaces
 */
export function sanitizeFilename(filename: string, config: Partial<SanitizationConfig> = {}): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: must be a non-empty string');
  }

  // Start with the original filename
  let sanitized = filename;

  // Normalize Unicode characters to prevent bypass attempts
  sanitized = sanitized.normalize('NFD');

  // Remove or replace path traversal patterns
  PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove dangerous characters
  sanitized = sanitized.replace(DANGEROUS_CHARS, finalConfig.replacementChar);

  // Replace multiple consecutive spaces/underscores with single replacement char
  sanitized = sanitized.replace(/[\s_]{2,}/g, finalConfig.replacementChar);

  // Remove leading and trailing dots, spaces, and replacement chars
  sanitized = sanitized.replace(/^[.\s_]+|[.\s_]+$/g, '');

  // Handle case sensitivity
  if (!finalConfig.preserveCase) {
    sanitized = sanitized.toLowerCase();
  }

  // Check for reserved names
  const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
  if (RESERVED_NAMES.has(nameWithoutExt)) {
    sanitized = `${finalConfig.replacementChar}${sanitized}`;
  }

  // Enforce length limits
  if (sanitized.length > finalConfig.maxLength) {
    const ext = getFileExtension(sanitized);
    const nameLimit = finalConfig.maxLength - ext.length - 1; // -1 for the dot
    const truncatedName = sanitized.substring(0, nameLimit);
    sanitized = ext ? `${truncatedName}.${ext}` : truncatedName;
  }

  // Ensure we have a valid filename after sanitization
  if (!sanitized || sanitized.length === 0) {
    sanitized = `${finalConfig.replacementChar}file`;
  }

  // Final validation
  if (sanitized.length > finalConfig.maxLength) {
    throw new Error(`Sanitized filename exceeds maximum length: ${finalConfig.maxLength}`);
  }

  return sanitized;
}

/**
 * Sanitizes a folder/directory name using stricter rules
 * 
 * @param folderName - The original folder name to sanitize
 * @param config - Optional configuration for sanitization
 * @returns Sanitized folder name safe for directory operations
 */
export function sanitizeFolderName(folderName: string, config: Partial<SanitizationConfig> = {}): string {
  const folderConfig = {
    ...DEFAULT_CONFIG,
    maxLength: 128, // Folders should be shorter for better compatibility
    ...config,
  };

  if (!folderName || typeof folderName !== 'string') {
    throw new Error('Invalid folder name: must be a non-empty string');
  }

  // Use the same sanitization as filenames but without extensions
  let sanitized = sanitizeFilename(folderName, folderConfig);

  // Remove any remaining dots at the end (not allowed in folder names on some systems)
  sanitized = sanitized.replace(/\.+$/, '');

  // Ensure we have a valid folder name
  if (!sanitized || sanitized.length === 0) {
    sanitized = folderConfig.replacementChar + 'folder';
  }

  return sanitized;
}

/**
 * Validates a filename for additional security checks
 * 
 * @param filename - The filename to validate
 * @param allowedExtensions - Optional array of allowed file extensions
 * @returns Validation result with details
 */
export function validateFilename(filename: string, allowedExtensions?: string[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!filename || typeof filename !== 'string') {
    errors.push('Filename must be a non-empty string');
    return { isValid: false, errors, warnings };
  }

  // Check for potentially dangerous patterns
  if (DANGEROUS_CHARS.test(filename)) {
    errors.push('Filename contains dangerous characters');
  }

  // Check for path traversal attempts
  if (PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(filename))) {
    errors.push('Filename contains path traversal sequences');
  }

  // Check for reserved names
  const nameWithoutExt = filename.split('.')[0].toUpperCase();
  if (RESERVED_NAMES.has(nameWithoutExt)) {
    warnings.push('Filename uses a reserved system name');
  }

  // Check length
  if (filename.length > DEFAULT_CONFIG.maxLength) {
    errors.push(`Filename exceeds maximum length of ${DEFAULT_CONFIG.maxLength} characters`);
  }

  // Check extension if allowlist provided
  if (allowedExtensions && allowedExtensions.length > 0) {
    const ext = getFileExtension(filename).toLowerCase();
    const normalizedAllowed = allowedExtensions.map(e => e.toLowerCase().replace(/^\./, ''));
    
    if (!normalizedAllowed.includes(ext)) {
      errors.push(`File extension '${ext}' is not allowed. Allowed: ${normalizedAllowed.join(', ')}`);
    }
  }

  // Check for suspicious patterns
  if (filename.includes('..')) {
    warnings.push('Filename contains consecutive dots');
  }

  if (/^\./.test(filename)) {
    warnings.push('Filename starts with a dot (hidden file)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Extracts the file extension from a filename
 * 
 * @param filename - The filename to extract extension from
 * @returns The file extension without the dot
 */
export function getFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }

  // Handle hidden files (files starting with .)
  if (filename.startsWith('.') && lastDotIndex === 0) {
    return '';
  }

  return filename.substring(lastDotIndex + 1);
}

/**
 * Creates a safe filename for organization purposes (job attachments)
 * Combines date, type, and original name with proper sanitization
 * 
 * @param originalName - The original filename
 * @param prefix - Organization prefix (e.g., "01.01_runsheet")
 * @param existingCount - Number of existing files with similar names
 * @returns Safe, organized filename
 */
export function createOrganizedFilename(
  originalName: string,
  prefix: string,
  existingCount: number = 0
): string {
  // Validate inputs
  if (!originalName || !prefix) {
    throw new Error('Original name and prefix are required');
  }

  // Extract only extension from original filename
  const lastDotIndex = originalName.lastIndexOf('.');
  const extension = lastDotIndex > 0 
    ? originalName.substring(lastDotIndex + 1) 
    : '';

  // Sanitize components
  const sanitizedPrefix = sanitizeFilename(prefix, { maxLength: 80 }); // Increased for new format
  const sanitizedExt = extension ? sanitizeFilename(extension, { maxLength: 10 }) : '';

  // Build the filename using only the prefix
  let filename = sanitizedPrefix;
  
  // Add count suffix if needed
  if (existingCount > 0) {
    filename += `_${existingCount + 1}`;
  }

  // Add extension if present
  if (sanitizedExt) {
    filename += `.${sanitizedExt}`;
  }

  // Final sanitization and validation
  filename = sanitizeFilename(filename);
  
  const validation = validateFilename(filename);
  if (!validation.isValid) {
    throw new Error(`Generated filename is invalid: ${validation.errors.join(', ')}`);
  }

  return filename;
}

/**
 * Security audit function to check for potential issues in filenames
 * 
 * @param filename - The filename to audit
 * @returns Security audit results
 */
export function auditFilename(filename: string): {
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  if (!filename) {
    return { riskLevel: 'high', issues: ['Empty filename'], recommendations: ['Provide a valid filename'] };
  }

  // High risk issues
  if (PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(filename))) {
    issues.push('Contains path traversal sequences');
    recommendations.push('Remove ../, ~/, and other path traversal patterns');
    riskLevel = 'high';
  }

  if (DANGEROUS_CHARS.test(filename)) {
    issues.push('Contains dangerous characters');
    recommendations.push('Remove or replace special characters like <, >, :, |, ?, *, \\, /');
    if (riskLevel !== 'high') riskLevel = 'medium';
  }

  // Medium risk issues
  const nameWithoutExt = filename.split('.')[0].toUpperCase();
  if (RESERVED_NAMES.has(nameWithoutExt)) {
    issues.push('Uses reserved system filename');
    recommendations.push('Choose a different filename that is not reserved by the operating system');
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  if (filename.length > DEFAULT_CONFIG.maxLength) {
    issues.push('Filename too long');
    recommendations.push(`Shorten filename to ${DEFAULT_CONFIG.maxLength} characters or less`);
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  // Low risk issues (warnings)
  if (/^\./.test(filename)) {
    issues.push('Hidden file (starts with dot)');
    recommendations.push('Consider using a non-hidden filename');
  }

  if (/\s{2,}/.test(filename)) {
    issues.push('Contains multiple consecutive spaces');
    recommendations.push('Replace multiple spaces with single spaces or underscores');
  }

  return { riskLevel, issues, recommendations };
}