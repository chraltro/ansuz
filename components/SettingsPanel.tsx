import React, { useState } from 'react';
import { templateManager, type ExplanationTemplate } from '../utils/explanationTemplates';
import { FILE_LIMITS } from '../utils/fileValidation';
import { perfMonitor, memoryMonitor } from '../utils/performance';

interface SettingsPanelProps {
  onClose: () => void;
  currentSettings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export interface AppSettings {
  concurrentFiles: number;
  apiRateLimit: number;
  defaultExplanationLevel: 'beginner' | 'intermediate' | 'expert';
  autoSaveHistory: boolean;
  enableAnalytics: boolean;
  enablePerformanceMonitoring: boolean;
  theme: 'dark' | 'light';
  defaultExportFormat: 'markdown' | 'html' | 'json';
  showComplexityWarnings: boolean;
  maxFileSize: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  concurrentFiles: 3,
  apiRateLimit: 500,
  defaultExplanationLevel: 'intermediate',
  autoSaveHistory: true,
  enableAnalytics: true,
  enablePerformanceMonitoring: false,
  theme: 'dark',
  defaultExportFormat: 'markdown',
  showComplexityWarnings: true,
  maxFileSize: FILE_LIMITS.MAX_FILE_SIZE_MB,
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, currentSettings, onSettingsChange }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'general' | 'performance' | 'templates' | 'advanced'>('general');
  const [templates, setTemplates] = useState<ExplanationTemplate[]>(templateManager.getAllTemplates());

  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
  };

  const handleSave = () => {
    onSettingsChange(settings);
    onClose();
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const handleTemplateDelete = (id: string) => {
    if (confirm('Delete this template?')) {
      templateManager.deleteTemplate(id);
      setTemplates(templateManager.getAllTemplates());
    }
  };

  const handleExportTemplates = () => {
    const data = templateManager.exportTemplates();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ansuz-templates-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePerformanceReport = () => {
    perfMonitor.logReport();
    memoryMonitor.logUsage();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </h2>
            <p className="text-gray-400 text-sm mt-1">Configure Ansuz preferences and features</p>
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

        {/* Tabs */}
        <div className="border-b border-gray-700 bg-gray-900">
          <div className="flex gap-1 p-2">
            {[
              { id: 'general', label: 'General', icon: '⚙️' },
              { id: 'performance', label: 'Performance', icon: '⚡' },
              { id: 'templates', label: 'Templates', icon: '📝' },
              { id: 'advanced', label: 'Advanced', icon: '🔧' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <SettingSection title="Display">
                <SettingRow
                  label="Theme"
                  description="Choose your preferred color scheme"
                >
                  <select
                    value={settings.theme}
                    onChange={e => handleSettingChange('theme', e.target.value as 'dark' | 'light')}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Default Explanation Level"
                  description="Choose the default complexity level for code explanations"
                >
                  <select
                    value={settings.defaultExplanationLevel}
                    onChange={e => handleSettingChange('defaultExplanationLevel', e.target.value as any)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Default Export Format"
                  description="Choose the default format when exporting explanations"
                >
                  <select
                    value={settings.defaultExportFormat}
                    onChange={e => handleSettingChange('defaultExportFormat', e.target.value as any)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="json">JSON</option>
                  </select>
                </SettingRow>
              </SettingSection>

              <SettingSection title="Features">
                <SettingRow
                  label="Auto-save History"
                  description="Automatically save analysis sessions to history"
                >
                  <Toggle
                    checked={settings.autoSaveHistory}
                    onChange={checked => handleSettingChange('autoSaveHistory', checked)}
                  />
                </SettingRow>

                <SettingRow
                  label="Show Complexity Warnings"
                  description="Display warnings for complex code sections"
                >
                  <Toggle
                    checked={settings.showComplexityWarnings}
                    onChange={checked => handleSettingChange('showComplexityWarnings', checked)}
                  />
                </SettingRow>

                <SettingRow
                  label="Enable Analytics"
                  description="Track usage metrics and performance data"
                >
                  <Toggle
                    checked={settings.enableAnalytics}
                    onChange={checked => handleSettingChange('enableAnalytics', checked)}
                  />
                </SettingRow>
              </SettingSection>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <SettingSection title="API Configuration">
                <SettingRow
                  label="Concurrent File Processing"
                  description="Number of files to process simultaneously"
                >
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.concurrentFiles}
                    onChange={e => handleSettingChange('concurrentFiles', parseInt(e.target.value))}
                    className="w-24 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  />
                </SettingRow>

                <SettingRow
                  label="API Rate Limit (ms)"
                  description="Minimum delay between API calls"
                >
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="100"
                    value={settings.apiRateLimit}
                    onChange={e => handleSettingChange('apiRateLimit', parseInt(e.target.value))}
                    className="w-24 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  />
                </SettingRow>
              </SettingSection>

              <SettingSection title="File Limits">
                <SettingRow
                  label="Max File Size (MB)"
                  description="Maximum size for individual files"
                >
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.maxFileSize}
                    onChange={e => handleSettingChange('maxFileSize', parseInt(e.target.value))}
                    className="w-24 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  />
                </SettingRow>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                  <h4 className="text-blue-400 font-semibold mb-2">Current Limits</h4>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Max files per batch: {FILE_LIMITS.MAX_FILES}</li>
                    <li>• Max total size: {FILE_LIMITS.MAX_TOTAL_SIZE_MB}MB</li>
                    <li>• Max lines per file: {FILE_LIMITS.MAX_LINE_COUNT.toLocaleString()}</li>
                  </ul>
                </div>
              </SettingSection>

              <SettingSection title="Monitoring">
                <SettingRow
                  label="Performance Monitoring"
                  description="Track rendering and API performance"
                >
                  <Toggle
                    checked={settings.enablePerformanceMonitoring}
                    onChange={checked => handleSettingChange('enablePerformanceMonitoring', checked)}
                  />
                </SettingRow>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handlePerformanceReport}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    View Performance Report
                  </button>
                </div>
              </SettingSection>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Explanation Templates</h3>
                <button
                  onClick={handleExportTemplates}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors text-sm"
                >
                  Export Templates
                </button>
              </div>

              <div className="space-y-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-white font-semibold">{template.name}</h4>
                          {template.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-3">{template.description}</p>
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {template.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {!template.isDefault && (
                        <button
                          onClick={() => handleTemplateDelete(template.id)}
                          className="ml-4 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Advanced Settings
                </h4>
                <p className="text-gray-300 text-sm">
                  These settings affect core functionality. Change with caution.
                </p>
              </div>

              <SettingSection title="Developer Options">
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (confirm('Clear all browser storage including history, analytics, and templates?')) {
                        localStorage.clear();
                        alert('All data cleared. Page will reload.');
                        window.location.reload();
                      }
                    }}
                    className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-semibold transition-colors border border-red-500/30"
                  >
                    Clear All Data
                  </button>

                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Reset Settings to Defaults
                  </button>
                </div>
              </SettingSection>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 bg-gray-900 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper Components

const SettingSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const SettingRow: React.FC<{ label: string; description: string; children: React.ReactNode }> = ({
  label,
  description,
  children,
}) => (
  <div className="flex justify-between items-center py-3 border-b border-gray-700 last:border-b-0">
    <div className="flex-1">
      <div className="text-white font-medium">{label}</div>
      <div className="text-gray-400 text-sm mt-0.5">{description}</div>
    </div>
    <div className="ml-4">{children}</div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-12 h-6 rounded-full transition-colors ${
      checked ? 'bg-blue-600' : 'bg-gray-600'
    }`}
  >
    <div
      className={`w-5 h-5 bg-white rounded-full transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export default SettingsPanel;
export { DEFAULT_SETTINGS };
