
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { FileNode, Explanation, ExplanationBlock } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import FileExplorer, { ProcessingStatus } from './components/FileExplorer';
import CodeExplainerView from './components/CodeExplainerView';
import { explainFileStream, explainSnippetStream } from './services/geminiService';
import SpinnerIcon from './components/icons/SpinnerIcon';
import ApiKeyScreen from './components/ApiKeyScreen';

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

interface DeepDiveStatus {
    file: string | null;
    blockIndex: number | null;
    isLoading: boolean;
}

const App: React.FC = () => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(() => {
    // Prioritize the environment variable for environments like Google AI Studio
    if (process.env.API_KEY) {
        return process.env.API_KEY;
    }
    // Fallback to local storage for user-provided keys
    return localStorage.getItem('gemini_api_key');
  });
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [explanationsCache, setExplanationsCache] = useState<Map<string, Explanation>>(new Map());
  const [processingStatus, setProcessingStatus] = useState<Map<string, ProcessingStatus>>(new Map());
  const [processingQueue, setProcessingQueue] = useState<FileNode[]>([]);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(false);
  const [deepDiveStatus, setDeepDiveStatus] = useState<DeepDiveStatus>({ file: null, blockIndex: null, isLoading: false });


  const currentExplanation = useMemo(() => {
    if (!selectedFile) return null;
    return explanationsCache.get(selectedFile.path) ?? null;
  }, [selectedFile, explanationsCache]);

  const isExplanationLoading = useMemo(() => {
      if (!selectedFile) return false;
      return processingStatus.get(selectedFile.path) === 'processing';
  }, [selectedFile, processingStatus]);
  
  const isProcessingQueueActive = processingQueue.length > 0 || Array.from(processingStatus.values()).some(s => s === 'processing');

  const handleApiKeySubmit = (newApiKey: string) => {
    setApiKey(newApiKey);
  };

  const handleProjectReady = (rootNode: FileNode) => {
    setFileTree(rootNode);
    const allFiles = getAllFiles(rootNode);
    if(allFiles.length > 0) {
        handleSelectFile(allFiles[0]);
    }
  };

 const streamAndCacheExplanation = useCallback(async (file: FileNode) => {
    if (!file.content || !apiKey || processingStatus.get(file.path) === 'done' || processingStatus.get(file.path) === 'processing') {
      return;
    }

    setProcessingStatus(prev => new Map(prev).set(file.path, 'processing'));
    setExplanationsCache(prev => new Map(prev).set(file.path, { blocks: [] }));

    try {
        const stream = await explainFileStream(file.name, file.content, apiKey);
        let buffer = '';
        let mode: 'find_code' | 'find_explanation' | 'stream_explanation' = 'find_code';
        let currentCodeBlock = '';
        
        const CODE_MARKER = '---CODE---';
        const EXPLANATION_MARKER = '---EXPLANATION---';

        const processBuffer = () => {
            let madeProgress = true;
            while (madeProgress) {
                madeProgress = false;

                if (mode === 'find_code') {
                    const markerIndex = buffer.indexOf(CODE_MARKER);
                    if (markerIndex === -1) break;

                    buffer = buffer.slice(markerIndex + CODE_MARKER.length);
                    mode = 'find_explanation';
                    madeProgress = true;
                }

                if (mode === 'find_explanation') {
                    const markerIndex = buffer.indexOf(EXPLANATION_MARKER);
                    if (markerIndex === -1) break;
                    
                    let codeContent = buffer.slice(0, markerIndex);
                    // The model is told to put a newline after ---CODE---. Let's remove that one.
                    if (codeContent.startsWith('\n')) {
                        codeContent = codeContent.substring(1);
                    }
                    // And it might add a newline before ---EXPLANATION---. Let's remove that one too.
                    if (codeContent.endsWith('\n')) {
                        codeContent = codeContent.slice(0, -1);
                    }
                    currentCodeBlock = codeContent;
                    
                    if (currentCodeBlock) {
                        setExplanationsCache(prev => {
                            const newCache = new Map(prev);
                            const currentExpl = newCache.get(file.path) ?? { blocks: [] };
                            const newBlocks = [...currentExpl.blocks, { code_block: currentCodeBlock, explanation: '' }];
                            newCache.set(file.path, { ...currentExpl, blocks: newBlocks });
                            return newCache;
                        });
                    }

                    buffer = buffer.slice(markerIndex + EXPLANATION_MARKER.length);
                    mode = 'stream_explanation';
                    madeProgress = true;
                }

                if (mode === 'stream_explanation') {
                    const nextCodeMarkerIndex = buffer.indexOf(CODE_MARKER);
                    
                    if (nextCodeMarkerIndex === -1) {
                        const explanationChunk = buffer;
                        buffer = '';

                        if (explanationChunk) {
                             setExplanationsCache(prev => {
                                const newCache = new Map(prev);
                                const currentExpl = newCache.get(file.path);
                                if (!currentExpl || currentExpl.blocks.length === 0) return prev;
                                
                                const newBlocks = [...currentExpl.blocks];
                                const lastBlock = newBlocks[newBlocks.length - 1];
                                newBlocks[newBlocks.length - 1] = { ...lastBlock, explanation: lastBlock.explanation + explanationChunk };
                                newCache.set(file.path, { ...currentExpl, blocks: newBlocks });
                                return newCache;
                            });
                            madeProgress = true;
                        }
                        break; 
                    } else {
                        const explanationChunk = buffer.slice(0, nextCodeMarkerIndex);
                        
                        if (explanationChunk) {
                           setExplanationsCache(prev => {
                                const newCache = new Map(prev);
                                const currentExpl = newCache.get(file.path);
                                if (!currentExpl || currentExpl.blocks.length === 0) return prev;
                                
                                const newBlocks = [...currentExpl.blocks];
                                const lastBlock = newBlocks[newBlocks.length - 1];
                                newBlocks[newBlocks.length - 1] = { ...lastBlock, explanation: (lastBlock.explanation + explanationChunk).trim() };
                                newCache.set(file.path, { ...currentExpl, blocks: newBlocks });
                                return newCache;
                            });
                        }
                        
                        buffer = buffer.slice(nextCodeMarkerIndex);
                        mode = 'find_code';
                        madeProgress = true;
                    }
                }
            }
        };

        for await (const chunk of stream) {
            buffer += chunk.text;
            processBuffer();
        }
        
        if (buffer) {
            let finalExplanationChunk = buffer;
            const finalCodeMarkerIndex = buffer.indexOf(CODE_MARKER);
            if (finalCodeMarkerIndex !== -1) {
                finalExplanationChunk = buffer.slice(0, finalCodeMarkerIndex);
            }

            finalExplanationChunk = finalExplanationChunk.trim();

            if (finalExplanationChunk) {
                 setExplanationsCache(prev => {
                    const newCache = new Map(prev);
                    const currentExpl = newCache.get(file.path);
                    if (!currentExpl || currentExpl.blocks.length === 0) return prev;
                    
                    const newBlocks = [...currentExpl.blocks];
                    const lastBlock = newBlocks[newBlocks.length - 1];
                    newBlocks[newBlocks.length - 1] = { ...lastBlock, explanation: (lastBlock.explanation + finalExplanationChunk).trim() };
                    newCache.set(file.path, { ...currentExpl, blocks: newBlocks });
                    return newCache;
                });
            }
        }

    } catch (error) {
      console.error(`Error streaming explanation for ${file.name}:`, error);
       if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('API key is invalid'))) {
            const isEnvKey = !!process.env.API_KEY && apiKey === process.env.API_KEY;
            setExplanationsCache(prev => {
                const newCache = new Map(prev);
                const errorMessage = isEnvKey
                    ? `Failed to analyze file. The API Key provided by the environment appears to be invalid.`
                    : `Failed to analyze file. The provided API Key is invalid. Please enter a valid key.`;
                const block = { code_block: `// Error for ${file.name}`, explanation: errorMessage };
                newCache.set(file.path, { blocks: [block] });
                return newCache;
            });

            if (!isEnvKey) {
                // Clear invalid user-provided API key and force re-entry
                localStorage.removeItem('gemini_api_key');
                setApiKey(null);
            }
       }
    } finally {
      setProcessingStatus(prev => new Map(prev).set(file.path, 'done'));
    }
  }, [processingStatus, apiKey]);

  const handleSelectFile = useCallback((file: FileNode) => {
    if (file.path !== selectedFile?.path) {
      setSelectedFile(file);
      streamAndCacheExplanation(file);
    }
  }, [selectedFile, streamAndCacheExplanation]);

  const handleProcessAll = useCallback(() => {
    if (!fileTree) return;
    const allFiles = getAllFiles(fileTree).filter(file => !explanationsCache.has(file.path) && processingStatus.get(file.path) !== 'processing');
    setProcessingQueue(allFiles);
  }, [fileTree, explanationsCache, processingStatus]);

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

          const isEnvKey = !!process.env.API_KEY && apiKey === process.env.API_KEY;
          let errorMessage = '**Deep Dive Failed:** An unexpected error occurred.';

          if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('API key is invalid'))) {
              errorMessage = isEnvKey
                  ? '**Deep Dive Failed:** The API Key provided by the environment appears to be invalid.'
                  : '**Deep Dive Failed:** The provided API Key is invalid. You will be prompted for a new key.';
              
              if (!isEnvKey) {
                  localStorage.removeItem('gemini_api_key');
                  setApiKey(null);
              }
          }
          
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
    
    streamAndCacheExplanation(fileToProcess).then(() => {
      setProcessingQueue(prev => prev.slice(1));
    });

  }, [processingQueue, streamAndCacheExplanation]);

  if (isAppLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-blue-light">
        <SpinnerIcon className="w-16 h-16 text-blue-accent" />
        <p className="mt-4 text-xl">Loading files...</p>
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyScreen onApiKeySubmit={handleApiKeySubmit} />;
  }

  if (!fileTree) {
    return <WelcomeScreen onProjectReady={handleProjectReady} setIsLoading={setIsAppLoading} />;
  }

  return (
    <div className="flex h-screen max-h-screen overflow-hidden text-sm">
      <aside className="w-1/4 min-w-[300px] max-w-[450px] border-r border-gray-700">
        <FileExplorer 
          node={fileTree} 
          selectedFile={selectedFile} 
          onSelectFile={handleSelectFile}
          onProcessAll={handleProcessAll}
          processingStatus={processingStatus}
          isProcessingQueueActive={isProcessingQueueActive}
        />
      </aside>

      <main className="w-3/4 flex-grow bg-gray-900">
        {selectedFile ? (
            <CodeExplainerView 
                explanation={currentExplanation}
                isLoading={isExplanationLoading}
                fileName={selectedFile.name}
                code={selectedFile.content || ''}
                onDeepDive={handleDeepDive}
                deepDiveStatus={deepDiveStatus}
            />
        ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
                <p>Select a file from the explorer to begin.</p>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;