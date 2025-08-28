// src/constants/files.ts - FILE CONSTANTS (SEPARATE FROM TYPES)
// FIXED: Constants must be in separate file from types to avoid import type issues

// FIXED: Accepted file types as const assertion for proper typing
export const ACCEPTED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4', 'video/webm', 'audio/mp3', 'audio/wav', 'text/plain', 'text/csv'
] as const;

// FIXED: File size limits
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// FIXED: Upload limits
export const DEFAULT_MAX_FILES = 10;