/**
 * Code complexity and quality metrics for Ansuz
 * Analyzes code structure, complexity, and maintainability
 */

export interface CodeMetrics {
  // Basic metrics
  linesOfCode: number;
  linesOfComments: number;
  blankLines: number;

  // Complexity metrics
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;

  // Structure metrics
  functionCount: number;
  classCount: number;
  importCount: number;
  exportCount: number;

  // Quality indicators
  commentRatio: number;
  averageFunctionLength: number;
  longestFunction: number;

  // Scores (0-100, higher is better)
  maintainabilityScore: number;
  readabilityScore: number;
  overallQualityScore: number;

  // Complexity rating
  complexityRating: 'low' | 'moderate' | 'high' | 'very-high';
}

export interface FileComplexityReport {
  fileName: string;
  metrics: CodeMetrics;
  warnings: string[];
  recommendations: string[];
  hotspots: CodeHotspot[];
}

export interface CodeHotspot {
  type: 'complexity' | 'length' | 'nesting';
  severity: 'low' | 'medium' | 'high';
  line: number;
  description: string;
}

/**
 * Analyze code and calculate metrics
 */
export function analyzeCode(code: string, fileName: string = ''): CodeMetrics {
  const lines = code.split('\n');

  // Basic metrics
  const linesOfCode = lines.filter(line => line.trim().length > 0).length;
  const linesOfComments = countCommentLines(code);
  const blankLines = lines.length - linesOfCode;

  // Complexity metrics
  const cyclomaticComplexity = calculateCyclomaticComplexity(code);
  const cognitiveComplexity = calculateCognitiveComplexity(code);
  const nestingDepth = calculateMaxNestingDepth(code);

  // Structure metrics
  const functionCount = countFunctions(code);
  const classCount = countClasses(code);
  const importCount = countImports(code);
  const exportCount = countExports(code);

  // Quality indicators
  const commentRatio = linesOfCode > 0 ? linesOfComments / linesOfCode : 0;
  const functionLengths = analyzeFunctionLengths(code);
  const averageFunctionLength = functionLengths.average;
  const longestFunction = functionLengths.max;

  // Calculate scores
  const maintainabilityScore = calculateMaintainabilityScore({
    cyclomaticComplexity,
    commentRatio,
    averageFunctionLength,
    nestingDepth,
  });

  const readabilityScore = calculateReadabilityScore({
    averageFunctionLength,
    nestingDepth,
    commentRatio,
    linesOfCode,
  });

  const overallQualityScore = (maintainabilityScore + readabilityScore) / 2;

  // Determine complexity rating
  const complexityRating = getComplexityRating(cyclomaticComplexity);

  return {
    linesOfCode,
    linesOfComments,
    blankLines,
    cyclomaticComplexity,
    cognitiveComplexity,
    nestingDepth,
    functionCount,
    classCount,
    importCount,
    exportCount,
    commentRatio,
    averageFunctionLength,
    longestFunction,
    maintainabilityScore,
    readabilityScore,
    overallQualityScore,
    complexityRating,
  };
}

/**
 * Generate comprehensive complexity report
 */
export function generateComplexityReport(code: string, fileName: string): FileComplexityReport {
  const metrics = analyzeCode(code, fileName);
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const hotspots: CodeHotspot[] = [];

  // High cyclomatic complexity
  if (metrics.cyclomaticComplexity > 20) {
    warnings.push(`Very high cyclomatic complexity (${metrics.cyclomaticComplexity})`);
    recommendations.push('Consider breaking down complex functions into smaller, focused functions');
  } else if (metrics.cyclomaticComplexity > 10) {
    warnings.push(`High cyclomatic complexity (${metrics.cyclomaticComplexity})`);
  }

  // Deep nesting
  if (metrics.nestingDepth > 5) {
    warnings.push(`Deep nesting detected (${metrics.nestingDepth} levels)`);
    recommendations.push('Reduce nesting by using early returns or extracting nested logic into functions');
  } else if (metrics.nestingDepth > 3) {
    warnings.push(`Moderate nesting (${metrics.nestingDepth} levels)`);
  }

  // Long functions
  if (metrics.longestFunction > 100) {
    warnings.push(`Very long function detected (${metrics.longestFunction} lines)`);
    recommendations.push('Break down long functions into smaller, single-responsibility functions');
  } else if (metrics.longestFunction > 50) {
    warnings.push(`Long function detected (${metrics.longestFunction} lines)`);
  }

  // Low comment ratio
  if (metrics.commentRatio < 0.1 && metrics.linesOfCode > 50) {
    warnings.push('Low comment ratio - code may be hard to understand');
    recommendations.push('Add comments to explain complex logic and design decisions');
  }

  // Find complexity hotspots
  const complexFunctions = findComplexFunctions(code);
  complexFunctions.forEach(({ line, complexity, name }) => {
    if (complexity > 15) {
      hotspots.push({
        type: 'complexity',
        severity: 'high',
        line,
        description: `Function "${name}" has high complexity (${complexity})`,
      });
    } else if (complexity > 10) {
      hotspots.push({
        type: 'complexity',
        severity: 'medium',
        line,
        description: `Function "${name}" has moderate complexity (${complexity})`,
      });
    }
  });

  return {
    fileName,
    metrics,
    warnings,
    recommendations,
    hotspots,
  };
}

/**
 * Count comment lines in code
 */
function countCommentLines(code: string): number {
  let count = 0;

  // Single-line comments
  const singleLineComments = code.match(/\/\/.*$/gm) || [];
  count += singleLineComments.length;

  // Multi-line comments
  const multiLineComments = code.match(/\/\*[\s\S]*?\*\//g) || [];
  multiLineComments.forEach(comment => {
    count += comment.split('\n').length;
  });

  // Python/Ruby style comments
  const hashComments = code.match(/#.*$/gm) || [];
  count += hashComments.length;

  return count;
}

/**
 * Calculate cyclomatic complexity
 */
function calculateCyclomaticComplexity(code: string): number {
  let complexity = 1; // Base complexity

  // Decision points
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /&&/g,
    /\|\|/g,
    /\?/g, // Ternary operator
  ];

  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  });

  return complexity;
}

/**
 * Calculate cognitive complexity
 */
function calculateCognitiveComplexity(code: string): number {
  let complexity = 0;
  let nestingLevel = 0;
  const lines = code.split('\n');

  const incrementors = ['if', 'else', 'elif', 'for', 'while', 'catch', 'switch'];
  const nestingIncrementors = ['{', '(', '['];
  const nestingDecrementors = ['}', ')', ']'];

  lines.forEach(line => {
    const trimmed = line.trim();

    // Track nesting level
    nestingIncrementors.forEach(char => {
      const count = (trimmed.match(new RegExp('\\' + char, 'g')) || []).length;
      nestingLevel += count;
    });

    nestingDecrementors.forEach(char => {
      const count = (trimmed.match(new RegExp('\\' + char, 'g')) || []).length;
      nestingLevel = Math.max(0, nestingLevel - count);
    });

    // Add complexity for control flow
    incrementors.forEach(keyword => {
      if (new RegExp(`\\b${keyword}\\b`).test(trimmed)) {
        complexity += 1 + nestingLevel;
      }
    });

    // Add for logical operators
    const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
    complexity += logicalOps;
  });

  return complexity;
}

/**
 * Calculate maximum nesting depth
 */
function calculateMaxNestingDepth(code: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (code[i] === '}') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maxDepth;
}

/**
 * Count functions in code
 */
function countFunctions(code: string): number {
  const patterns = [
    /function\s+\w+\s*\(/g,
    /\w+\s*:\s*function\s*\(/g,
    /\w+\s*=\s*function\s*\(/g,
    /\w+\s*=\s*\([^)]*\)\s*=>/g,
    /const\s+\w+\s*=\s*\([^)]*\)\s*=>/g,
    /def\s+\w+\s*\(/g, // Python
  ];

  let count = 0;
  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });

  return count;
}

/**
 * Count classes in code
 */
function countClasses(code: string): number {
  const patterns = [
    /class\s+\w+/g,
    /interface\s+\w+/g,
    /type\s+\w+\s*=/g,
  ];

  let count = 0;
  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });

  return count;
}

/**
 * Count imports
 */
function countImports(code: string): number {
  const patterns = [
    /^import\s+/gm,
    /^from\s+.*\s+import\s+/gm,
    /require\s*\(/g,
  ];

  let count = 0;
  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });

  return count;
}

/**
 * Count exports
 */
function countExports(code: string): number {
  const patterns = [
    /^export\s+/gm,
    /module\.exports\s*=/g,
  ];

  let count = 0;
  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });

  return count;
}

/**
 * Analyze function lengths
 */
function analyzeFunctionLengths(code: string): { average: number; max: number; min: number } {
  const lines = code.split('\n');
  const functionStarts: number[] = [];
  const functionLengths: number[] = [];

  // Find function starts
  lines.forEach((line, index) => {
    if (/function\s+\w+|const\s+\w+\s*=\s*\(|def\s+\w+/.test(line)) {
      functionStarts.push(index);
    }
  });

  // Calculate lengths (simplified - assumes functions end at next function or end of file)
  functionStarts.forEach((start, i) => {
    const end = i < functionStarts.length - 1 ? functionStarts[i + 1] : lines.length;
    functionLengths.push(end - start);
  });

  if (functionLengths.length === 0) {
    return { average: 0, max: 0, min: 0 };
  }

  const average = functionLengths.reduce((sum, len) => sum + len, 0) / functionLengths.length;
  const max = Math.max(...functionLengths);
  const min = Math.min(...functionLengths);

  return { average, max, min };
}

/**
 * Find complex functions
 */
function findComplexFunctions(code: string): Array<{ line: number; complexity: number; name: string }> {
  const lines = code.split('\n');
  const complexFunctions: Array<{ line: number; complexity: number; name: string }> = [];

  lines.forEach((line, index) => {
    const functionMatch = line.match(/function\s+(\w+)|const\s+(\w+)\s*=|def\s+(\w+)/);
    if (functionMatch) {
      const name = functionMatch[1] || functionMatch[2] || functionMatch[3];
      // Simplified: calculate complexity for the line
      const complexity = calculateCyclomaticComplexity(line);
      if (complexity > 5) {
        complexFunctions.push({
          line: index + 1,
          complexity,
          name,
        });
      }
    }
  });

  return complexFunctions;
}

/**
 * Calculate maintainability score (0-100)
 */
function calculateMaintainabilityScore(params: {
  cyclomaticComplexity: number;
  commentRatio: number;
  averageFunctionLength: number;
  nestingDepth: number;
}): number {
  let score = 100;

  // Penalize high complexity
  if (params.cyclomaticComplexity > 20) score -= 30;
  else if (params.cyclomaticComplexity > 10) score -= 15;
  else if (params.cyclomaticComplexity > 5) score -= 5;

  // Reward good comment ratio
  if (params.commentRatio < 0.1) score -= 10;
  else if (params.commentRatio > 0.3) score += 5;

  // Penalize long functions
  if (params.averageFunctionLength > 50) score -= 20;
  else if (params.averageFunctionLength > 30) score -= 10;

  // Penalize deep nesting
  if (params.nestingDepth > 5) score -= 20;
  else if (params.nestingDepth > 3) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate readability score (0-100)
 */
function calculateReadabilityScore(params: {
  averageFunctionLength: number;
  nestingDepth: number;
  commentRatio: number;
  linesOfCode: number;
}): number {
  let score = 100;

  // Penalize long functions
  if (params.averageFunctionLength > 40) score -= 25;
  else if (params.averageFunctionLength > 25) score -= 10;

  // Penalize deep nesting
  if (params.nestingDepth > 4) score -= 25;
  else if (params.nestingDepth > 2) score -= 10;

  // Consider comment ratio
  if (params.commentRatio < 0.05) score -= 15;
  else if (params.commentRatio > 0.25) score += 10;

  // Penalize very large files
  if (params.linesOfCode > 500) score -= 15;
  else if (params.linesOfCode > 300) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get complexity rating
 */
function getComplexityRating(complexity: number): 'low' | 'moderate' | 'high' | 'very-high' {
  if (complexity <= 5) return 'low';
  if (complexity <= 10) return 'moderate';
  if (complexity <= 20) return 'high';
  return 'very-high';
}
