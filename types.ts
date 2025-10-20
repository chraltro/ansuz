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

// History types for GitHub Gists
export interface HistoryEntry {
  id: string;
  timestamp: string;
  projectName: string;
  fileTree: FileNode;
  explanationsCache: Record<string, Explanation>;
  fileSummaries: Record<string, string>;
  projectSummary: string;
}

export interface HistoryData {
  entries: HistoryEntry[];
}