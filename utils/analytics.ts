/**
 * Analytics and metrics tracking for Ansuz
 * Tracks usage patterns, performance metrics, and user insights
 */

export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  filesAnalyzed: number;
  totalLines: number;
  apiCallsCount: number;
  explanationLevel: Record<string, number>; // beginner/intermediate/expert counts
  languagesUsed: Record<string, number>;
  deepDiveCount: number;
  averageFileSize: number;
  totalApiTime: number;
  errors: number;
}

export interface AggregatedMetrics {
  totalSessions: number;
  totalFilesAnalyzed: number;
  totalLines: number;
  totalApiCalls: number;
  mostUsedLanguages: Array<{ language: string; count: number }>;
  mostUsedLevel: { level: string; count: number };
  averageSessionDuration: number;
  averageFilesPerSession: number;
  totalDeepDives: number;
  errorRate: number;
}

const STORAGE_KEYS = {
  CURRENT_SESSION: 'ansuz_current_session',
  SESSION_HISTORY: 'ansuz_session_history',
  AGGREGATED_METRICS: 'ansuz_aggregated_metrics',
} as const;

const MAX_SESSIONS_STORED = 100;

/**
 * Analytics tracker class
 */
export class AnalyticsTracker {
  private currentSession: SessionMetrics | null = null;
  private events: AnalyticsEvent[] = [];

  constructor() {
    this.loadCurrentSession();
  }

  /**
   * Start a new analytics session
   */
  startSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      filesAnalyzed: 0,
      totalLines: 0,
      apiCallsCount: 0,
      explanationLevel: {},
      languagesUsed: {},
      deepDiveCount: 0,
      averageFileSize: 0,
      totalApiTime: 0,
      errors: 0,
    };

    this.saveCurrentSession();
    this.trackEvent('session_started', { sessionId });

    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.saveSessionToHistory(this.currentSession);
    this.updateAggregatedMetrics(this.currentSession);
    this.trackEvent('session_ended', {
      sessionId: this.currentSession.sessionId,
      duration: this.currentSession.endTime - this.currentSession.startTime,
    });

    // Clear current session
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    this.currentSession = null;
  }

  /**
   * Track file analysis
   */
  trackFileAnalysis(params: {
    fileName: string;
    language: string;
    lineCount: number;
    fileSize: number;
    level: string;
    apiTime: number;
  }): void {
    if (!this.currentSession) this.startSession();

    const session = this.currentSession!;
    session.filesAnalyzed++;
    session.totalLines += params.lineCount;
    session.apiCallsCount++;
    session.totalApiTime += params.apiTime;

    // Track language usage
    session.languagesUsed[params.language] =
      (session.languagesUsed[params.language] || 0) + 1;

    // Track explanation level usage
    session.explanationLevel[params.level] =
      (session.explanationLevel[params.level] || 0) + 1;

    // Update average file size
    session.averageFileSize =
      (session.averageFileSize * (session.filesAnalyzed - 1) + params.fileSize) /
      session.filesAnalyzed;

    this.saveCurrentSession();
    this.trackEvent('file_analyzed', params);
  }

  /**
   * Track deep dive analysis
   */
  trackDeepDive(fileName: string, blockIndex: number): void {
    if (!this.currentSession) this.startSession();

    this.currentSession!.deepDiveCount++;
    this.currentSession!.apiCallsCount++;
    this.saveCurrentSession();
    this.trackEvent('deep_dive', { fileName, blockIndex });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.currentSession) this.startSession();

    this.currentSession!.errors++;
    this.saveCurrentSession();
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Track custom event
   */
  trackEvent(type: string, data?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.events.push(event);

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  /**
   * Get current session metrics
   */
  getCurrentSession(): SessionMetrics | null {
    return this.currentSession;
  }

  /**
   * Get aggregated metrics across all sessions
   */
  getAggregatedMetrics(): AggregatedMetrics {
    const stored = localStorage.getItem(STORAGE_KEYS.AGGREGATED_METRICS);

    if (!stored) {
      return this.getDefaultAggregatedMetrics();
    }

    try {
      return JSON.parse(stored);
    } catch (e) {
      return this.getDefaultAggregatedMetrics();
    }
  }

  /**
   * Get session history
   */
  getSessionHistory(limit: number = 10): SessionMetrics[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY);

    if (!stored) return [];

    try {
      const history: SessionMetrics[] = JSON.parse(stored);
      return history.slice(-limit).reverse();
    } catch (e) {
      return [];
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): AnalyticsEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /**
   * Clear all analytics data
   */
  clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    localStorage.removeItem(STORAGE_KEYS.SESSION_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.AGGREGATED_METRICS);
    this.currentSession = null;
    this.events = [];
  }

  /**
   * Export analytics data
   */
  exportData(): {
    currentSession: SessionMetrics | null;
    sessionHistory: SessionMetrics[];
    aggregatedMetrics: AggregatedMetrics;
    recentEvents: AnalyticsEvent[];
  } {
    return {
      currentSession: this.currentSession,
      sessionHistory: this.getSessionHistory(100),
      aggregatedMetrics: this.getAggregatedMetrics(),
      recentEvents: this.getRecentEvents(100),
    };
  }

  // Private methods

  private loadCurrentSession(): void {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);

    if (!stored) return;

    try {
      this.currentSession = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load current session:', e);
    }
  }

  private saveCurrentSession(): void {
    if (!this.currentSession) return;

    try {
      localStorage.setItem(
        STORAGE_KEYS.CURRENT_SESSION,
        JSON.stringify(this.currentSession)
      );
    } catch (e) {
      console.error('Failed to save current session:', e);
    }
  }

  private saveSessionToHistory(session: SessionMetrics): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY);
      const history: SessionMetrics[] = stored ? JSON.parse(stored) : [];

      history.push(session);

      // Keep only last N sessions
      if (history.length > MAX_SESSIONS_STORED) {
        history.splice(0, history.length - MAX_SESSIONS_STORED);
      }

      localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save session to history:', e);
    }
  }

  private updateAggregatedMetrics(session: SessionMetrics): void {
    const current = this.getAggregatedMetrics();

    // Update totals
    current.totalSessions++;
    current.totalFilesAnalyzed += session.filesAnalyzed;
    current.totalLines += session.totalLines;
    current.totalApiCalls += session.apiCallsCount;
    current.totalDeepDives += session.deepDiveCount;

    // Update language counts
    const languageMap = new Map<string, number>();
    current.mostUsedLanguages.forEach(({ language, count }) => {
      languageMap.set(language, count);
    });
    Object.entries(session.languagesUsed).forEach(([lang, count]) => {
      languageMap.set(lang, (languageMap.get(lang) || 0) + count);
    });
    current.mostUsedLanguages = Array.from(languageMap.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    // Update most used level
    const levelCounts = new Map<string, number>();
    Object.entries(session.explanationLevel).forEach(([level, count]) => {
      levelCounts.set(level, (levelCounts.get(level) || 0) + count);
    });
    const topLevel = Array.from(levelCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];
    if (topLevel) {
      current.mostUsedLevel = { level: topLevel[0], count: topLevel[1] };
    }

    // Update averages
    const sessionDuration = session.endTime
      ? session.endTime - session.startTime
      : 0;
    current.averageSessionDuration =
      (current.averageSessionDuration * (current.totalSessions - 1) +
        sessionDuration) /
      current.totalSessions;

    current.averageFilesPerSession =
      current.totalFilesAnalyzed / current.totalSessions;

    // Update error rate
    current.errorRate = session.errors / Math.max(session.apiCallsCount, 1);

    try {
      localStorage.setItem(
        STORAGE_KEYS.AGGREGATED_METRICS,
        JSON.stringify(current)
      );
    } catch (e) {
      console.error('Failed to save aggregated metrics:', e);
    }
  }

  private getDefaultAggregatedMetrics(): AggregatedMetrics {
    return {
      totalSessions: 0,
      totalFilesAnalyzed: 0,
      totalLines: 0,
      totalApiCalls: 0,
      mostUsedLanguages: [],
      mostUsedLevel: { level: 'intermediate', count: 0 },
      averageSessionDuration: 0,
      averageFilesPerSession: 0,
      totalDeepDives: 0,
      errorRate: 0,
    };
  }
}

// Global analytics instance
export const analytics = new AnalyticsTracker();

// Helper functions for common tracking operations

export function trackFileAnalysis(params: {
  fileName: string;
  language: string;
  lineCount: number;
  fileSize: number;
  level: string;
  apiTime: number;
}): void {
  analytics.trackFileAnalysis(params);
}

export function trackDeepDive(fileName: string, blockIndex: number): void {
  analytics.trackDeepDive(fileName, blockIndex);
}

export function trackError(error: Error, context?: Record<string, any>): void {
  analytics.trackError(error, context);
}

export function startAnalyticsSession(): string {
  return analytics.startSession();
}

export function endAnalyticsSession(): void {
  analytics.endSession();
}
