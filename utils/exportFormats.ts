/**
 * Export utilities for Ansuz
 * Supports multiple export formats: Markdown, HTML, PDF, JSON
 */

import type { Explanation, FileNode } from '../types';

export interface ExportOptions {
  includeCode?: boolean;
  includeExplanations?: boolean;
  includeDeepDive?: boolean;
  includeMetadata?: boolean;
  theme?: 'light' | 'dark';
  format?: 'markdown' | 'html' | 'json';
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeCode: true,
  includeExplanations: true,
  includeDeepDive: true,
  includeMetadata: true,
  theme: 'dark',
  format: 'markdown',
};

/**
 * Export explanation to Markdown format
 */
export function exportToMarkdown(
  fileName: string,
  explanation: Explanation,
  options: ExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let markdown = '';

  // Header
  markdown += `# ${fileName}\n\n`;

  if (opts.includeMetadata) {
    markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
    markdown += `**Tool:** Ansuz - AI Code Explainer\n`;
    markdown += `**Blocks:** ${explanation.blocks.length}\n\n`;
    markdown += '---\n\n';
  }

  // Table of Contents
  if (explanation.blocks.length > 5) {
    markdown += '## Table of Contents\n\n';
    explanation.blocks.forEach((block, i) => {
      const preview = block.code_block.split('\n')[0].substring(0, 50);
      markdown += `${i + 1}. [Block ${i + 1}](#block-${i + 1}) - ${preview}...\n`;
    });
    markdown += '\n---\n\n';
  }

  // Blocks
  explanation.blocks.forEach((block, index) => {
    markdown += `## Block ${index + 1}\n\n`;

    if (opts.includeCode) {
      markdown += '### Code\n\n';
      markdown += '```\n';
      markdown += block.code_block;
      markdown += '\n```\n\n';
    }

    if (opts.includeExplanations) {
      markdown += '### Explanation\n\n';
      markdown += block.explanation;
      markdown += '\n\n';
    }

    if (opts.includeDeepDive && block.deep_dive_explanation) {
      markdown += '### Deep Dive Analysis\n\n';
      markdown += block.deep_dive_explanation;
      markdown += '\n\n';
    }

    if (index < explanation.blocks.length - 1) {
      markdown += '---\n\n';
    }
  });

  return markdown;
}

/**
 * Export explanation to HTML format
 */
export function exportToHTML(
  fileName: string,
  explanation: Explanation,
  options: ExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isDark = opts.theme === 'dark';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(fileName)} - Code Explanation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      background: ${isDark ? '#0f172a' : '#ffffff'};
      color: ${isDark ? '#e2e8f0' : '#1e293b'};
      padding: 2rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      border-bottom: 2px solid ${isDark ? '#334155' : '#e2e8f0'};
      padding-bottom: 2rem;
      margin-bottom: 3rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: ${isDark ? '#06b6d4' : '#0891b2'};
    }

    .metadata {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
      font-size: 0.875rem;
      color: ${isDark ? '#94a3b8' : '#64748b'};
    }

    .metadata-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .metadata-label {
      font-weight: 600;
    }

    .toc {
      background: ${isDark ? '#1e293b' : '#f8fafc'};
      border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 3rem;
    }

    .toc h2 {
      margin-bottom: 1rem;
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
    }

    .toc ul {
      list-style: none;
    }

    .toc li {
      padding: 0.5rem 0;
    }

    .toc a {
      color: ${isDark ? '#38bdf8' : '#0284c7'};
      text-decoration: none;
      transition: color 0.2s;
    }

    .toc a:hover {
      color: ${isDark ? '#7dd3fc' : '#0369a1'};
      text-decoration: underline;
    }

    .block {
      background: ${isDark ? '#1e293b' : '#ffffff'};
      border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
      border-radius: 0.5rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
    }

    .block-title {
      font-size: 1.5rem;
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
    }

    .block-number {
      background: ${isDark ? '#334155' : '#e2e8f0'};
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .section-title {
      font-size: 1.125rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: ${isDark ? '#cbd5e1' : '#475569'};
      font-weight: 600;
    }

    pre {
      background: ${isDark ? '#0f172a' : '#f8fafc'};
      border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
      border-radius: 0.375rem;
      padding: 1rem;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    code {
      background: ${isDark ? '#334155' : '#e2e8f0'};
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.875em;
    }

    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }

    .explanation {
      color: ${isDark ? '#cbd5e1' : '#475569'};
      line-height: 1.8;
    }

    .explanation p {
      margin-bottom: 1rem;
    }

    .explanation ul, .explanation ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }

    .explanation li {
      margin-bottom: 0.5rem;
    }

    .explanation strong {
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
      font-weight: 600;
    }

    .deep-dive {
      background: ${isDark ? '#172033' : '#f0f9ff'};
      border-left: 4px solid ${isDark ? '#3b82f6' : '#2563eb'};
      padding: 1.5rem;
      margin-top: 1.5rem;
      border-radius: 0.375rem;
    }

    .deep-dive-title {
      color: ${isDark ? '#60a5fa' : '#1e40af'};
      font-weight: 600;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
      text-align: center;
      color: ${isDark ? '#64748b' : '#94a3b8'};
      font-size: 0.875rem;
    }

    @media print {
      body {
        background: white;
        color: black;
      }
      .block {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHTML(fileName)}</h1>
      ${opts.includeMetadata ? `
      <div class="metadata">
        <div class="metadata-item">
          <span class="metadata-label">Generated:</span>
          <span>${new Date().toLocaleString()}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Tool:</span>
          <span>Ansuz - AI Code Explainer</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Blocks:</span>
          <span>${explanation.blocks.length}</span>
        </div>
      </div>
      ` : ''}
    </header>

    ${explanation.blocks.length > 5 ? `
    <div class="toc">
      <h2>Table of Contents</h2>
      <ul>
        ${explanation.blocks.map((block, i) => {
          const preview = escapeHTML(block.code_block.split('\n')[0].substring(0, 50));
          return `<li><a href="#block-${i + 1}">Block ${i + 1} - ${preview}...</a></li>`;
        }).join('')}
      </ul>
    </div>
    ` : ''}

    <main>
      ${explanation.blocks.map((block, index) => `
        <div class="block" id="block-${index + 1}">
          <div class="block-header">
            <h2 class="block-title">Block ${index + 1}</h2>
            <span class="block-number">#${index + 1}</span>
          </div>

          ${opts.includeCode ? `
          <div class="code-section">
            <h3 class="section-title">Code</h3>
            <pre><code>${escapeHTML(block.code_block)}</code></pre>
          </div>
          ` : ''}

          ${opts.includeExplanations ? `
          <div class="explanation-section">
            <h3 class="section-title">Explanation</h3>
            <div class="explanation">${parseMarkdownToHTML(block.explanation)}</div>
          </div>
          ` : ''}

          ${opts.includeDeepDive && block.deep_dive_explanation ? `
          <div class="deep-dive">
            <div class="deep-dive-title">🔍 Deep Dive Analysis</div>
            <div class="explanation">${parseMarkdownToHTML(block.deep_dive_explanation)}</div>
          </div>
          ` : ''}
        </div>
      `).join('')}
    </main>

    <footer>
      <p>Generated by <strong>Ansuz</strong> - AI-Powered Code Explanation Tool</p>
      <p>Powered by Google Gemini 2.5 Flash</p>
    </footer>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Export explanation to JSON format
 */
export function exportToJSON(
  fileName: string,
  explanation: Explanation,
  options: ExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const data: any = {
    fileName,
    exportedAt: new Date().toISOString(),
    tool: 'Ansuz',
    version: '1.0',
  };

  if (opts.includeMetadata) {
    data.metadata = {
      blockCount: explanation.blocks.length,
      hasDeepDive: explanation.blocks.some(b => b.deep_dive_explanation),
    };
  }

  data.blocks = explanation.blocks.map((block, index) => {
    const blockData: any = {
      index: index + 1,
    };

    if (opts.includeCode) {
      blockData.code = block.code_block;
    }

    if (opts.includeExplanations) {
      blockData.explanation = block.explanation;
    }

    if (opts.includeDeepDive && block.deep_dive_explanation) {
      blockData.deepDive = block.deep_dive_explanation;
    }

    return blockData;
  });

  return JSON.stringify(data, null, 2);
}

/**
 * Download file to user's device
 */
export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export and download explanation in specified format
 */
export function exportAndDownload(
  fileName: string,
  explanation: Explanation,
  format: 'markdown' | 'html' | 'json',
  options: ExportOptions = {}
): void {
  let content: string;
  let fileExtension: string;
  let mimeType: string;

  switch (format) {
    case 'html':
      content = exportToHTML(fileName, explanation, options);
      fileExtension = 'html';
      mimeType = 'text/html';
      break;

    case 'json':
      content = exportToJSON(fileName, explanation, options);
      fileExtension = 'json';
      mimeType = 'application/json';
      break;

    case 'markdown':
    default:
      content = exportToMarkdown(fileName, explanation, options);
      fileExtension = 'md';
      mimeType = 'text/markdown';
      break;
  }

  const baseFileName = fileName.replace(/\.[^/.]+$/, '');
  const exportFileName = `${baseFileName}-explanation.${fileExtension}`;

  downloadFile(content, exportFileName, mimeType);
}

/**
 * Helper: Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Helper: Simple Markdown to HTML parser
 */
function parseMarkdownToHTML(markdown: string): string {
  let html = escapeHTML(markdown);

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Paragraphs
  html = html.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');

  // Bullet lists
  html = html.replace(/<p>(\*\s.+?)<\/p>/gs, (match, content) => {
    const items = content.split(/\n\*\s/).filter((item: string) => item.trim());
    return '<ul>' + items.map((item: string) => `<li>${item.trim()}</li>`).join('') + '</ul>';
  });

  return html;
}
