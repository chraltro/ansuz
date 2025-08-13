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