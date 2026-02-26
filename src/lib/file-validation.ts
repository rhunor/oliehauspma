// src/lib/file-validation.ts
// Server-side file validation utility
import { logError, logWarn } from './logger';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface FileValidationConfig {
  maxSizeBytes?: number; // Maximum file size in bytes
  allowedMimeTypes?: string[]; // Allowed MIME types
  allowedExtensions?: string[]; // Allowed file extensions
  checkMagicNumbers?: boolean; // Verify file type by magic numbers (requires file-type package)
}

// Default allowed file types for the application
const DEFAULT_ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  
  // Text
  'text/plain',
  'text/csv',
  'application/json',
  
  // Archives (be careful with these)
  'application/zip',
  'application/x-zip-compressed',
  
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const DEFAULT_ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.json',
  '.zip',
  '.mp3', '.wav', '.ogg',
  '.mp4', '.webm', '.mov',
];

// Maximum file sizes by category (in bytes)
const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024, // 10MB
  document: 25 * 1024 * 1024, // 25MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 25 * 1024 * 1024, // 25MB
  default: 50 * 1024 * 1024, // 50MB
};

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Get file category from MIME type
 */
function getFileCategory(mimeType: string): keyof typeof MAX_FILE_SIZES {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) return 'document';
  return 'default';
}

/**
 * Validate file size
 */
function validateFileSize(
  file: File,
  maxSize?: number
): FileValidationResult {
  const category = getFileCategory(file.type);
  const maxSizeBytes = maxSize || MAX_FILE_SIZES[category];

  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    return {
      isValid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB) for ${category} files.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate file MIME type
 */
function validateMimeType(
  file: File,
  allowedTypes?: string[]
): FileValidationResult {
  const allowed = allowedTypes || DEFAULT_ALLOWED_MIME_TYPES;

  if (!allowed.includes(file.type)) {
    logWarn('Invalid file MIME type attempted', { 
      type: file.type, 
      name: file.name 
    }, 'FILE_VALIDATION');
    
    return {
      isValid: false,
      error: `File type "${file.type}" is not allowed. Please upload a valid file.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate file extension
 */
function validateExtension(
  filename: string,
  allowedExtensions?: string[]
): FileValidationResult {
  const extension = getFileExtension(filename);
  const allowed = allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS;

  if (!extension) {
    return {
      isValid: false,
      error: 'File must have a valid extension.',
    };
  }

  if (!allowed.includes(extension)) {
    logWarn('Invalid file extension attempted', { 
      extension, 
      filename 
    }, 'FILE_VALIDATION');
    
    return {
      isValid: false,
      error: `File extension "${extension}" is not allowed.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate filename for security issues
 */
function validateFilename(filename: string): FileValidationResult {
  const warnings: string[] = [];

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./g, // Path traversal
    /[<>:"|?*]/g, // Invalid characters
    /\0/g, // Null bytes
    /^\./g, // Hidden files
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filename)) {
      logWarn('Suspicious filename detected', { filename }, 'FILE_VALIDATION');
      return {
        isValid: false,
        error: 'Invalid filename. Please use a different file name.',
      };
    }
  }

  // Check filename length
  if (filename.length > 255) {
    return {
      isValid: false,
      error: 'Filename is too long. Maximum 255 characters allowed.',
    };
  }

  // Warn about double extensions (e.g., file.pdf.exe)
  const extensionCount = (filename.match(/\./g) || []).length;
  if (extensionCount > 1) {
    warnings.push('File has multiple extensions. Ensure this is intentional.');
  }

  return { isValid: true, warnings };
}

/**
 * Check file content using magic numbers (requires file-type package)
 * This verifies the actual file type, not just the extension
 */
async function validateFileContent(file: File): Promise<FileValidationResult> {
  try {
    // Import file-type dynamically (it's an ESM module)
    const { fileTypeFromBuffer } = await import('file-type');
    
    // Read first 4100 bytes (enough for magic number detection)
    const buffer = await file.slice(0, 4100).arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    const fileType = await fileTypeFromBuffer(uint8Array);

    if (!fileType) {
      // If we can't detect the file type, check if it's a text file
      if (file.type.startsWith('text/') || file.type === 'application/json') {
        return { isValid: true };
      }
      
      logWarn('Could not detect file type from content', { 
        name: file.name, 
        declaredType: file.type 
      }, 'FILE_VALIDATION');
      
      return {
        isValid: false,
        error: 'Could not verify file type. The file may be corrupted.',
      };
    }

    // Check if detected type matches declared type
    if (fileType.mime !== file.type) {
      // Some tolerance for JPEG variants
      const isJpegVariant = 
        (fileType.mime === 'image/jpeg' && file.type === 'image/jpg') ||
        (fileType.mime === 'image/jpg' && file.type === 'image/jpeg');

      if (!isJpegVariant) {
        logError(
          'File type mismatch detected',
          new Error(`Declared: ${file.type}, Actual: ${fileType.mime}`),
          'FILE_VALIDATION'
        );
        
        return {
          isValid: false,
          error: 'File type mismatch. The file content does not match its extension.',
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    logError('Error validating file content', error, 'FILE_VALIDATION');
    // Don't fail validation if magic number check fails
    // This is a secondary validation
    return { 
      isValid: true, 
      warnings: ['Could not verify file content type.'] 
    };
  }
}

/**
 * Main file validation function
 * Performs comprehensive server-side validation
 */
export async function validateFile(
  file: File,
  config: FileValidationConfig = {}
): Promise<FileValidationResult> {
  const warnings: string[] = [];

  // 1. Validate filename
  const filenameResult = validateFilename(file.name);
  if (!filenameResult.isValid) {
    return filenameResult;
  }
  if (filenameResult.warnings) {
    warnings.push(...filenameResult.warnings);
  }

  // 2. Validate file extension
  const extensionResult = validateExtension(file.name, config.allowedExtensions);
  if (!extensionResult.isValid) {
    return extensionResult;
  }

  // 3. Validate MIME type
  const mimeResult = validateMimeType(file, config.allowedMimeTypes);
  if (!mimeResult.isValid) {
    return mimeResult;
  }

  // 4. Validate file size
  const sizeResult = validateFileSize(file, config.maxSizeBytes);
  if (!sizeResult.isValid) {
    return sizeResult;
  }

  // 5. Validate file content (magic numbers)
  if (config.checkMagicNumbers !== false) {
    const contentResult = await validateFileContent(file);
    if (!contentResult.isValid) {
      return contentResult;
    }
    if (contentResult.warnings) {
      warnings.push(...contentResult.warnings);
    }
  }

  return { 
    isValid: true, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
}

/**
 * Validate multiple files
 */
export async function validateFiles(
  files: File[],
  config: FileValidationConfig = {}
): Promise<{ results: FileValidationResult[]; allValid: boolean }> {
  const results = await Promise.all(
    files.map(file => validateFile(file, config))
  );

  const allValid = results.every(result => result.isValid);

  return { results, allValid };
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove invalid characters
  sanitized = sanitized.replace(/[<>:"|?*\0]/g, '_');
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length);
    sanitized = nameWithoutExt.slice(0, 255 - ext.length) + ext;
  }
  
  return sanitized;
}

