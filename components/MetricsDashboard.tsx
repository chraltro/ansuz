import React, { useState, useEffect } from 'react';
import { analytics, type AggregatedMetrics, type SessionMetrics } from '../utils/analytics';

interface MetricsDashboardProps {
  onClose: () => void;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<AggregatedMetrics>(analytics.getAggregatedMetrics());
  const [sessionHistory, setSessionHistory] = useState<SessionMetrics[]>(analytics.getSessionHistory(10));
  const [currentSession, setCurrentSession] = useState<SessionMetrics | null>(analytics.getCurrentSession());

  useEffect(() => {
    // Refresh metrics every 5 seconds
    const interval = setInterval(() => {
      setMetrics(analytics.getAggregatedMetrics());
      setSessionHistory(analytics.getSessionHistory(10));
      setCurrentSession(analytics.getCurrentSession());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const handleExportData = () => {
    const data = analytics.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ansuz-analytics-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      analytics.clearAllData();
      setMetrics(analytics.getAggregatedMetrics());
      setSessionHistory([]);
      setCurrentSession(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics Dashboard
            </h2>
            <p className="text-gray-400 text-sm mt-1">Usage insights and performance metrics</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Session */}
          {currentSession && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Current Session</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-gray-400 text-sm">Files Analyzed</div>
                  <div className="text-2xl font-bold text-white">{currentSession.filesAnalyzed}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Total Lines</div>
                  <div className="text-2xl font-bold text-white">{formatNumber(currentSession.totalLines)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">API Calls</div>
                  <div className="text-2xl font-bold text-white">{currentSession.apiCallsCount}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Deep Dives</div>
                  <div className="text-2xl font-bold text-white">{currentSession.deepDiveCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* Aggregated Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Overall Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Total Sessions"
                value={formatNumber(metrics.totalSessions)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <MetricCard
                title="Files Analyzed"
                value={formatNumber(metrics.totalFilesAnalyzed)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
              <MetricCard
                title="Lines of Code"
                value={formatNumber(metrics.totalLines)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                }
              />
              <MetricCard
                title="API Calls"
                value={formatNumber(metrics.totalApiCalls)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <MetricCard
                title="Avg. Session"
                value={formatDuration(metrics.averageSessionDuration)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                  </svg>
                }
              />
              <MetricCard
                title="Avg. Files/Session"
                value={metrics.averageFilesPerSession.toFixed(1)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                }
              />
              <MetricCard
                title="Deep Dives"
                value={formatNumber(metrics.totalDeepDives)}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                }
              />
              <MetricCard
                title="Error Rate"
                value={`${(metrics.errorRate * 100).toFixed(1)}%`}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Top Languages */}
          {metrics.mostUsedLanguages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Most Analyzed Languages</h3>
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                {metrics.mostUsedLanguages.slice(0, 5).map(({ language, count }) => {
                  const total = metrics.mostUsedLanguages.reduce((sum, l) => sum + l.count, 0);
                  const percentage = ((count / total) * 100).toFixed(1);

                  return (
                    <div key={language} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300 font-medium capitalize">{language}</span>
                        <span className="text-gray-400">{count} files ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session History */}
          {sessionHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Recent Sessions</h3>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-gray-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Duration</th>
                        <th className="px-4 py-3 text-right">Files</th>
                        <th className="px-4 py-3 text-right">Lines</th>
                        <th className="px-4 py-3 text-right">API Calls</th>
                        <th className="px-4 py-3 text-right">Deep Dives</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {sessionHistory.map((session) => (
                        <tr key={session.sessionId} className="border-t border-gray-800 hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            {new Date(session.startTime).toLocaleDateString()} {new Date(session.startTime).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3">
                            {session.endTime ? formatDuration(session.endTime - session.startTime) : 'Active'}
                          </td>
                          <td className="px-4 py-3 text-right">{session.filesAnalyzed}</td>
                          <td className="px-4 py-3 text-right">{formatNumber(session.totalLines)}</td>
                          <td className="px-4 py-3 text-right">{session.apiCallsCount}</td>
                          <td className="px-4 py-3 text-right">{session.deepDiveCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleExportData}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Data
            </button>
            <button
              onClick={handleClearData}
              className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 border border-red-500/30"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
};

export default MetricsDashboard;
