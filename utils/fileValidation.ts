/**
 * File validation utilities for Ansuz
 * Ensures uploaded files meet size and count requirements
 */

export const FILE_LIMITS = {
  MAX_FILES: 25,
  MAX_FILE_SIZE_MB: 5, // 5MB per file
  MAX_TOTAL_SIZE_MB: 50, // 50MB total
  MAX_LINE_COUNT: 10000, // Maximum lines per file for performance
} as const;

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface FileInfo {
  name: string;
  size: number;
  lineCount?: number;
}

/**
 * Validates a single file against size and content limits
 */
export function validateFile(file: File): FileValidationResult {
  const maxSizeBytes = FILE_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File "${file.name}" is too large (${formatFileSize(file.size)}). Maximum file size is ${FILE_LIMITS.MAX_FILE_SIZE_MB}MB.`,
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      isValid: false,
      error: `File "${file.name}" is empty.`,
    };
  }

  return { isValid: true };
}

/**
 * Validates file content (line count, character limits)
 */
export function validateFileContent(content: string, fileName: string): FileValidationResult {
  const warnings: string[] = [];

  // Check line count
  const lineCount = content.split('\n').length;
  if (lineCount > FILE_LIMITS.MAX_LINE_COUNT) {
    warnings.push(
      `File "${fileName}" has ${lineCount.toLocaleString()} lines. Files with more than ${FILE_LIMITS.MAX_LINE_COUNT.toLocaleString()} lines may experience performance issues.`
    );
  }

  // Check for extremely long lines that might cause rendering issues
  const lines = content.split('\n');
  const longLines = lines.filter(line => line.length > 1000);
  if (longLines.length > 0) {
    warnings.push(
      `File "${fileName}" contains ${longLines.length} lines longer than 1000 characters, which may affect display performance.`
    );
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validates multiple files for count and total size
 */
export function validateFileList(files: File[] | FileList): FileValidationResult {
  const fileArray = Array.from(files);

  // Check file count
  if (fileArray.length === 0) {
    return {
      isValid: false,
      error: 'No files selected.',
    };
  }

  if (fileArray.length > FILE_LIMITS.MAX_FILES) {
    return {
      isValid: false,
      error: `Too many files selected (${fileArray.length}). This tool supports up to ${FILE_LIMITS.MAX_FILES} files at once. Please select fewer files or break your upload into smaller batches.`,
    };
  }

  // Check total size
  const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
  const maxTotalSizeBytes = FILE_LIMITS.MAX_TOTAL_SIZE_MB * 1024 * 1024;

  if (totalSize > maxTotalSizeBytes) {
    return {
      isValid: false,
      error: `Total size of selected files (${formatFileSize(totalSize)}) exceeds the maximum limit of ${FILE_LIMITS.MAX_TOTAL_SIZE_MB}MB.`,
    };
  }

  // Validate each file individually
  for (const file of fileArray) {
    const result = validateFile(file);
    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}

/**
 * Validates pasted content size
 */
export function validatePastedContent(content: string): FileValidationResult {
  const sizeBytes = new Blob([content]).size;
  const maxSizeBytes = FILE_LIMITS.MAX_TOTAL_SIZE_MB * 1024 * 1024;

  if (sizeBytes > maxSizeBytes) {
    return {
      isValid: false,
      error: `Pasted content is too large (${formatFileSize(sizeBytes)}). Maximum size is ${FILE_LIMITS.MAX_TOTAL_SIZE_MB}MB.`,
    };
  }

  if (content.trim().length === 0) {
    return {
      isValid: false,
      error: 'Pasted content is empty.',
    };
  }

  return { isValid: true };
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Checks if file type is supported (text-based files)
 */
export function isSupportedFileType(fileName: string): boolean {
  // Allow files without extensions (like README, Makefile, Dockerfile)
  if (!fileName.includes('.')) {
    return true;
  }

  const textExtensions = [
    // Programming languages
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs',
    'rb', 'go', 'rs', 'php', 'swift', 'kt', 'scala', 'r', 'lua', 'perl',
    'sh', 'bash', 'zsh', 'fish',

    // Web
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',

    // Config & Data
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config',
    'env', 'properties',

    // Markup & Documentation
    'md', 'markdown', 'rst', 'txt', 'text', 'log',

    // SQL
    'sql', 'psql', 'mysql',

    // Other
    'dockerfile', 'gitignore', 'editorconfig', 'npmrc', 'nvmrc',
  ];

  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(extension);
}

/**
 * Filters out unsupported binary files from file list
 */
export function filterSupportedFiles(files: File[]): {
  supported: File[];
  unsupported: File[];
} {
  const supported: File[] = [];
  const unsupported: File[] = [];

  for (const file of files) {
    if (isSupportedFileType(file.name)) {
      supported.push(file);
    } else {
      unsupported.push(file);
    }
  }

  return { supported, unsupported };
}

/**
 * Comprehensive validation for file upload
 */
export async function validateAndFilterFiles(files: File[] | FileList): Promise<{
  files: File[];
  errors: string[];
  warnings: string[];
}> {
  const fileArray = Array.from(files);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Filter supported files
  const { supported, unsupported } = filterSupportedFiles(fileArray);

  if (unsupported.length > 0) {
    warnings.push(
      `${unsupported.length} file(s) skipped (unsupported format): ${unsupported.slice(0, 3).map(f => f.name).join(', ')}${unsupported.length > 3 ? '...' : ''}`
    );
  }

  if (supported.length === 0) {
    errors.push('No supported text files found in selection.');
    return { files: [], errors, warnings };
  }

  // Validate file list
  const listValidation = validateFileList(supported);
  if (!listValidation.isValid) {
    errors.push(listValidation.error!);
    return { files: [], errors, warnings };
  }

  return {
    files: supported,
    errors,
    warnings,
  };
}
