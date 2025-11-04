/**
 * Performance monitoring and optimization utilities for Ansuz
 * Tracks rendering performance, API latency, and resource usage
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  totalDuration: number;
  operationCount: number;
  averageDuration: number;
  slowestOperation: PerformanceMetric | null;
  fastestOperation: PerformanceMetric | null;
  metrics: PerformanceMetric[];
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private enabled: boolean = true;

  /**
   * Start tracking a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
    };

    this.metrics.set(name, metric);
  }

  /**
   * End tracking a performance metric
   */
  end(name: string, additionalMetadata?: Record<string, any>): number | null {
    if (!this.enabled) return null;

    const metric = this.metrics.get(name);

    if (!metric) {
      console.warn(`Performance metric "${name}" was not started`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata };
    }

    this.completedMetrics.push(metric);
    this.metrics.delete(name);

    return metric.duration;
  }

  /**
   * Measure a function execution time
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) return fn();

    this.start(name, metadata);

    try {
      const result = await fn();
      this.end(name, { success: true });
      return result;
    } catch (error) {
      this.end(name, { success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Measure a synchronous function
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    if (!this.enabled) return fn();

    this.start(name, metadata);

    try {
      const result = fn();
      this.end(name, { success: true });
      return result;
    } catch (error) {
      this.end(name, { success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    if (this.completedMetrics.length === 0) {
      return {
        totalDuration: 0,
        operationCount: 0,
        averageDuration: 0,
        slowestOperation: null,
        fastestOperation: null,
        metrics: [],
      };
    }

    const totalDuration = this.completedMetrics.reduce(
      (sum, m) => sum + (m.duration || 0),
      0
    );

    const averageDuration = totalDuration / this.completedMetrics.length;

    const slowestOperation = this.completedMetrics.reduce((slowest, current) =>
      (current.duration || 0) > (slowest.duration || 0) ? current : slowest
    );

    const fastestOperation = this.completedMetrics.reduce((fastest, current) =>
      (current.duration || 0) < (fastest.duration || 0) ? current : fastest
    );

    return {
      totalDuration,
      operationCount: this.completedMetrics.length,
      averageDuration,
      slowestOperation,
      fastestOperation,
      metrics: [...this.completedMetrics],
    };
  }

  /**
   * Get metrics by name pattern
   */
  getMetricsByPattern(pattern: string | RegExp): PerformanceMetric[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.completedMetrics.filter(m => regex.test(m.name));
  }

  /**
   * Get metrics summary grouped by name prefix
   */
  getGroupedSummary(): Map<string, { count: number; totalDuration: number; avgDuration: number }> {
    const summary = new Map<string, { count: number; totalDuration: number; avgDuration: number }>();

    this.completedMetrics.forEach(metric => {
      const prefix = metric.name.split(':')[0];
      const current = summary.get(prefix) || { count: 0, totalDuration: 0, avgDuration: 0 };

      current.count++;
      current.totalDuration += metric.duration || 0;
      current.avgDuration = current.totalDuration / current.count;

      summary.set(prefix, current);
    });

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.completedMetrics = [];
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      report: this.getReport(),
      groupedSummary: Object.fromEntries(this.getGroupedSummary()),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    const report = this.getReport();

    console.group('📊 Performance Report');
    console.log(`Total Operations: ${report.operationCount}`);
    console.log(`Total Duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`Average Duration: ${report.averageDuration.toFixed(2)}ms`);

    if (report.slowestOperation) {
      console.log(`Slowest: ${report.slowestOperation.name} (${report.slowestOperation.duration?.toFixed(2)}ms)`);
    }

    if (report.fastestOperation) {
      console.log(`Fastest: ${report.fastestOperation.name} (${report.fastestOperation.duration?.toFixed(2)}ms)`);
    }

    console.groupEnd();

    // Log grouped summary
    const grouped = this.getGroupedSummary();
    if (grouped.size > 0) {
      console.group('📈 Grouped Summary');
      grouped.forEach((stats, prefix) => {
        console.log(`${prefix}: ${stats.count} ops, avg ${stats.avgDuration.toFixed(2)}ms`);
      });
      console.groupEnd();
    }
  }
}

/**
 * Global performance monitor instance
 */
export const perfMonitor = new PerformanceMonitor();

/**
 * React hook for measuring component render performance
 */
export function useMeasureRender(componentName: string): void {
  if (typeof window === 'undefined') return;

  const renderStart = performance.now();

  // Measure on mount and unmount
  React.useEffect(() => {
    const renderEnd = performance.now();
    const duration = renderEnd - renderStart;

    perfMonitor.start(`render:${componentName}`, { type: 'mount' });
    perfMonitor.end(`render:${componentName}`, { duration });

    return () => {
      perfMonitor.start(`unmount:${componentName}`);
      perfMonitor.end(`unmount:${componentName}`);
    };
  }, []);
}

/**
 * HOC for measuring component performance
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const name = componentName || Component.displayName || Component.name || 'Component';

  return (props: P) => {
    perfMonitor.start(`render:${name}`);

    React.useEffect(() => {
      perfMonitor.end(`render:${name}`);

      return () => {
        perfMonitor.start(`unmount:${name}`);
        perfMonitor.end(`unmount:${name}`);
      };
    }, []);

    return React.createElement(Component, props);
  };
}

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
  private snapshots: Array<{ timestamp: number; usage: any }> = [];

  /**
   * Take a memory snapshot
   */
  snapshot(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.snapshots.push({
        timestamp: Date.now(),
        usage: {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        },
      });

      // Keep only last 100 snapshots
      if (this.snapshots.length > 100) {
        this.snapshots.shift();
      }
    }
  }

  /**
   * Get memory usage trend
   */
  getTrend(): {
    increasing: boolean;
    avgUsage: number;
    maxUsage: number;
    minUsage: number;
  } {
    if (this.snapshots.length < 2) {
      return { increasing: false, avgUsage: 0, maxUsage: 0, minUsage: 0 };
    }

    const usages = this.snapshots.map(s => s.usage.usedJSHeapSize);
    const firstHalf = usages.slice(0, Math.floor(usages.length / 2));
    const secondHalf = usages.slice(Math.floor(usages.length / 2));

    const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return {
      increasing: avgSecondHalf > avgFirstHalf,
      avgUsage: usages.reduce((a, b) => a + b, 0) / usages.length,
      maxUsage: Math.max(...usages),
      minUsage: Math.min(...usages),
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Log memory usage
   */
  logUsage(): void {
    if (this.snapshots.length === 0) {
      console.log('No memory snapshots available');
      return;
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const trend = this.getTrend();

    console.group('💾 Memory Usage');
    console.log(`Current: ${this.formatBytes(latest.usage.usedJSHeapSize)}`);
    console.log(`Total: ${this.formatBytes(latest.usage.totalJSHeapSize)}`);
    console.log(`Limit: ${this.formatBytes(latest.usage.jsHeapSizeLimit)}`);
    console.log(`Average: ${this.formatBytes(trend.avgUsage)}`);
    console.log(`Trend: ${trend.increasing ? '📈 Increasing' : '📉 Stable/Decreasing'}`);
    console.groupEnd();
  }
}

/**
 * Global memory monitor instance
 */
export const memoryMonitor = new MemoryMonitor();

/**
 * Start automatic performance monitoring
 */
export function startAutomaticMonitoring(intervalMs: number = 5000): () => void {
  const memoryInterval = setInterval(() => {
    memoryMonitor.snapshot();
  }, intervalMs);

  // Log summary periodically
  const reportInterval = setInterval(() => {
    if (process.env.NODE_ENV === 'development') {
      perfMonitor.logReport();
      memoryMonitor.logUsage();
    }
  }, intervalMs * 6); // Every 30 seconds if interval is 5s

  // Cleanup function
  return () => {
    clearInterval(memoryInterval);
    clearInterval(reportInterval);
  };
}

// Add React import placeholder
declare const React: any;
