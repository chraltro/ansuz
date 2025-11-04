/**
 * Rate limiter and concurrent task processor for Ansuz
 * Optimizes API calls and prevents rate limit errors
 */

export interface RateLimiterConfig {
  maxConcurrent: number; // Maximum concurrent requests
  minInterval: number; // Minimum interval between requests in ms
  maxRetries: number; // Maximum retry attempts for failed requests
  retryDelay: number; // Base delay for exponential backoff in ms
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxConcurrent: 3,
  minInterval: 500, // 500ms between requests
  maxRetries: 3,
  retryDelay: 1000, // Start with 1s delay, then exponential backoff
};

export interface Task<T> {
  id: string;
  execute: () => Promise<T>;
  priority?: number; // Higher priority = executed first
  retries?: number;
}

export interface TaskResult<T> {
  id: string;
  success: boolean;
  data?: T;
  error?: Error;
  retries: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private queue: Task<any>[] = [];
  private activeCount: number = 0;
  private lastRequestTime: number = 0;
  private results: Map<string, TaskResult<any>> = new Map();
  private progressCallback?: (completed: number, total: number) => void;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config };
  }

  /**
   * Add a task to the queue
   */
  addTask<T>(task: Task<T>): void {
    this.queue.push(task);
    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Add multiple tasks to the queue
   */
  addTasks<T>(tasks: Task<T>[]): void {
    tasks.forEach(task => this.addTask(task));
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (completed: number, total: number) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Execute all tasks with rate limiting and concurrency control
   */
  async executeAll<T>(): Promise<TaskResult<T>[]> {
    const totalTasks = this.queue.length;
    const promises: Promise<void>[] = [];

    // Start initial batch of concurrent tasks
    for (let i = 0; i < Math.min(this.config.maxConcurrent, this.queue.length); i++) {
      promises.push(this.processNext());
    }

    // Wait for all tasks to complete
    await Promise.all(promises);

    // Return results in order
    const results: TaskResult<T>[] = [];
    this.results.forEach((result) => {
      results.push(result);
    });

    // Clear state
    this.queue = [];
    this.activeCount = 0;
    this.results.clear();

    return results;
  }

  /**
   * Process the next task in queue
   */
  private async processNext(): Promise<void> {
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.activeCount++;
      await this.executeTask(task);
      this.activeCount--;

      // Report progress
      if (this.progressCallback) {
        this.progressCallback(this.results.size, this.results.size + this.queue.length);
      }
    }
  }

  /**
   * Execute a single task with retry logic and rate limiting
   */
  private async executeTask<T>(task: Task<T>): Promise<void> {
    const maxRetries = task.retries ?? this.config.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Rate limiting: ensure minimum interval between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.config.minInterval) {
          await this.sleep(this.config.minInterval - timeSinceLastRequest);
        }

        this.lastRequestTime = Date.now();

        // Execute the task
        const data = await task.execute();

        // Store successful result
        this.results.set(task.id, {
          id: task.id,
          success: true,
          data,
          retries: attempt,
        });

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this wasn't the last attempt, wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          console.warn(`Task ${task.id} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error);
          await this.sleep(delay);
        }
      }
    }

    // Store failed result after all retries exhausted
    this.results.set(task.id, {
      id: task.id,
      success: false,
      error: lastError,
      retries: maxRetries,
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queued: number;
    active: number;
    completed: number;
    total: number;
  } {
    return {
      queued: this.queue.length,
      active: this.activeCount,
      completed: this.results.size,
      total: this.queue.length + this.results.size,
    };
  }
}

/**
 * Batch processor for file analysis
 * Automatically handles concurrent processing with progress updates
 */
export class FileBatchProcessor {
  private rateLimiter: RateLimiter;
  private onProgressCallback?: (current: number, total: number, fileName?: string) => void;
  private onErrorCallback?: (fileName: string, error: Error) => void;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.rateLimiter = new RateLimiter(config);
  }

  /**
   * Process multiple files concurrently
   */
  async processFiles<T>(
    files: Array<{ name: string; process: () => Promise<T> }>,
    options?: {
      onProgress?: (current: number, total: number, fileName?: string) => void;
      onError?: (fileName: string, error: Error) => void;
      priority?: (fileName: string) => number;
    }
  ): Promise<Array<{ name: string; result: T | null; error?: Error }>> {
    this.onProgressCallback = options?.onProgress;
    this.onErrorCallback = options?.onError;

    // Create tasks
    const tasks: Task<T>[] = files.map(file => ({
      id: file.name,
      execute: file.process,
      priority: options?.priority?.(file.name) || 0,
    }));

    // Add tasks to rate limiter
    this.rateLimiter.addTasks(tasks);

    // Set up progress callback
    this.rateLimiter.onProgress((completed, total) => {
      this.onProgressCallback?.(completed, total);
    });

    // Execute all tasks
    const results = await this.rateLimiter.executeAll<T>();

    // Process results and report errors
    return results.map(result => {
      if (!result.success && result.error) {
        this.onErrorCallback?.(result.id, result.error);
      }

      return {
        name: result.id,
        result: result.success ? result.data ?? null : null,
        error: result.error,
      };
    });
  }
}

/**
 * Create a throttled function that limits how often it can be called
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastRun >= limitMs) {
      lastRun = now;
      func.apply(this, args);
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastRun = Date.now();
        func.apply(this, args);
      }, limitMs - (now - lastRun));
    }
  };
}

/**
 * Create a debounced function that delays execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delayMs);
  };
}
