/**
 * Fuzzy search and semantic matching utilities for Ansuz
 * Enables intelligent code search with typo tolerance and relevance ranking
 */

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  key: string;
  value: string;
  indices: [number, number][];
}

export interface FuzzySearchOptions {
  keys: string[]; // Keys to search in
  threshold: number; // Match threshold (0-1, lower = stricter)
  maxResults?: number; // Maximum results to return
  includeScore?: boolean; // Include match scores in results
  includeMatches?: boolean; // Include match indices
  minMatchCharLength?: number; // Minimum match character length
  shouldSort?: boolean; // Sort results by score
}

const DEFAULT_OPTIONS: Partial<FuzzySearchOptions> = {
  threshold: 0.4,
  maxResults: 50,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate fuzzy match score (0-1, higher is better)
 */
export function fuzzyMatchScore(pattern: string, text: string): number {
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match
  if (textLower === patternLower) return 1.0;

  // Substring match
  if (textLower.includes(patternLower)) {
    return 0.9 - (textLower.indexOf(patternLower) / textLower.length) * 0.2;
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(patternLower, textLower);
  const maxLength = Math.max(patternLower.length, textLower.length);
  const similarity = 1 - distance / maxLength;

  return Math.max(0, similarity);
}

/**
 * Find matching character indices in text
 */
export function findMatchIndices(pattern: string, text: string): [number, number][] {
  const indices: [number, number][] = [];
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();

  let startIndex = 0;
  let matchIndex = textLower.indexOf(patternLower, startIndex);

  while (matchIndex !== -1) {
    indices.push([matchIndex, matchIndex + patternLower.length - 1]);
    startIndex = matchIndex + 1;
    matchIndex = textLower.indexOf(patternLower, startIndex);
  }

  return indices;
}

/**
 * Fuzzy search through a list of items
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions
): SearchResult<T>[] {
  if (!query || query.trim().length === 0) {
    return items.map(item => ({ item, score: 1, matches: [] }));
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: SearchResult<T>[] = [];

  for (const item of items) {
    let bestScore = 0;
    const matches: SearchMatch[] = [];

    // Search through specified keys
    for (const key of opts.keys) {
      const value = getNestedValue(item, key);
      if (typeof value !== 'string') continue;

      const score = fuzzyMatchScore(query, value);

      if (score > bestScore) {
        bestScore = score;
      }

      if (score >= (1 - opts.threshold) && opts.includeMatches) {
        const indices = findMatchIndices(query, value);
        if (indices.length > 0) {
          matches.push({ key, value, indices });
        }
      }
    }

    // Only include results above threshold
    if (bestScore >= (1 - opts.threshold)) {
      results.push({
        item,
        score: bestScore,
        matches,
      });
    }
  }

  // Sort by score if requested
  if (opts.shouldSort) {
    results.sort((a, b) => b.score - a.score);
  }

  // Limit results
  if (opts.maxResults) {
    return results.slice(0, opts.maxResults);
  }

  return results;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Highlight matching text in a string
 */
export function highlightMatches(
  text: string,
  indices: [number, number][],
  highlightClass: string = 'bg-yellow-300 text-black'
): string {
  if (indices.length === 0) return text;

  let result = '';
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

  for (const [start, end] of sortedIndices) {
    // Add text before match
    if (start > lastIndex) {
      result += text.substring(lastIndex, start);
    }

    // Add highlighted match
    const matchText = text.substring(start, end + 1);
    result += `<mark class="${highlightClass}">${matchText}</mark>`;

    lastIndex = end + 1;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result += text.substring(lastIndex);
  }

  return result;
}

/**
 * Semantic code search - searches for code patterns, function names, etc.
 */
export interface CodeSearchOptions {
  searchInCode?: boolean;
  searchInExplanations?: boolean;
  searchInComments?: boolean;
  caseSensitive?: boolean;
  useRegex?: boolean;
  maxResults?: number;
}

export interface CodeSearchResult {
  filePath: string;
  blockIndex: number;
  codeBlock: string;
  explanation?: string;
  score: number;
  matchType: 'code' | 'explanation' | 'comment';
  matchIndices: [number, number][];
}

export function searchCode(
  explanations: Map<string, { blocks: Array<{ code_block: string; explanation: string }> }>,
  query: string,
  options: CodeSearchOptions = {}
): CodeSearchResult[] {
  const {
    searchInCode = true,
    searchInExplanations = true,
    searchInComments = true,
    caseSensitive = false,
    useRegex = false,
    maxResults = 100,
  } = options;

  const results: CodeSearchResult[] = [];
  const searchQuery = caseSensitive ? query : query.toLowerCase();

  // Build regex if needed
  let regex: RegExp | null = null;
  if (useRegex) {
    try {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } catch (e) {
      console.error('Invalid regex:', e);
      return [];
    }
  }

  for (const [filePath, explanation] of explanations.entries()) {
    explanation.blocks.forEach((block, blockIndex) => {
      const codeText = caseSensitive ? block.code_block : block.code_block.toLowerCase();
      const explanationText = caseSensitive ? block.explanation : block.explanation.toLowerCase();

      // Search in code
      if (searchInCode) {
        const codeMatches = regex
          ? findRegexMatches(block.code_block, regex)
          : findMatchIndices(searchQuery, codeText);

        if (codeMatches.length > 0) {
          const score = fuzzyMatchScore(searchQuery, codeText);
          results.push({
            filePath,
            blockIndex,
            codeBlock: block.code_block,
            explanation: block.explanation,
            score,
            matchType: 'code',
            matchIndices: codeMatches,
          });
        }
      }

      // Search in explanations
      if (searchInExplanations) {
        const explanationMatches = regex
          ? findRegexMatches(block.explanation, regex)
          : findMatchIndices(searchQuery, explanationText);

        if (explanationMatches.length > 0) {
          const score = fuzzyMatchScore(searchQuery, explanationText);
          results.push({
            filePath,
            blockIndex,
            codeBlock: block.code_block,
            explanation: block.explanation,
            score,
            matchType: 'explanation',
            matchIndices: explanationMatches,
          });
        }
      }

      // Search in comments (within code blocks)
      if (searchInComments) {
        const comments = extractComments(block.code_block);
        comments.forEach(({ text, index }) => {
          const commentText = caseSensitive ? text : text.toLowerCase();
          const commentMatches = findMatchIndices(searchQuery, commentText);

          if (commentMatches.length > 0) {
            const score = fuzzyMatchScore(searchQuery, commentText);
            results.push({
              filePath,
              blockIndex,
              codeBlock: block.code_block,
              explanation: block.explanation,
              score,
              matchType: 'comment',
              matchIndices: commentMatches.map(([start, end]) => [start + index, end + index] as [number, number]),
            });
          }
        });
      }
    });
  }

  // Sort by score and limit results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

/**
 * Find matches using regex
 */
function findRegexMatches(text: string, regex: RegExp): [number, number][] {
  const indices: [number, number][] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    indices.push([match.index, match.index + match[0].length - 1]);
  }

  return indices;
}

/**
 * Extract comments from code
 */
function extractComments(code: string): Array<{ text: string; index: number }> {
  const comments: Array<{ text: string; index: number }> = [];

  // Single-line comments (// or #)
  const singleLineRegex = /(\/\/|#)(.*)$/gm;
  let match: RegExpExecArray | null;

  while ((match = singleLineRegex.exec(code)) !== null) {
    comments.push({
      text: match[2].trim(),
      index: match.index + match[1].length,
    });
  }

  // Multi-line comments (/* */ or """ """ or ''' ''')
  const multiLineRegex = /(\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?''')/g;

  while ((match = multiLineRegex.exec(code)) !== null) {
    comments.push({
      text: match[1].replace(/^(\/\*|"""|''')|("""|'''|\*\/)$/g, '').trim(),
      index: match.index,
    });
  }

  return comments;
}
