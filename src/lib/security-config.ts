/**
 * Security configuration constants
 */

export const RATE_LIMIT_CONFIG = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  
  EXPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
  },
  
  IMPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },
};

export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    CSV: 10 * 1024 * 1024, // 10MB
    PDF: 20 * 1024 * 1024, // 20MB
    ATTACHMENT: 20 * 1024 * 1024, // 20MB for job attachments
  },
  
  ALLOWED_TYPES: {
    IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    CSV: ['text/csv', 'application/csv'],
    PDF: ['application/pdf'],
  },
  
  ALLOWED_EXTENSIONS: {
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    CSV: ['.csv'],
    PDF: ['.pdf'],
  },
};

export const VALIDATION_LIMITS = {
  STRING_LENGTHS: {
    SHORT: 50,
    MEDIUM: 100,
    LONG: 200,
    VERY_LONG: 500,
    MAX: 1000,
  },
  
  NUMERIC_LIMITS: {
    MIN_PRICE: 0,
    MAX_PRICE: 999999.99,
    MIN_HOURS: 0,
    MAX_HOURS: 24,
  },
  
  DATE_LIMITS: {
    MIN_DATE: new Date('2020-01-01'),
    MAX_DATE: new Date('2030-12-31'),
  },
};

export const SECURITY_HEADERS = {
  CSP: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
  PERMISSIONS_POLICY: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  HSTS: 'max-age=31536000; includeSubDomains',
};

export const CORS_CONFIG = {
  ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? [process.env.ALLOWED_ORIGIN || 'https://yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
  
  ALLOW_CREDENTIALS: true,
  
  MAX_AGE: 86400,
};

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

export const LOGGING_CONFIG = {
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  },
  
  SENSITIVE_FIELDS: [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
  ],
  
  REQUEST_LOGGING: {
    ENABLED: true,
    LOG_BODY: false,
    LOG_HEADERS: ['user-agent', 'x-forwarded-for'],
  },
}; 