
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import type { FileNode, Explanation, ExplanationBlock, HistoryEntry, SerializedExplanations } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import type { ProcessingStatus } from './components/FileExplorer';
import { explainFileInBulk, explainSnippetStream, generateProjectSummary, generateAllSummariesStream, type ExplanationLevel } from './services/geminiService';
import SpinnerIcon from './components/icons/SpinnerIcon';
import LoginScreen from './components/LoginScreen';
import { getAssetPath } from './utils/paths';
import { loadHistoryFromGist, saveHistoryToGist, loadHistoryFromLocalStorage, saveHistoryToLocalStorage } from './services/gistService';

// Lazy load heavy components with large dependencies
const FileExplorer = lazy(() => import('./components/FileExplorer'));
const CodeExplainerView = lazy(() => import('./components/CodeExplainerView'));

type ExplanationsCache = Map<string, Map<ExplanationLevel, Explanation>>;

const LEVELS: ExplanationLevel[] = ['beginner', 'intermediate', 'expert'];

const serializeExplanations = (cache: ExplanationsCache): SerializedExplanations => {
    const out: SerializedExplanations = {};
    for (const [path, levelMap] of cache) {
        out[path] = Object.fromEntries(levelMap) as Partial<Record<ExplanationLevel, Explanation>>;
    }
    return out;
};

// Entries written before the nested Map was serialized properly, or hand-edited
// gists, can contain anything. Skip whatever does not fit the shape.
const deserializeExplanations = (raw: unknown): ExplanationsCache => {
    const cache: ExplanationsCache = new Map();
    if (!raw || typeof raw !== 'object') return cache;

    for (const [path, levels] of Object.entries(raw as Record<string, unknown>)) {
        if (!levels || typeof levels !== 'object') continue;
        const levelMap = new Map<ExplanationLevel, Explanation>();
        for (const level of LEVELS) {
            const entry = (levels as Record<string, unknown>)[level];
            if (entry && typeof entry === 'object' && Array.isArray((entry as Explanation).blocks)) {
                levelMap.set(level, entry as Explanation);
            }
        }
        if (levelMap.size > 0) cache.set(path, levelMap);
    }
    return cache;
};

const getAllFiles = (node: FileNode, files: FileNode[] = []): FileNode[] => {
    if (node.content !== null) {
        files.push(node);
    }
    if (node.children) {
        for (const child of node.children) {
            getAllFiles(child, files);
        }
    }
    return files;
};

// Create a simple hash for code blocks to detect duplicates
const createBlockHash = (codeBlock: string): string => {
    // Normalize the code block by removing extra whitespace and trimming
    const normalized = codeBlock.trim().replace(/\s+/g, ' ');
    // Create a simple hash (this could be improved with a proper hash function)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
};

// Utility function for handling API errors consistently
const handleApiError = (error: unknown, apiKey: string | null, setApiKey: (key: string | null) => void): string => {
    if (!(error instanceof Error)) return 'An unexpected error occurred.';
    
    const isEnvKey = !!process.env.API_KEY && apiKey === process.env.API_KEY;
    
    if (error.message.includes('API key not valid') || error.message.includes('API key is invalid')) {
        const errorMessage = isEnvKey
            ? 'The API Key provided by the environment appears to be invalid.'
            : 'The provided API Key is invalid. Please enter a valid key.';
        
        if (!isEnvKey) {
            localStorage.removeItem('gemini_api_key');
            setApiKey(null);
        }
        return errorMessage;
    }
    
    if (error.message.includes('parse')) {
        return 'The response from the AI was not in the expected format.';
    }
    
    return 'An error occurred while communicating with the API.';
};

interface DeepDiveStatus {
    file: string | null;
    blockIndex: number | null;
    isLoading: boolean;
}

export type SummaryStatus = 'summarizing' | 'done';

const App: React.FC = () => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(() => {
    // Check localStorage first (from manual entry or Firebase auth)
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        return savedKey;
    }
    // Then check for env variable (for local dev with GEMINI_API_KEY set)
    // Only use this in development, not in production builds
    if (import.meta.env.DEV && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    // Otherwise require Firebase authentication
    return null;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [explanationsCache, setExplanationsCache] = useState<ExplanationsCache>(new Map());
  const [processingStatus, setProcessingStatus] = useState<Map<string, ProcessingStatus>>(new Map());
  const [processingQueue, setProcessingQueue] = useState<FileNode[]>([]);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(false);
  const [deepDiveStatus, setDeepDiveStatus] = useState<DeepDiveStatus>({ file: null, blockIndex: null, isLoading: false });

  // Global cache for code block explanations to avoid duplicates
  const [globalBlockCache, setGlobalBlockCache] = useState<Map<string, string>>(new Map());

  // New state for summaries
  const [fileSummaries, setFileSummaries] = useState<Map<string, string>>(new Map());
  const [projectSummary, setProjectSummary] = useState<string>('');
  const [summaryStatus, setSummaryStatus] = useState<Map<string, SummaryStatus>>(new Map());
  const [isProjectSummaryLoading, setIsProjectSummaryLoading] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(() => localStorage.getItem('github_token'));

  // Explanation level preference
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>(() => {
    const saved = localStorage.getItem('explanation_level');
    return (saved === 'beginner' || saved === 'expert') ? saved : 'intermediate';
  });

  // Ref to track the last saved project to prevent duplicate saves
  const lastSavedProjectRef = useRef<string | null>(null);

  // fetchAndCacheExplanation both reads and writes these, and runs inside a long
  // `for await` loop. Reading them from state would pin a snapshot taken before
  // the loop started, so mirror them into refs and read those instead.
  const explanationsCacheRef = useRef(explanationsCache);
  const processingStatusRef = useRef(processingStatus);
  const globalBlockCacheRef = useRef(globalBlockCache);
  const dispatchedFilesRef = useRef<Set<string>>(new Set());

  useEffect(() => { explanationsCacheRef.current = explanationsCache; }, [explanationsCache]);
  useEffect(() => { processingStatusRef.current = processingStatus; }, [processingStatus]);
  useEffect(() => { globalBlockCacheRef.current = globalBlockCache; }, [globalBlockCache]);

  const currentExplanation = useMemo(() => {
    if (!selectedFile) return null;
    const levelMap = explanationsCache.get(selectedFile.path);
    return levelMap?.get(explanationLevel) ?? null;
  }, [selectedFile, explanationsCache, explanationLevel]);

  const isExplanationLoading = useMemo(() => {
      if (!selectedFile) return false;
      return processingStatus.get(selectedFile.path) === 'processing';
  }, [selectedFile, processingStatus]);
  
  const isProcessingQueueActive = processingQueue.length > 0 || Array.from(processingStatus.values()).some(s => s === 'processing');
  
  const remainingFilesToProcess = useMemo(() => {
    if (!fileTree) return 0;
    const allFiles = getAllFiles(fileTree);
    return allFiles.filter(file => {
      const levelMap = explanationsCache.get(file.path);
      return !levelMap?.has(explanationLevel);
    }).length;
  }, [fileTree, explanationsCache, explanationLevel]);

  const handleApiKeySubmit = (newApiKey: string, newGithubToken?: string) => {
    localStorage.setItem('gemini_api_key', newApiKey);
    if (newGithubToken) {
      localStorage.setItem('github_token', newGithubToken);
      setGithubToken(newGithubToken);
    }
    setApiKey(newApiKey);
    setAuthError(null);
  };

  const handleAuthError = (error: string) => {
    setAuthError(error);
  };

  useEffect(() => {
    if (!authError) return;
    const timer = setTimeout(() => setAuthError(null), 5000);
    return () => clearTimeout(timer);
  }, [authError]);

  useEffect(() => {
    localStorage.setItem('explanation_level', explanationLevel);
  }, [explanationLevel]);

  const handleLogout = () => {
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('github_token');
    setApiKey(null);
    setGithubToken(null);
    setFileTree(null);
    setSelectedFile(null);
    setExplanationsCache(new Map());
    setProcessingStatus(new Map());
    setProcessingQueue([]);
    setGlobalBlockCache(new Map());
    setFileSummaries(new Map());
    setProjectSummary('');
    setSummaryStatus(new Map());
    setHistory([]);
    setActiveHistoryId(null);
    lastSavedProjectRef.current = null;
    dispatchedFilesRef.current.clear();
  };

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        let loadedHistory: HistoryEntry[] = [];

        if (githubToken) {
          // Try to load from Gist first
          try {
            loadedHistory = await loadHistoryFromGist(githubToken);
          } catch (error) {
            console.error('Failed to load from Gist, falling back to localStorage:', error);
            loadedHistory = loadHistoryFromLocalStorage();
          }
        } else {
          // No GitHub token, load from localStorage only
          loadedHistory = loadHistoryFromLocalStorage();
        }

        setHistory(loadedHistory);
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    };

    if (apiKey) {
      loadHistory();
    }
  }, [apiKey, githubToken]);

  // Save current state to history
  const saveToHistory = useCallback(async () => {
    if (!fileTree) return;

    const projectName = fileTree.name === 'root' && fileTree.children.length > 0
      ? fileTree.children[0].name
      : fileTree.name;

    // Create a unique identifier for this project state
    const projectIdentifier = `${projectName}-${explanationsCache.size}-${fileSummaries.size}-${projectSummary.slice(0, 50)}`;

    // Check if we've already saved this exact state
    if (lastSavedProjectRef.current === projectIdentifier) {
      return;
    }

    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      projectName: projectName || 'Untitled Project',
      fileTree,
      explanationsCache: serializeExplanations(explanationsCache),
      fileSummaries: Object.fromEntries(fileSummaries),
      projectSummary,
    };

    setHistory(prev => {
      const updatedHistory = [newEntry, ...prev].slice(0, 50); // Keep last 50 entries

      // Save to localStorage immediately
      saveHistoryToLocalStorage(updatedHistory);

      // Save to Gist if token available
      if (githubToken) {
        saveHistoryToGist(githubToken, updatedHistory).catch(error => {
          console.error('Failed to save to Gist (saved locally):', error);
        });
      }

      return updatedHistory;
    });

    setActiveHistoryId(newEntry.id);

    // Mark this project state as saved
    lastSavedProjectRef.current = projectIdentifier;
  }, [fileTree, explanationsCache, fileSummaries, projectSummary, githubToken]);

  // Load history entry
  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    const restored = deserializeExplanations(entry.explanationsCache);
    setFileTree(entry.fileTree);
    setExplanationsCache(restored);
    setFileSummaries(new Map(Object.entries(entry.fileSummaries ?? {})));
    setProjectSummary(entry.projectSummary);
    setActiveHistoryId(entry.id);
    setSelectedFile(null);

    // Mark all files as 'done' in processing status
    const allFiles = getAllFiles(entry.fileTree);
    const newProcessingStatus = new Map<string, ProcessingStatus>();
    allFiles.forEach(file => {
      if (restored.has(file.path)) {
        newProcessingStatus.set(file.path, 'done');
      }
    });
    setProcessingStatus(newProcessingStatus);
  }, []);

  // Clear history
  const handleClearHistory = useCallback(async () => {
    setHistory([]);
    setActiveHistoryId(null);
    saveHistoryToLocalStorage([]);

    if (githubToken) {
      try {
        await saveHistoryToGist(githubToken, []);
      } catch (error) {
        console.error('Failed to clear Gist:', error);
      }
    }
  }, [githubToken]);

  const generateSummaries = useCallback(async (files: FileNode[]) => {
      if (files.length === 0 || !apiKey) return;
      
      setIsProjectSummaryLoading(true);
      
      const statuses = new Map<string, SummaryStatus>(files.map(f => [f.path, 'summarizing' as SummaryStatus]));
      setSummaryStatus(new Map(statuses));

      try {
          const filesWithContent = files.map(file => ({
              path: file.path,
              name: file.name,
              content: file.content || ''
          }));

          const newSummaries = new Map<string, string>();

          // Stream summaries as they come in
          let projectSummaryReceived = false;
          for await (const result of generateAllSummariesStream(filesWithContent, apiKey)) {
              if (result.type === 'file_summary') {
                  newSummaries.set(result.path, result.summary);
                  statuses.set(result.path, 'done');

                  setFileSummaries(new Map(newSummaries));
                  setSummaryStatus(new Map(statuses));
              } else if (result.type === 'project_summary') {
                  setProjectSummary(result.summary);
                  projectSummaryReceived = true;
              } else if (result.type === 'error') {
                  throw new Error(result.message);
              }
          }
          
          // If no project summary was received, generate a fallback one
          if (!projectSummaryReceived && newSummaries.size > 0) {
              try {
                  const fallbackSummary = await generateProjectSummary(
                      Array.from(newSummaries.entries()).map(([path, summary]) => ({path, summary})), 
                      apiKey
                  );
                  setProjectSummary(fallbackSummary);
              } catch (fallbackError) {
                  console.error("Fallback project summary also failed:", fallbackError);
                  setProjectSummary("Unable to generate project summary.");
              }
          }
          
      } catch(error) {
          console.error("Failed to generate summaries:", error);
          
          // Fallback to error state
          const errorSummaries = new Map<string, string>();
          files.forEach(f => {
              errorSummaries.set(f.path, 'Failed to generate summary.');
              statuses.set(f.path, 'done');
          });
          setFileSummaries(errorSummaries);
          setSummaryStatus(new Map(statuses));
          setProjectSummary("Could not generate a project summary.");
      }

      setIsProjectSummaryLoading(false);

  }, [apiKey]);
  
  const handleProjectReady = useCallback((rootNode: FileNode) => {
    setFileTree(rootNode);
    setActiveHistoryId(null); // Reset active history when loading new project
    lastSavedProjectRef.current = null; // Reset saved project ref for new project
    const allFiles = getAllFiles(rootNode);
    if (allFiles.length > 0) {
      generateSummaries(allFiles);
      if (allFiles.length === 1) {
        setSelectedFile(allFiles[0]);
      }
    }
  }, [generateSummaries]);

 const fetchAndCacheExplanation = useCallback(async (file: FileNode, level: ExplanationLevel) => {
    if (explanationsCacheRef.current.get(file.path)?.has(level)) {
      return;
    }

    if (!file.content || !apiKey || processingStatusRef.current.get(file.path) === 'processing') {
      return;
    }

    processingStatusRef.current = new Map(processingStatusRef.current).set(file.path, 'processing');
    setProcessingStatus(prev => new Map(prev).set(file.path, 'processing'));
    setExplanationsCache(prev => {
      const newCache = new Map(prev);
      const levelMap = new Map(newCache.get(file.path) ?? []);
      levelMap.set(level, { blocks: [] });
      newCache.set(file.path, levelMap);
      return newCache;
    });

    try {
        const stream = explainFileInBulk(file.name, file.content, apiKey, level);

        let buffer = '';
        const blocks: ExplanationBlock[] = [];

        for await (const chunk of stream) {
            if (chunk.text) {
                buffer += chunk.text;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && trimmedLine.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(trimmedLine);
                            if (parsed.code_block && parsed.explanation) {
                                const blockHash = createBlockHash(parsed.code_block);
                                let explanation = parsed.explanation;
                                
                                const cachedExplanation = globalBlockCacheRef.current.get(blockHash);
                                if (cachedExplanation) {
                                    explanation = cachedExplanation;
                                } else {
                                    globalBlockCacheRef.current = new Map(globalBlockCacheRef.current).set(blockHash, explanation);
                                    setGlobalBlockCache(globalBlockCacheRef.current);
                                }
                                
                                blocks.push({
                                    code_block: parsed.code_block,
                                    explanation: explanation
                                });
                                
                                // Update UI with new block immediately
                                setExplanationsCache(prev => {
                                    const newCache = new Map(prev);
                                    const levelMap = new Map(newCache.get(file.path) ?? []);
                                    levelMap.set(level, { blocks: [...blocks] });
                                    newCache.set(file.path, levelMap);
                                    return newCache;
                                });
                            }
                        } catch (e) {
                            // Partial line from the stream, wait for the rest.
                        }
                    }
                }
            }
        }

        // Process any remaining content in buffer
        if (buffer.trim() && buffer.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(buffer.trim());
                if (parsed.code_block && parsed.explanation) {
                    const blockHash = createBlockHash(parsed.code_block);
                    let explanation = parsed.explanation;
                    
                    const cachedExplanation = globalBlockCacheRef.current.get(blockHash);
                    if (cachedExplanation) {
                        explanation = cachedExplanation;
                    } else {
                        globalBlockCacheRef.current = new Map(globalBlockCacheRef.current).set(blockHash, explanation);
                        setGlobalBlockCache(globalBlockCacheRef.current);
                    }
                    
                    blocks.push({
                        code_block: parsed.code_block,
                        explanation: explanation
                    });
                    
                    setExplanationsCache(prev => {
                        const newCache = new Map(prev);
                        const levelMap = new Map(newCache.get(file.path) ?? []);
                        levelMap.set(level, { blocks: [...blocks] });
                        newCache.set(file.path, levelMap);
                        return newCache;
                    });
                }
            } catch (e) {
                // Trailing partial line, nothing usable.
            }
        }

    } catch (error) {
      console.error(`Failed to explain ${file.name}:`, error);

      const errorDetails = error instanceof Error ? error.message : String(error);

      const genericMessage = handleApiError(error, apiKey, setApiKey);
      const errorMessage = `Failed to analyze file.\n\n**Error:** ${errorDetails}\n\n**Suggestion:** ${genericMessage}`;

      setExplanationsCache(prev => {
          const newCache = new Map(prev);
          const levelMap = new Map(newCache.get(file.path) ?? []);
          const block = { code_block: `// Error for ${file.name}`, explanation: errorMessage };
          levelMap.set(level, { blocks: [block] });
          newCache.set(file.path, levelMap);
          return newCache;
      });
    } finally {
      processingStatusRef.current = new Map(processingStatusRef.current).set(file.path, 'done');
      setProcessingStatus(prev => new Map(prev).set(file.path, 'done'));
    }
  }, [apiKey]);

  const handleSelectFile = useCallback((file: FileNode) => {
    if (file.path !== selectedFile?.path) {
      setSelectedFile(file);
      // Don't auto-fetch - let user choose the level
    }
  }, [selectedFile]);

  const handleLevelChange = useCallback((level: ExplanationLevel) => {
    setExplanationLevel(level);
    // Trigger analysis if this level doesn't exist yet
    if (selectedFile) {
      fetchAndCacheExplanation(selectedFile, level);
    }
  }, [selectedFile, fetchAndCacheExplanation]);

  const handleProcessAll = useCallback(() => {
    if (!fileTree) return;
    const allFiles = getAllFiles(fileTree).filter(file => {
      const levelMap = explanationsCache.get(file.path);
      return !levelMap?.has(explanationLevel);
    });
    setProcessingQueue(allFiles);
  }, [fileTree, explanationsCache, explanationLevel]);

  // Clones both Map levels so no previous state object is mutated in place.
  const updateBlock = useCallback((path: string, level: ExplanationLevel, blockIndex: number, update: (block: ExplanationBlock) => ExplanationBlock) => {
      setExplanationsCache(prev => {
          const levelMap = prev.get(path);
          const currentExpl = levelMap?.get(level);
          if (!levelMap || !currentExpl || !currentExpl.blocks[blockIndex]) return prev;

          const newBlocks = [...currentExpl.blocks];
          newBlocks[blockIndex] = update(newBlocks[blockIndex]);

          const newLevelMap = new Map(levelMap);
          newLevelMap.set(level, { ...currentExpl, blocks: newBlocks });

          const newCache = new Map(prev);
          newCache.set(path, newLevelMap);
          return newCache;
      });
  }, []);

  const handleDeepDive = useCallback(async (blockIndex: number) => {
      if (!selectedFile || !apiKey || deepDiveStatus.isLoading) return;

      const block = explanationsCacheRef.current.get(selectedFile.path)?.get(explanationLevel)?.blocks[blockIndex];

      if (!block) return;
      
      setDeepDiveStatus({ file: selectedFile.path, blockIndex, isLoading: true });

      try {
          const stream = await explainSnippetStream(block, selectedFile.name, apiKey);

          updateBlock(selectedFile.path, explanationLevel, blockIndex, b => ({ ...b, deep_dive_explanation: '' }));

          for await (const chunk of stream) {
              updateBlock(selectedFile.path, explanationLevel, blockIndex, b => ({
                  ...b,
                  deep_dive_explanation: (b.deep_dive_explanation || '') + (chunk.text ?? '')
              }));
          }
      } catch (error) {
          console.error('Deep dive failed:', error);

          const errorDetails = error instanceof Error ? error.message : String(error);
          const genericMessage = handleApiError(error, apiKey, setApiKey);
          const errorMessage = `**Deep Dive Failed**\n\n**Error:** ${errorDetails}\n\n**Suggestion:** ${genericMessage}`;

          updateBlock(selectedFile.path, explanationLevel, blockIndex, b => ({ ...b, deep_dive_explanation: errorMessage }));
      } finally {
          setDeepDiveStatus({ file: null, blockIndex: null, isLoading: false });
      }
  }, [selectedFile, apiKey, deepDiveStatus.isLoading, explanationLevel, updateBlock]);

  useEffect(() => {
    if (processingQueue.length === 0) return;

    const fileToProcess = processingQueue[0];
    const dispatchKey = `${fileToProcess.path}::${explanationLevel}`;

    // The effect re-runs while the file is still streaming, so a state-based
    // guard would read a stale snapshot. This ref is written synchronously.
    if (dispatchedFilesRef.current.has(dispatchKey)) return;

    if (explanationsCacheRef.current.get(fileToProcess.path)?.has(explanationLevel)) {
      setProcessingQueue(prev => prev.slice(1));
      return;
    }

    dispatchedFilesRef.current.add(dispatchKey);

    fetchAndCacheExplanation(fileToProcess, explanationLevel)
      .catch(error => {
        console.error(`Queue processing failed for ${fileToProcess.name}:`, error);
      })
      .finally(() => {
        dispatchedFilesRef.current.delete(dispatchKey);
        setProcessingQueue(prev => prev.slice(1));
      });

  }, [processingQueue, fetchAndCacheExplanation, explanationLevel]);

  // Auto-save to history when all processing is complete
  useEffect(() => {
    const isQueueEmpty = processingQueue.length === 0;
    const hasProcessedFiles = Array.from(processingStatus.values()).some(s => s === 'done');
    const isProcessing = Array.from(processingStatus.values()).some(s => s === 'processing');

    // Only save if we have processed files, queue is empty, and nothing is currently processing
    if (isQueueEmpty && hasProcessedFiles && !isProcessing && fileTree) {
      // Check if we have explanations and summaries ready
      const hasExplanations = explanationsCache.size > 0;
      const hasSummaries = fileSummaries.size > 0 || projectSummary !== '';

      if (hasExplanations && hasSummaries) {
        // Debounce to avoid multiple saves
        const timer = setTimeout(() => {
          saveToHistory();
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [processingQueue, processingStatus, fileTree, explanationsCache, fileSummaries, projectSummary, saveToHistory]);

  if (isAppLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-blue-light">
        <SpinnerIcon className="w-16 h-16 text-blue-accent" />
        <p className="mt-4 text-xl">Loading files...</p>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <>
        <LoginScreen onSuccess={handleApiKeySubmit} onError={handleAuthError} />
        {authError && (
          <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {authError}
          </div>
        )}
      </>
    );
  }

  if (!fileTree) {
    return (
      <>
        <a
          href="https://chraltro.github.io/wayfinder/"
          className="fixed bottom-5 right-5 z-[1000] opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-200"
          title="Back to Wayfinder"
        >
          <img src={getAssetPath('wayfinder_logo.svg')} alt="Wayfinder" className="w-12 h-12 block" />
        </a>
        <WelcomeScreen
          onProjectReady={handleProjectReady}
          setIsLoading={setIsAppLoading}
          history={history}
          onSelectHistory={handleSelectHistory}
        />
      </>
    );
  }

  return (
    <>
      {/* Wayfinder Logo Link */}
      <a
        href="https://chraltro.github.io/wayfinder/"
        className="fixed bottom-5 right-5 z-[1000] opacity-60 hover:opacity-100 hover:scale-110 transition-all duration-200"
        title="Back to Wayfinder"
      >
        <img src={getAssetPath('wayfinder_logo.svg')} alt="Wayfinder" className="w-12 h-12 block" />
      </a>

      <div className="flex h-screen max-h-screen overflow-hidden text-sm">
        {/* File Explorer */}
        <aside className="w-1/4 min-w-[300px] max-w-[450px] border-r border-gray-700">
        <Suspense fallback={
          <div className="flex items-center justify-center h-32 text-gray-500">
            <SpinnerIcon className="w-8 h-8" />
          </div>
        }>
          <FileExplorer
            node={fileTree}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            onProcessAll={handleProcessAll}
            processingStatus={processingStatus}
            isProcessingQueueActive={isProcessingQueueActive}
            processingQueueLength={processingQueue.length}
            remainingFilesToProcess={remainingFilesToProcess}
            fileSummaries={fileSummaries}
            summaryStatus={summaryStatus}
            projectSummary={projectSummary}
            isProjectSummaryLoading={isProjectSummaryLoading}
            onLogout={handleLogout}
            history={history}
            activeHistoryId={activeHistoryId}
            onSelectHistory={handleSelectHistory}
            onClearHistory={handleClearHistory}
            explanationLevel={explanationLevel}
            explanationsCache={explanationsCache}
          />
        </Suspense>
      </aside>

      {/* Code Explainer View */}
      <main className="w-3/4 flex-grow bg-gray-900 flex flex-col">
        {/* Header with Back Button and Explanation Level Selector */}
        {fileTree && (
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setFileTree(null);
                setSelectedFile(null);
                setExplanationsCache(new Map());
                setProcessingStatus(new Map());
                setProcessingQueue([]);
                setFileSummaries(new Map());
                setProjectSummary('');
                setSummaryStatus(new Map());
              }}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Upload New File
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 font-medium">Explanation Level:</span>
              <div className="flex gap-2">
                {(['beginner', 'intermediate', 'expert'] as ExplanationLevel[]).map((level) => {
                  const levelMap = selectedFile ? explanationsCache.get(selectedFile.path) : null;
                  const isCached = levelMap?.has(level) ?? false;
                  const isActive = explanationLevel === level;

                  return (
                    <button
                      key={level}
                      onClick={() => handleLevelChange(level)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        isActive
                          ? 'bg-cyan-accent text-gray-900'
                          : isCached
                            ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 hover:text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex-grow overflow-hidden">
        {selectedFile ? (
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <SpinnerIcon className="w-12 h-12" />
              <p className="mt-4">Loading {selectedFile.name}...</p>
            </div>
          }>
            <CodeExplainerView
                explanation={currentExplanation}
                isLoading={isExplanationLoading}
                fileName={selectedFile.name}
                code={selectedFile.content || ''}
                onDeepDive={handleDeepDive}
                deepDiveStatus={deepDiveStatus}
            />
          </Suspense>
        ) : (
            <div className="flex items-center justify-center h-full text-gray-600 p-8 text-center">
                <p>Select a file from the explorer to begin analysis.<br/>You can hover over files to see a brief summary.</p>
            </div>
        )}
        </div>
      </main>
    </div>
    </>
  );
};

export default App;
