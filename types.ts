export interface FileNode {
  name: string;
  content: string | null;
  children: FileNode[];
  path: string;
}

export interface ExplanationBlock {
  code_block: string;
  explanation: string;
  deep_dive_explanation?: string;
}

export interface Explanation {
  blocks: ExplanationBlock[];
}

export type ExplanationLevel = 'beginner' | 'intermediate' | 'expert';

// Serialized shape of the in-memory Map<path, Map<level, Explanation>>. Both
// levels of nesting have to be plain objects to survive JSON.stringify.
export type SerializedExplanations = Record<string, Partial<Record<ExplanationLevel, Explanation>>>;

// History types for GitHub Gists
export interface HistoryEntry {
  id: string;
  timestamp: string;
  projectName: string;
  fileTree: FileNode;
  explanationsCache: SerializedExplanations;
  fileSummaries: Record<string, string>;
  projectSummary: string;
}

export interface HistoryData {
  entries: HistoryEntry[];
}