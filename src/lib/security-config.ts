/**
 * Security configuration constants
 */

// Rate limiting configurations
export const RATE_LIMIT_CONFIG = {
  // General API endpoints
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  
  // Authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  
  // File upload endpoints
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  
  // Export endpoints
  EXPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
  },
  
  // Import endpoints
  IMPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },
};

// File upload security settings
export const FILE_UPLOAD_CONFIG = {
  // Maximum file sizes
  MAX_FILE_SIZE: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    CSV: 10 * 1024 * 1024, // 10MB
    PDF: 20 * 1024 * 1024, // 20MB
  },
  
  // Allowed file types
  ALLOWED_TYPES: {
    IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    CSV: ['text/csv', 'application/csv'],
    PDF: ['application/pdf'],
  },
  
  // Allowed file extensions
  ALLOWED_EXTENSIONS: {
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    CSV: ['.csv'],
    PDF: ['.pdf'],
  },
};

// Input validation limits
export const VALIDATION_LIMITS = {
  // String field lengths
  STRING_LENGTHS: {
    SHORT: 50,
    MEDIUM: 100,
    LONG: 200,
    VERY_LONG: 500,
    MAX: 1000,
  },
  
  // Numeric limits
  NUMERIC_LIMITS: {
    MIN_PRICE: 0,
    MAX_PRICE: 999999.99,
    MIN_HOURS: 0,
    MAX_HOURS: 24,
  },
  
  // Date limits
  DATE_LIMITS: {
    MIN_DATE: new Date('2020-01-01'),
    MAX_DATE: new Date('2030-12-31'),
  },
};

// Security headers configuration
export const SECURITY_HEADERS = {
  // Content Security Policy
  CSP: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
  
  // Permissions Policy
  PERMISSIONS_POLICY: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  
  // HSTS (only in production)
  HSTS: 'max-age=31536000; includeSubDomains',
};

// CORS configuration
export const CORS_CONFIG = {
  // Allowed origins
  ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? [process.env.ALLOWED_ORIGIN || 'https://yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  
  // Allowed methods
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  // Allowed headers
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
  
  // Credentials
  ALLOW_CREDENTIALS: true,
  
  // Max age
  MAX_AGE: 86400,
};

// Error messages (generic to avoid information disclosure)
export const ERROR_MESSAGES = {
  AUTHENTICATION: {
    UNAUTHORIZED: 'Authentication required',
    INVALID_CREDENTIALS: 'Invalid credentials',
    TOKEN_EXPIRED: 'Authentication token expired',
  },
  
  VALIDATION: {
    INVALID_INPUT: 'Invalid input data',
    MISSING_REQUIRED: 'Missing required fields',
    INVALID_FORMAT: 'Invalid data format',
  },
  
  FILE_UPLOAD: {
    INVALID_FILE: 'Invalid file type',
    FILE_TOO_LARGE: 'File size exceeds limit',
    UPLOAD_FAILED: 'File upload failed',
  },
  
  RATE_LIMIT: {
    TOO_MANY_REQUESTS: 'Too many requests, please try again later',
  },
  
  GENERAL: {
    INTERNAL_ERROR: 'Internal server error',
    NOT_FOUND: 'Resource not found',
    FORBIDDEN: 'Access denied',
  },
};

// Logging configuration
export const LOGGING_CONFIG = {
  // Log levels
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  },
  
  // Sensitive fields to redact in logs
  SENSITIVE_FIELDS: [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
  ],
  
  // Request logging
  REQUEST_LOGGING: {
    ENABLED: true,
    LOG_BODY: false, // Don't log request bodies for security
    LOG_HEADERS: ['user-agent', 'x-forwarded-for'],
  },
}; 