
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import type { FileNode, Explanation, ExplanationBlock, HistoryEntry } from './types';
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
  const [explanationsCache, setExplanationsCache] = useState<Map<string, Explanation>>(new Map());
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

  const currentExplanation = useMemo(() => {
    if (!selectedFile) return null;
    return explanationsCache.get(selectedFile.path) ?? null;
  }, [selectedFile, explanationsCache]);

  const isExplanationLoading = useMemo(() => {
      if (!selectedFile) return false;
      return processingStatus.get(selectedFile.path) === 'processing';
  }, [selectedFile, processingStatus]);
  
  const isProcessingQueueActive = processingQueue.length > 0 || Array.from(processingStatus.values()).some(s => s === 'processing');
  
  const remainingFilesToProcess = useMemo(() => {
    if (!fileTree) return 0;
    const allFiles = getAllFiles(fileTree);
    return allFiles.filter(file => !explanationsCache.has(file.path)).length;
  }, [fileTree, explanationsCache]);

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
    setTimeout(() => setAuthError(null), 5000); // Clear error after 5 seconds
  };

  // Save explanation level preference
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
    lastSavedProjectRef.current = null; // Reset saved project ref
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
      explanationsCache: Object.fromEntries(explanationsCache),
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
    setFileTree(entry.fileTree);
    setExplanationsCache(new Map(Object.entries(entry.explanationsCache)));
    setFileSummaries(new Map(Object.entries(entry.fileSummaries)));
    setProjectSummary(entry.projectSummary);
    setActiveHistoryId(entry.id);
    setSelectedFile(null);

    // Mark all files as 'done' in processing status
    const allFiles = getAllFiles(entry.fileTree);
    const newProcessingStatus = new Map<string, ProcessingStatus>();
    allFiles.forEach(file => {
      if (entry.explanationsCache[file.path]) {
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
      
      // Initialize all files as summarizing
      const summaryStatus = new Map(files.map(f => [f.path, 'summarizing' as SummaryStatus]));
      setSummaryStatus(summaryStatus);

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
                  summaryStatus.set(result.path, 'done');
                  
                  // Update UI incrementally
                  setFileSummaries(new Map(newSummaries));
                  setSummaryStatus(new Map(summaryStatus));
              } else if (result.type === 'project_summary') {
                  setProjectSummary(result.summary);
                  projectSummaryReceived = true;
              } else if (result.type === 'error') {
                  throw new Error(result.message);
              }
          }
          
          // If no project summary was received, generate a fallback one
          if (!projectSummaryReceived && newSummaries.size > 0) {
              console.warn("Project summary not received from streaming API, generating fallback...");
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
              summaryStatus.set(f.path, 'done');
          });
          setFileSummaries(errorSummaries);
          setSummaryStatus(new Map(summaryStatus));
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

 const fetchAndCacheExplanation = useCallback(async (file: FileNode) => {
    if (!file.content || !apiKey || processingStatus.get(file.path) === 'done' || processingStatus.get(file.path) === 'processing') {
      return;
    }

    setProcessingStatus(prev => new Map(prev).set(file.path, 'processing'));
    setExplanationsCache(prev => new Map(prev).set(file.path, { blocks: [] }));

    try {
        const stream = await explainFileInBulk(file.name, file.content, apiKey, explanationLevel);
        
        let buffer = '';
        const blocks: ExplanationBlock[] = [];
        let duplicatesFound = 0;
        let newExplanations = 0;
        
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
                                
                                // Check if we already have an explanation for this code block
                                const cachedExplanation = globalBlockCache.get(blockHash);
                                if (cachedExplanation) {
                                    explanation = cachedExplanation;
                                    duplicatesFound++;
                                } else {
                                    // Cache the new explanation
                                    setGlobalBlockCache(prev => new Map(prev).set(blockHash, explanation));
                                    newExplanations++;
                                }
                                
                                blocks.push({
                                    code_block: parsed.code_block,
                                    explanation: explanation
                                });
                                
                                // Update UI with new block immediately
                                setExplanationsCache(prev => {
                                    const newCache = new Map(prev);
                                    newCache.set(file.path, { blocks: [...blocks] });
                                    return newCache;
                                });
                            }
                        } catch (e) {
                            console.warn('Skipping invalid JSON line:', trimmedLine);
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
                    
                    const cachedExplanation = globalBlockCache.get(blockHash);
                    if (cachedExplanation) {
                        explanation = cachedExplanation;
                        duplicatesFound++;
                    } else {
                        setGlobalBlockCache(prev => new Map(prev).set(blockHash, explanation));
                        newExplanations++;
                    }
                    
                    blocks.push({
                        code_block: parsed.code_block,
                        explanation: explanation
                    });
                    
                    setExplanationsCache(prev => {
                        const newCache = new Map(prev);
                        newCache.set(file.path, { blocks: [...blocks] });
                        return newCache;
                    });
                }
            } catch (e) {
                console.warn('Skipping invalid JSON in buffer:', buffer.trim());
            }
        }
        
        // Log cache usage stats
        if (duplicatesFound > 0 || newExplanations > 0) {
            console.log(`📋 Explanation cache stats for ${file.name}: ${newExplanations} new explanations, ${duplicatesFound} reused from cache`);
        }
        
    } catch (error) {
      console.error(`Error fetching explanation for ${file.name}:`, error);
      const errorMessage = `Failed to analyze file. ${handleApiError(error, apiKey, setApiKey)}`;
      
      setExplanationsCache(prev => {
          const newCache = new Map(prev);
          const block = { code_block: `// Error for ${file.name}`, explanation: errorMessage };
          newCache.set(file.path, { blocks: [block] });
          return newCache;
      });
    } finally {
      setProcessingStatus(prev => new Map(prev).set(file.path, 'done'));
    }
  }, [processingStatus, apiKey, globalBlockCache]);

  const handleSelectFile = useCallback((file: FileNode) => {
    if (file.path !== selectedFile?.path) {
      setSelectedFile(file);
      fetchAndCacheExplanation(file);
    }
  }, [selectedFile, fetchAndCacheExplanation]);

  const handleProcessAll = useCallback(() => {
    if (!fileTree) return;
    const allFiles = getAllFiles(fileTree).filter(file => !explanationsCache.has(file.path));
    setProcessingQueue(allFiles);
  }, [fileTree, explanationsCache]);

  const handleDeepDive = async (blockIndex: number) => {
      if (!selectedFile || !apiKey || deepDiveStatus.isLoading) return;

      const explanation = explanationsCache.get(selectedFile.path);
      const block = explanation?.blocks[blockIndex];

      if (!block) return;
      
      setDeepDiveStatus({ file: selectedFile.path, blockIndex, isLoading: true });

      try {
          const stream = await explainSnippetStream(block, selectedFile.name, apiKey);
          
          setExplanationsCache(prev => {
              const newCache = new Map(prev);
              const currentExpl = newCache.get(selectedFile.path);
              if (currentExpl) {
                  const newBlocks = [...currentExpl.blocks];
                  newBlocks[blockIndex] = { ...newBlocks[blockIndex], deep_dive_explanation: '' };
                  newCache.set(selectedFile.path, { ...currentExpl, blocks: newBlocks });
              }
              return newCache;
          });

          for await (const chunk of stream) {
              setExplanationsCache(prev => {
                  const newCache = new Map(prev);
                  const currentExpl = newCache.get(selectedFile.path);
                  if (currentExpl) {
                      const newBlocks = [...currentExpl.blocks];
                      const currentBlock = newBlocks[blockIndex];
                      newBlocks[blockIndex] = { ...currentBlock, deep_dive_explanation: (currentBlock.deep_dive_explanation || '') + chunk.text };
                      newCache.set(selectedFile.path, { ...currentExpl, blocks: newBlocks });
                  }
                  return newCache;
              });
          }
      } catch (error) {
          console.error("Deep dive failed:", error);
          if (!selectedFile) return;

          const errorMessage = `**Deep Dive Failed:** ${handleApiError(error, apiKey, setApiKey)}`;
          
          setExplanationsCache(prev => {
              const newCache = new Map(prev);
              const currentExpl = newCache.get(selectedFile.path);
              if (currentExpl) {
                  const newBlocks = [...currentExpl.blocks];
                  newBlocks[blockIndex] = { ...newBlocks[blockIndex], deep_dive_explanation: errorMessage };
                  newCache.set(selectedFile.path, { ...currentExpl, blocks: newBlocks });
              }
              return newCache;
          });
      } finally {
          setDeepDiveStatus({ file: null, blockIndex: null, isLoading: false });
      }
  };

  useEffect(() => {
    if (processingQueue.length === 0) return;

    const fileToProcess = processingQueue[0];

    // Skip files that are already processing or already have explanations
    if (processingStatus.get(fileToProcess.path) === 'processing' || explanationsCache.has(fileToProcess.path)) {
      setProcessingQueue(prev => prev.slice(1));
      return;
    }

    fetchAndCacheExplanation(fileToProcess).then(() => {
      setProcessingQueue(prev => prev.slice(1));
    });

  }, [processingQueue, fetchAndCacheExplanation, processingStatus, explanationsCache]);

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
          href="../wayfinder/index.html"
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
        href="../wayfinder/index.html"
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
          />
        </Suspense>
      </aside>

      {/* Code Explainer View */}
      <main className="w-3/4 flex-grow bg-gray-900 flex flex-col">
        {/* Explanation Level Selector */}
        {fileTree && (
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-end gap-3">
            <label htmlFor="explanation-level" className="text-sm text-gray-400 font-medium">
              Explanation Level:
            </label>
            <select
              id="explanation-level"
              value={explanationLevel}
              onChange={(e) => setExplanationLevel(e.target.value as ExplanationLevel)}
              className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-accent"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
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
