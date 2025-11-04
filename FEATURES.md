# Ansuz Feature Enhancements

This document outlines the major features and improvements added to Ansuz to enhance performance, reliability, and user experience.

## 🛡️ Error Handling & Reliability

### Error Boundaries
- **Component**: `ErrorBoundary.tsx`
- **Purpose**: Gracefully handle React component errors without crashing the entire app
- **Features**:
  - User-friendly error messages with stack traces
  - Recovery options (Try Again, Reload Page)
  - Detailed error information for debugging
  - Custom fallback UI support

**Usage:**
```tsx
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## 📁 File Validation & Security

### Comprehensive File Validation
- **Module**: `utils/fileValidation.ts`
- **Purpose**: Ensure uploaded files meet security and performance requirements

**Features:**
- Individual file size limits (default: 5MB per file)
- Total upload size limits (default: 50MB)
- File count limits (default: 25 files)
- Line count validation (10,000 lines max per file)
- Automatic binary file filtering
- Support for 30+ programming languages

**Validation Checks:**
```typescript
import { validateAndFilterFiles } from './utils/fileValidation';

const { files, errors, warnings } = await validateAndFilterFiles(uploadedFiles);
```

**Supported File Types:**
- **Languages**: JavaScript, TypeScript, Python, Java, C++, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, R, Lua, Perl, Shell scripts
- **Web**: HTML, CSS, SCSS, Sass, Less, Vue, Svelte
- **Config**: JSON, YAML, TOML, INI, XML
- **Data**: SQL, GraphQL
- **Docs**: Markdown, RST, Text

---

## ⚡ Performance Optimizations

### Rate Limiter & Concurrent Processing
- **Module**: `utils/rateLimiter.ts`
- **Purpose**: Optimize API usage and enable parallel file processing

**Key Features:**
- Configurable concurrency (default: 3 concurrent requests)
- Automatic rate limiting with adjustable intervals
- Exponential backoff retry logic
- Priority queue support
- Real-time progress tracking

**Example:**
```typescript
import { FileBatchProcessor } from './utils/rateLimiter';

const processor = new FileBatchProcessor({
  maxConcurrent: 3,
  minInterval: 500,
  maxRetries: 3,
});

await processor.processFiles(files, {
  onProgress: (current, total) => console.log(`${current}/${total}`),
  onError: (fileName, error) => console.error(fileName, error),
});
```

### Concurrent File Processing
- **Module**: `services/concurrentProcessor.ts`
- **Purpose**: Process multiple files simultaneously with intelligent queuing

**Benefits:**
- 3-5x faster analysis for multi-file projects
- Automatic load balancing
- Smaller files prioritized for faster initial results
- Built-in error recovery

**Performance Comparison:**
- **Sequential**: 25 files × 3s = 75 seconds
- **Concurrent (3x)**: 25 files ÷ 3 × 3s = 25 seconds

---

## 📊 Analytics & Metrics

### Usage Analytics
- **Module**: `utils/analytics.ts`
- **Purpose**: Track user behavior and application performance

**Tracked Metrics:**
- Session duration and file counts
- API call frequency and timing
- Language and explanation level preferences
- Deep dive usage patterns
- Error rates and types

**Features:**
- Automatic session tracking
- Local storage persistence
- Data export (JSON format)
- Privacy-focused (all data stored locally)

**Usage:**
```typescript
import { analytics } from './utils/analytics';

// Automatic tracking
analytics.trackFileAnalysis({
  fileName: 'example.js',
  language: 'javascript',
  lineCount: 150,
  fileSize: 4500,
  level: 'intermediate',
  apiTime: 2500,
});

// Get insights
const metrics = analytics.getAggregatedMetrics();
console.log(`Total files analyzed: ${metrics.totalFilesAnalyzed}`);
```

### Analytics Dashboard
- **Component**: `MetricsDashboard.tsx`
- **Purpose**: Visualize usage patterns and performance metrics

**Dashboard Features:**
- Real-time session metrics
- Overall statistics (total sessions, files, API calls)
- Language usage breakdown with charts
- Session history table
- Data export and management

---

## 📈 Code Quality Analysis

### Code Complexity Metrics
- **Module**: `utils/codeMetrics.ts`
- **Purpose**: Analyze code complexity and quality

**Metrics Calculated:**
- **Cyclomatic Complexity**: Measures decision point count
- **Cognitive Complexity**: Measures how hard code is to understand
- **Nesting Depth**: Tracks maximum block nesting
- **Maintainability Score**: Overall code quality (0-100)
- **Readability Score**: How easy code is to read (0-100)

**Additional Metrics:**
- Lines of code vs. comments
- Function count and average length
- Class/interface count
- Import/export analysis

**Complexity Ratings:**
- **Low** (≤5): Simple, easy to maintain
- **Moderate** (6-10): Acceptable complexity
- **High** (11-20): Consider refactoring
- **Very High** (>20): Requires immediate attention

**Example:**
```typescript
import { analyzeCode, generateComplexityReport } from './utils/codeMetrics';

const metrics = analyzeCode(sourceCode, 'example.js');
console.log(`Cyclomatic Complexity: ${metrics.cyclomaticComplexity}`);
console.log(`Maintainability Score: ${metrics.maintainabilityScore}/100`);

// Get detailed report
const report = generateComplexityReport(sourceCode, 'example.js');
console.log(`Warnings: ${report.warnings.length}`);
console.log(`Recommendations: ${report.recommendations}`);
```

---

## 🔍 Advanced Search

### Fuzzy Search
- **Module**: `utils/fuzzySearch.ts`
- **Purpose**: Intelligent code search with typo tolerance

**Features:**
- Levenshtein distance algorithm for fuzzy matching
- Configurable similarity threshold
- Search across multiple fields
- Match highlighting
- Relevance scoring

**Search Capabilities:**
- Code content search
- Explanation text search
- Comment-only search
- Regex pattern matching
- Multi-file search

**Example:**
```typescript
import { searchCode } from './utils/fuzzySearch';

const results = searchCode(explanationsMap, 'authentcation', {
  searchInCode: true,
  searchInExplanations: true,
  caseSensitive: false,
  maxResults: 20,
});

// Results include typo-tolerant matches for "authentication"
```

---

## 🎨 Custom Explanation Templates

### Template System
- **Module**: `utils/explanationTemplates.ts`
- **Purpose**: Customize AI explanation style and focus

**Built-in Templates:**
1. **Beginner Friendly**: Simple language, analogies, basic concepts
2. **Technical Deep Dive**: Design patterns, architecture, trade-offs
3. **Security Focused**: Vulnerabilities, attack vectors, OWASP
4. **Performance Optimization**: Bottlenecks, complexity, caching
5. **Code Review**: Quality, maintainability, best practices
6. **Concise Summary**: Brief, focused explanations

**Template Features:**
- Custom system prompts
- Adjustable temperature settings
- Markdown formatting rules
- Example-based guidance
- Tag-based organization
- Import/export functionality

**Creating Custom Templates:**
```typescript
import { templateManager } from './utils/explanationTemplates';

const customTemplate = templateManager.createTemplate({
  name: 'Database Expert',
  description: 'Focus on SQL optimization and database design',
  systemPrompt: 'You are a database expert...',
  temperature: 0.3,
  style: {
    useMarkdown: true,
    useBullets: true,
    useBold: true,
    useCodeBlocks: true,
    paragraphSpacing: true,
  },
  tags: ['database', 'sql', 'optimization'],
});
```

---

## 📤 Enhanced Export

### Multiple Export Formats
- **Module**: `utils/exportFormats.ts`
- **Purpose**: Export explanations in various formats

**Supported Formats:**
1. **Markdown** (.md)
   - Clean, portable format
   - Perfect for documentation
   - GitHub-compatible

2. **HTML** (.html)
   - Styled, self-contained
   - Dark/light themes
   - Print-optimized
   - Table of contents

3. **JSON** (.json)
   - Structured data
   - API-friendly
   - Easy parsing

**Export Options:**
```typescript
import { exportAndDownload } from './utils/exportFormats';

exportAndDownload(fileName, explanation, 'html', {
  includeCode: true,
  includeExplanations: true,
  includeDeepDive: true,
  includeMetadata: true,
  theme: 'dark',
});
```

**HTML Export Features:**
- Beautiful typography
- Syntax highlighting
- Responsive design
- Print support
- Metadata header
- Navigation aids

---

## 🔬 Performance Monitoring

### Performance Profiler
- **Module**: `utils/performance.ts`
- **Purpose**: Track and optimize application performance

**Features:**
- Automatic operation timing
- Memory usage tracking
- React component profiling
- Performance reports
- Trend analysis

**Monitoring Capabilities:**
- API call latency
- Render times
- Memory consumption
- Operation bottlenecks
- Resource usage trends

**Usage:**
```typescript
import { perfMonitor } from './utils/performance';

// Manual timing
perfMonitor.start('api:explanation');
await callAPI();
perfMonitor.end('api:explanation');

// Automatic function measurement
await perfMonitor.measure('processFile', async () => {
  return await processFile(file);
});

// Get reports
perfMonitor.logReport();
```

**React Integration:**
```typescript
import { useMeasureRender } from './utils/performance';

function MyComponent() {
  useMeasureRender('MyComponent');
  // Component render time automatically tracked
}
```

---

## ⚙️ Settings Panel

### Comprehensive Configuration
- **Component**: `SettingsPanel.tsx`
- **Purpose**: Centralized application settings

**Settings Categories:**

1. **General**
   - Theme (dark/light)
   - Default explanation level
   - Export format preference
   - Auto-save history
   - Complexity warnings
   - Analytics toggle

2. **Performance**
   - Concurrent file processing
   - API rate limiting
   - File size limits
   - Performance monitoring

3. **Templates**
   - View all templates
   - Create/edit/delete
   - Import/export templates
   - Template management

4. **Advanced**
   - Clear all data
   - Reset to defaults
   - Developer options

---

## 🎯 Integration Guide

### Quick Integration Examples

#### 1. Add Error Boundary to App
```tsx
// src/main.tsx
import ErrorBoundary from '../components/ErrorBoundary';

ReactDOM.createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

#### 2. Use File Validation in Upload
```tsx
import { validateAndFilterFiles } from './utils/fileValidation';

const handleFileUpload = async (files: FileList) => {
  const validation = await validateAndFilterFiles(files);

  if (validation.errors.length > 0) {
    alert(validation.errors.join('\n'));
    return;
  }

  if (validation.warnings.length > 0) {
    const proceed = confirm(validation.warnings.join('\n'));
    if (!proceed) return;
  }

  processFiles(validation.files);
};
```

#### 3. Enable Concurrent Processing
```tsx
import { processFilesInParallel } from './services/concurrentProcessor';

const explanations = await processFilesInParallel(files, {
  apiKey,
  level: 'intermediate',
  maxConcurrent: 3,
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
  },
  onFileComplete: (path, explanation) => {
    console.log(`Completed: ${path}`);
  },
});
```

#### 4. Track Analytics
```tsx
import { analytics } from './utils/analytics';

// Start session on app mount
useEffect(() => {
  analytics.startSession();
  return () => analytics.endSession();
}, []);

// Track events
analytics.trackFileAnalysis({...});
analytics.trackDeepDive(fileName, blockIndex);
```

#### 5. Show Metrics Dashboard
```tsx
import MetricsDashboard from './components/MetricsDashboard';

const [showMetrics, setShowMetrics] = useState(false);

// In your UI
{showMetrics && (
  <MetricsDashboard onClose={() => setShowMetrics(false)} />
)}
```

---

## 📚 Best Practices

### Performance
- Enable concurrent processing for multi-file projects
- Set appropriate rate limits to avoid API throttling
- Use performance monitoring in development
- Monitor memory usage for large codebases

### Security
- Validate all file uploads
- Set reasonable file size limits
- Filter out binary/executable files
- Sanitize file names in displays

### User Experience
- Show progress indicators for long operations
- Provide clear error messages
- Enable auto-save for user convenience
- Offer export options for offline access

### Code Quality
- Review complexity metrics regularly
- Address high-complexity warnings
- Use appropriate explanation levels
- Leverage code search for large projects

---

## 🔄 Future Enhancements

Potential areas for future development:
- Multi-API support (Claude, GPT-4, Llama)
- Real-time collaboration features
- IDE integration (VSCode, JetBrains)
- Offline mode with service workers
- Custom syntax themes
- Project-level caching
- Advanced diff analysis
- Semantic code embeddings
- Auto-generated tests

---

## 🐛 Troubleshooting

### Common Issues

**Files not uploading:**
- Check file size limits in settings
- Verify file type is supported
- Look for validation warnings in console

**Slow processing:**
- Reduce concurrent file count
- Increase API rate limit
- Enable performance monitoring to identify bottlenecks

**High memory usage:**
- Process files in smaller batches
- Clear browser cache
- Check for memory leaks in console

**Export not working:**
- Check browser download permissions
- Try a different export format
- Verify explanation data is loaded

---

## 📞 Support

For issues, feature requests, or questions:
- GitHub Issues: [chraltro/ansuz](https://github.com/chraltro/ansuz/issues)
- Check console for detailed error messages
- Export analytics data for performance issues

---

## 📄 License

All enhancements maintain compatibility with the original Ansuz license.
