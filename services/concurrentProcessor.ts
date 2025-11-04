/**
 * Concurrent file processing service for Ansuz
 * Enables parallel API calls with rate limiting for faster analysis
 */

import { FileBatchProcessor } from '../utils/rateLimiter';
import { explainFileInBulk, type ExplanationLevel } from './geminiService';
import type { Explanation, FileNode } from '../types';

export interface ProcessingProgress {
  current: number;
  total: number;
  currentFile?: string;
  percentage: number;
}

export interface ProcessingOptions {
  apiKey: string;
  level: ExplanationLevel;
  onProgress?: (progress: ProcessingProgress) => void;
  onFileComplete?: (filePath: string, explanation: Explanation | null) => void;
  onError?: (filePath: string, error: Error) => void;
  maxConcurrent?: number;
  minInterval?: number;
}

/**
 * Process multiple files concurrently with rate limiting
 */
export async function processFilesInParallel(
  files: Array<{ path: string; name: string; content: string }>,
  options: ProcessingOptions
): Promise<Map<string, Explanation>> {
  const {
    apiKey,
    level,
    onProgress,
    onFileComplete,
    onError,
    maxConcurrent = 3,
    minInterval = 500,
  } = options;

  const processor = new FileBatchProcessor({
    maxConcurrent,
    minInterval,
    maxRetries: 3,
    retryDelay: 1000,
  });

  // Prepare file processing tasks
  const fileProcessors = files.map(file => ({
    name: file.path,
    process: async () => {
      try {
        const stream = await explainFileInBulk(file.name, file.content, apiKey, level);
        const explanation = await parseStreamingResponse(stream);

        // Report completion
        onFileComplete?.(file.path, explanation);

        return { path: file.path, explanation };
      } catch (error) {
        console.error(`Error processing ${file.path}:`, error);
        throw error;
      }
    },
  }));

  // Process files with progress tracking
  const results = await processor.processFiles(fileProcessors, {
    onProgress: (current, total, fileName) => {
      const percentage = Math.round((current / total) * 100);
      onProgress?.({
        current,
        total,
        currentFile: fileName,
        percentage,
      });
    },
    onError: (fileName, error) => {
      onError?.(fileName, error);
    },
    // Prioritize smaller files first for faster initial results
    priority: (fileName) => {
      const file = files.find(f => f.path === fileName);
      return file ? -file.content.length : 0; // Negative to prioritize smaller files
    },
  });

  // Build explanation map
  const explanationMap = new Map<string, Explanation>();
  results.forEach(result => {
    if (result.result?.explanation) {
      explanationMap.set(result.result.path, result.result.explanation);
    }
  });

  return explanationMap;
}

/**
 * Parse streaming response from Gemini API
 */
async function parseStreamingResponse(stream: any): Promise<Explanation> {
  const blocks: any[] = [];
  let buffer = '';

  for await (const chunk of stream) {
    if (chunk.text) {
      buffer += chunk.text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmedLine);
            if (parsed.code_block && parsed.explanation) {
              blocks.push(parsed);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim() && buffer.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(buffer.trim());
      if (parsed.code_block && parsed.explanation) {
        blocks.push(parsed);
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  return { blocks };
}

/**
 * Extract all code files from a file tree
 */
export function extractCodeFiles(
  fileTree: FileNode,
  basePath: string = ''
): Array<{ path: string; name: string; content: string }> {
  const files: Array<{ path: string; name: string; content: string }> = [];

  function traverse(node: FileNode, currentPath: string) {
    const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;

    if (node.content !== null) {
      // This is a file
      files.push({
        path: fullPath,
        name: node.name,
        content: node.content,
      });
    }

    // Recurse into children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child, fullPath);
      }
    }
  }

  traverse(fileTree, basePath);
  return files;
}

/**
 * Estimate processing time based on file count and sizes
 */
export function estimateProcessingTime(files: Array<{ content: string }>, maxConcurrent: number): {
  minSeconds: number;
  maxSeconds: number;
  formattedRange: string;
} {
  const avgTimePerFile = 3; // Average 3 seconds per file
  const totalFiles = files.length;

  // Calculate time with concurrency
  const batches = Math.ceil(totalFiles / maxConcurrent);
  const minSeconds = batches * avgTimePerFile;
  const maxSeconds = minSeconds * 1.5; // Add 50% buffer

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return {
    minSeconds,
    maxSeconds,
    formattedRange: `${formatTime(minSeconds)} - ${formatTime(maxSeconds)}`,
  };
}
