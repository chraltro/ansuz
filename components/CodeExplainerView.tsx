
import React, { useState, useRef, useEffect, useMemo, CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Explanation } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import SparklesIcon from './icons/SparklesIcon';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';
import DownloadIcon from './icons/DownloadIcon';
import SearchIcon from './icons/SearchIcon';

interface CodeExplainerViewProps {
  explanation: Explanation | null;
  isLoading: boolean;
  fileName: string;
  code: string;
  onDeepDive: (blockIndex: number) => void;
  deepDiveStatus: {
      file: string | null;
      blockIndex: number | null;
      isLoading: boolean;
  };
}

const getLanguage = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'yml': case 'yaml': return 'yaml';
    default: return 'clike';
  }
};

const findBlock = (source: string, blockFromAI: string, startIndex: number): { index: number; content: string } | null => {
    if (!blockFromAI) return null;

    // Attempt a direct match first. This is the most common case (Unix/Mac files).
    let index = source.indexOf(blockFromAI, startIndex);
    if (index !== -1) {
        return { index, content: blockFromAI };
    }
    
    // If direct match fails, it might be due to line-ending differences (\n vs \r\n).
    // The AI will use \n. The source file might have \r\n (e.g., from Windows).
    const blockWithCRLF = blockFromAI.replace(/\n/g, '\r\n');

    if (blockWithCRLF !== blockFromAI) {
        index = source.indexOf(blockWithCRLF, startIndex);
        if (index !== -1) {
            // We found a match. The content we use for segmentation must be the
            // version we found in the source, so that `lastIndex` is updated correctly.
            return { index, content: blockWithCRLF };
        }
    }
    
    // If still no match, try normalizing whitespace (common with cached explanations)
    // This handles cases where cached blocks have different whitespace formatting
    const normalizeWhitespace = (text: string) => text.trim().replace(/\s+/g, ' ');
    const normalizedBlock = normalizeWhitespace(blockFromAI);
    
    // Search through the source for a block with matching normalized content
    const sourceLines = source.substring(startIndex).split('\n');
    let currentPos = startIndex;
    
    for (let i = 0; i < sourceLines.length; i++) {
        // Try different window sizes for matching
        for (let windowSize = 1; windowSize <= Math.min(5, sourceLines.length - i); windowSize++) {
            const candidateLines = sourceLines.slice(i, i + windowSize);
            const candidateBlock = candidateLines.join('\n');
            
            if (normalizeWhitespace(candidateBlock) === normalizedBlock) {
                // Found a match! Calculate the actual position
                const beforeCandidate = sourceLines.slice(0, i).join('\n');
                const actualIndex = startIndex + (i > 0 ? beforeCandidate.length + 1 : 0);
                return { index: actualIndex, content: candidateBlock };
            }
        }
        
        currentPos += sourceLines[i].length + 1; // +1 for newline
    }
    
    return null;
};


const CodeExplainerView: React.FC<CodeExplainerViewProps> = ({ explanation, isLoading, fileName, code, onDeepDive, deepDiveStatus }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverSource, setHoverSource] = useState<'left' | 'right' | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(new Set());
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const rightPaneRef = useRef<HTMLDivElement>(null);
  const streamingIndicatorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const explanationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const blockCount = explanation?.blocks.length ?? 0;
    explanationRefs.current = explanationRefs.current.slice(0, blockCount);
  }, [explanation]);

  const scrollOptions: ScrollIntoViewOptions = {
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  };
  
  const lineMetadata = useMemo(() => {
    const metadata = new Map<number, { blockIndex: number }>();
    if (!explanation || !code) return metadata;

    let lastIndex = 0;
    explanation.blocks.forEach((block, blockIndex) => {
        const blockContentFromAI = block.code_block;
        if (!blockContentFromAI) return;

        const match = findBlock(code, blockContentFromAI, lastIndex);
        
        if (!match) {
            console.warn("Could not find code block in source. View might be inaccurate.", { block: blockContentFromAI });
            return;
        }

        const { index: currentIndex, content: verbatimContent } = match;

        const startLine = (code.substring(0, currentIndex).match(/\n/g) || []).length + 1;
        const numLines = (verbatimContent.match(/\n/g) || []).length;
        const endLine = startLine + numLines;

        for (let i = startLine; i <= endLine; i++) {
            metadata.set(i, { blockIndex });
        }

        lastIndex = currentIndex + verbatimContent.length;
    });

    return metadata;
  }, [code, explanation]);

  const blockStartLines = useMemo(() => {
    const map = new Map<number, number>();
    if (!lineMetadata) return map;
    
    const seenBlocks = new Set<number>();
    for (const [line, meta] of lineMetadata.entries()) {
        if (!seenBlocks.has(meta.blockIndex)) {
            map.set(meta.blockIndex, line);
            seenBlocks.add(meta.blockIndex);
        }
    }
    return map;
  }, [lineMetadata]);
  
  const explanationSegments = useMemo(() => explanation?.blocks.map((block, index) => ({
      ...block,
      blockIndex: index,
  })) ?? [], [explanation]);

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return explanationSegments;

    const query = searchQuery.toLowerCase();
    return explanationSegments.filter(segment =>
      segment.code_block.toLowerCase().includes(query) ||
      segment.explanation.toLowerCase().includes(query) ||
      (segment.deep_dive_explanation && segment.deep_dive_explanation.toLowerCase().includes(query))
    );
  }, [explanationSegments, searchQuery]);

  const matchCount = filteredSegments.length;

  useEffect(() => {
    if (hoverSource === 'left' && hoveredIndex !== null && rightPaneRef.current) {
      explanationRefs.current[hoveredIndex]?.scrollIntoView(scrollOptions);
    }
  }, [hoveredIndex, hoverSource]);

  useEffect(() => {
    if (hoverSource === 'right' && hoveredIndex !== null) {
        const startLine = blockStartLines.get(hoveredIndex);
        if (startLine) {
            lineRefs.current[startLine]?.scrollIntoView(scrollOptions);
        }
    }
  }, [hoveredIndex, hoverSource, blockStartLines]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys when user is typing in search input
      if (document.activeElement === searchInputRef.current) {
        return;
      }

      const segments = filteredSegments;
      if (segments.length === 0) return;

      switch (e.key) {
        case 'n':
        case 'ArrowRight':
          e.preventDefault();
          setCurrentBlockIndex(prev => {
            const newIndex = prev === null ? 0 : Math.min(prev + 1, segments.length - 1);
            const blockIndex = segments[newIndex]?.blockIndex;
            if (blockIndex !== undefined) {
              explanationRefs.current[blockIndex]?.scrollIntoView(scrollOptions);
            }
            return newIndex;
          });
          break;

        case 'p':
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentBlockIndex(prev => {
            const newIndex = prev === null ? 0 : Math.max(prev - 1, 0);
            const blockIndex = segments[newIndex]?.blockIndex;
            if (blockIndex !== undefined) {
              explanationRefs.current[blockIndex]?.scrollIntoView(scrollOptions);
            }
            return newIndex;
          });
          break;

        case 'e':
          e.preventDefault();
          if (currentBlockIndex !== null && segments[currentBlockIndex]) {
            const blockIndex = segments[currentBlockIndex].blockIndex;
            const segment = segments[currentBlockIndex];

            if (segment.deep_dive_explanation) {
              // Toggle collapse state
              setCollapsedBlocks(prev => {
                const newSet = new Set(prev);
                if (newSet.has(blockIndex)) {
                  newSet.delete(blockIndex);
                } else {
                  newSet.add(blockIndex);
                }
                return newSet;
              });
            } else {
              // Trigger deep dive
              onDeepDive(blockIndex);
            }
          }
          break;

        case 'E':
          e.preventDefault();
          // Expand all: trigger deep dive for blocks without explanations, uncollapse all with explanations
          setCollapsedBlocks(new Set());
          segments.forEach(segment => {
            if (!segment.deep_dive_explanation) {
              onDeepDive(segment.blockIndex);
            }
          });
          break;

        case 'C':
          e.preventDefault();
          // Collapse all: hide all deep dive sections
          const allBlockIndices = segments
            .filter(s => s.deep_dive_explanation)
            .map(s => s.blockIndex);
          setCollapsedBlocks(new Set(allBlockIndices));
          break;

        case '?':
          e.preventDefault();
          setShowHelp(prev => !prev);
          break;

        case 'Escape':
          if (showHelp) {
            e.preventDefault();
            setShowHelp(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSegments, currentBlockIndex, showHelp, onDeepDive]);

  const codeLines = useMemo(() => code.split('\n'), [code]);
  const language = getLanguage(fileName);
  const showInitialLoading = isLoading && (!explanation || explanation.blocks.length === 0);

   const customCodeStyle = {
      ...atomDark,
      'pre[class*="language-"]': {
          ...(atomDark['pre[class*="language-"]'] || {}),
          background: 'transparent',
          margin: 0,
          padding: '1em 0',
          whiteSpace: 'pre',
          overflowX: 'auto',
      },
      'code[class*="language-"]': {
          ...(atomDark['code[class*="language-"]'] || {}),
          fontFamily: "'Fira Code', monospace",
          fontSize: '14px',
          whiteSpace: 'pre',
      },
  } as { [key: string]: CSSProperties };

  const lineProps = (lineNumber: number): React.HTMLProps<HTMLElement> => {
      const meta = lineMetadata.get(lineNumber);
      const style: CSSProperties = { display: 'block', width: '100%', transition: 'background-color 0.2s' };
      const lineContent = codeLines[lineNumber - 1]?.trim();

      if (!meta) {
          if (lineContent !== '') {
            style.opacity = 0.5;
          }
          return { style };
      }

      const blockIndex = meta.blockIndex;
      const isHovered = hoveredIndex === blockIndex;

      if (isHovered) {
          style.backgroundColor = 'rgba(65, 72, 104, 0.5)'; // gray-700 with opacity
      }
      
      return {
          ref: (el) => { if (el) lineRefs.current[lineNumber] = el; },
          style,
          onMouseEnter: () => { setHoverSource('left'); setHoveredIndex(blockIndex); },
          onMouseLeave: () => { setHoverSource(null); setHoveredIndex(null); },
      };
  };

  const copyToClipboard = async (blockIndex: number, codeBlock: string, explanation: string) => {
    try {
      const markdown = `## Code Block\n\n\`\`\`\n${codeBlock}\n\`\`\`\n\n## Explanation\n\n${explanation}`;
      await navigator.clipboard.writeText(markdown);
      setCopiedIndex(blockIndex);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const exportAsMarkdown = () => {
    if (!explanation || explanation.blocks.length === 0) return;

    const markdown = [
      `# Code Explanation: ${fileName}`,
      '',
      `Generated on: ${new Date().toLocaleString()}`,
      '',
      '---',
      '',
      ...explanation.blocks.flatMap((block, index) => [
        `## Block ${index + 1}`,
        '',
        '### Code',
        '',
        '```' + language,
        block.code_block,
        '```',
        '',
        '### Explanation',
        '',
        block.explanation,
        '',
        ...(block.deep_dive_explanation ? [
          '### Deep Dive Analysis',
          '',
          block.deep_dive_explanation,
          ''
        ] : []),
        '---',
        ''
      ])
    ].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}-explanation-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-2 h-full font-mono">
      <div className="col-span-1 h-full overflow-auto bg-gray-900">
        <SyntaxHighlighter
            language={language}
            style={customCodeStyle}
            showLineNumbers
            wrapLines={true}
            lineProps={lineProps}
            PreTag="div"
        >
            {code}
        </SyntaxHighlighter>
      </div>
      
      <div ref={rightPaneRef} className="col-span-1 h-full overflow-y-auto bg-gray-800 border-l border-gray-700">
         <div className="p-6 space-y-2 font-sans">
            <div className="pb-4 mb-4 border-b border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-blue-light">Code Explanations</h2>
                    <p className="text-sm text-gray-500">Hover over code on the left or an explanation below.</p>
                  </div>
                  {explanation && explanation.blocks.length > 0 && (
                    <button
                      onClick={exportAsMarkdown}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors"
                      title="Export all explanations as Markdown"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      <span>Export MD</span>
                    </button>
                  )}
                </div>
                {explanation && explanation.blocks.length > 0 && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="w-4 h-4 text-gray-500" />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search explanations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-accent"
                    />
                    {searchQuery && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <span className="text-xs text-gray-500">
                          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </div>
            
            {showInitialLoading && (
                 <div className="col-span-1 h-full flex flex-col items-center justify-center text-gray-500">
                    <SpinnerIcon className="w-12 h-12 text-blue-accent" />
                    <p className="mt-4 text-lg font-sans">Analyzing {fileName}...</p>
                    <p className="text-sm font-sans">Explanations will appear here as they're generated.</p>
                </div>
            )}

            {filteredSegments.map((segment, segmentIndex) => {
               const blockIndex = segment.blockIndex;
               const isDeepDiving = deepDiveStatus.isLoading && deepDiveStatus.blockIndex === blockIndex;
               const blockExplanation = segment.explanation || '';
               const isCurrentBlock = currentBlockIndex === segmentIndex;
               const isCollapsed = collapsedBlocks.has(blockIndex);

               return (
                 <div
                    key={`expl-${blockIndex}`}
                    ref={el => { if(typeof blockIndex === 'number') explanationRefs.current[blockIndex] = el; }}
                    onMouseEnter={() => { setHoverSource('right'); setHoveredIndex(blockIndex); }}
                    onMouseLeave={() => { setHoverSource(null); setHoveredIndex(null); }}
                    className={`group p-4 rounded-lg transition-all duration-300 border ${
                      isCurrentBlock
                        ? 'bg-gray-700/70 border-cyan-accent ring-2 ring-cyan-accent/30 shadow-lg shadow-cyan-accent/20'
                        : hoveredIndex === blockIndex
                          ? 'bg-gray-700/50 border-blue-accent/50'
                          : 'bg-transparent border-transparent'
                    }`}
                 >
                    <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light prose-p:mb-6 prose-headings:text-cyan-accent prose-strong:text-orange-accent prose-code:text-orange-accent prose-code:before:content-[''] prose-code:after:content-[''] prose-li:text-blue-light prose-li:my-3 prose-ul:my-6 prose-ol:my-6">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{blockExplanation.trim()}</ReactMarkdown>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        {segment.deep_dive_explanation && !isCollapsed ? (
                            <div className="mt-4 p-4 border-l-2 border-cyan-accent/50 bg-gray-900/30 rounded-r-lg w-full">
                                <h4 className="font-bold text-sm text-cyan-accent flex items-center mb-2">
                                    <SparklesIcon className="w-4 h-4 mr-2" />
                                    Deep Dive
                                </h4>
                                <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light/90 prose-p:mb-6 prose-strong:text-orange-accent prose-li:text-blue-light prose-li:my-3 prose-ul:my-6 prose-ol:my-6">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment.deep_dive_explanation}</ReactMarkdown>
                                    {isDeepDiving && <span className="inline-block w-2 h-4 bg-blue-light animate-pulse ml-1"></span>}
                                </div>
                            </div>
                        ) : (
                          blockExplanation.trim() && (
                            <button
                                onClick={() => {
                                  if (segment.deep_dive_explanation && isCollapsed) {
                                    setCollapsedBlocks(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(blockIndex);
                                      return newSet;
                                    });
                                  } else if (!segment.deep_dive_explanation) {
                                    onDeepDive(blockIndex);
                                  }
                                }}
                                disabled={deepDiveStatus.isLoading}
                                className="flex items-center space-x-2 text-sm text-cyan-accent hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed font-semibold py-1 px-2 rounded-md bg-gray-700/50 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all duration-300"
                            >
                                {isDeepDiving ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                <span>
                                  {isDeepDiving
                                    ? 'Analyzing...'
                                    : segment.deep_dive_explanation && isCollapsed
                                      ? 'Expand'
                                      : 'Deep Dive'}
                                </span>
                            </button>
                          )
                        )}
                        {blockExplanation.trim() && (
                          <button
                              onClick={() => copyToClipboard(blockIndex, segment.code_block, blockExplanation)}
                              className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white font-semibold py-1 px-2 rounded-md bg-gray-700/50 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all duration-300"
                          >
                              {copiedIndex === blockIndex ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                              <span>{copiedIndex === blockIndex ? 'Copied!' : 'Copy'}</span>
                          </button>
                        )}
                    </div>
                 </div>
               );
            })}
             {isLoading && !showInitialLoading && (
                <div ref={streamingIndicatorRef} className="flex items-center p-4 text-gray-500">
                    <SpinnerIcon className="w-5 h-5 mr-3" />
                    <span>Generating explanation...</span>
                </div>
            )}
            {!isLoading && explanation?.blocks.length === 0 && !showInitialLoading &&(
                 <div className="flex items-center justify-center h-full text-gray-600 p-8 text-center">
                    <p>No explanation available. The file might be empty, unsupported, or an error occurred.</p>
                </div>
            )}
         </div>

         {showHelp && (
           <div
             className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
             onClick={() => setShowHelp(false)}
           >
             <div
               className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md shadow-2xl"
               onClick={(e) => e.stopPropagation()}
             >
               <h3 className="text-lg font-bold text-cyan-accent mb-4">Keyboard Shortcuts</h3>
               <div className="space-y-3 text-sm">
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Navigate next block</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">n</kbd>
                   <span className="text-gray-500">or</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">→</kbd>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Navigate previous block</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">p</kbd>
                   <span className="text-gray-500">or</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">←</kbd>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Toggle deep dive</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">e</kbd>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Expand all deep dives</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">Shift+E</kbd>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Collapse all deep dives</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">Shift+C</kbd>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Show/hide this help</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">?</kbd>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-gray-400">Close help</span>
                   <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-gray-200 font-mono">Esc</kbd>
                 </div>
               </div>
               <div className="mt-4 pt-4 border-t border-gray-700">
                 <button
                   onClick={() => setShowHelp(false)}
                   className="w-full px-4 py-2 bg-cyan-accent hover:bg-cyan-accent/80 text-gray-900 font-semibold rounded transition-colors"
                 >
                   Close
                 </button>
               </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

export default CodeExplainerView;
