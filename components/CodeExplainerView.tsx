
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Explanation } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import SparklesIcon from './icons/SparklesIcon';

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

const customCodeStyle = {
  ...atomDark,
  'pre[class*="language-"]': {
    ...atomDark['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: '1em',
    overflow: 'visible' as const,
    borderRadius: 0,
  },
  'code[class*="language-"]': {
    ...atomDark['code[class*="language-"]'],
    fontFamily: "'Fira Code', monospace",
    fontSize: '14px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
};

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
    default: return 'clike';
  }
};

interface CodeSegment {
    type: 'unexplained' | 'explained';
    content: string;
    explanation?: string;
    deep_dive_explanation?: string;
    blockIndex?: number;
}

const CodeExplainerView: React.FC<CodeExplainerViewProps> = ({ explanation, isLoading, fileName, code, onDeepDive, deepDiveStatus }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverSource, setHoverSource] = useState<'left' | 'right' | null>(null);
  
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const streamingIndicatorRef = useRef<HTMLDivElement>(null);

  const codeBlockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const explanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const blockCount = explanation?.blocks.length ?? 0;
    explanationRefs.current = explanationRefs.current.slice(0, blockCount);
    codeBlockRefs.current = codeBlockRefs.current.slice(0, blockCount);
  }, [explanation]);

  const scrollOptions: ScrollIntoViewOptions = {
    behavior: 'smooth',
    block: 'center',
  };

  const segments = useMemo((): CodeSegment[] => {
    if (!code) {
        return [];
    }
    if (!explanation || explanation.blocks.length === 0) {
        return [{ type: 'unexplained', content: code }];
    }

    const newSegments: CodeSegment[] = [];
    let lastIndex = 0;

    /**
     * Finds a block of code from the AI within the source code, tolerating whitespace differences.
     * @param source The full source code.
     * @param blockFromAI The potentially altered code block from the AI.
     * @param startIndex The index in the source to start searching from.
     * @returns An object with the found index and the verbatim content from the source, or null if not found.
     */
    const findBlock = (source: string, blockFromAI: string, startIndex: number): { index: number; content: string } | null => {
        if (!blockFromAI.trim()) return null;

        // Attempt 1: Exact match first, as it's fastest and most reliable.
        let index = source.indexOf(blockFromAI, startIndex);
        if (index !== -1) {
            return { index, content: blockFromAI };
        }

        // Attempt 2: Regex match to tolerate missing empty lines and whitespace changes.
        // This is more robust against AI formatting changes.
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Get non-empty, trimmed lines from the AI's version of the block.
        const aiLines = blockFromAI.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (aiLines.length === 0) return null;

        // Create a regex pattern that looks for these lines in order, separated by any amount of whitespace.
        const pattern = aiLines.map(escapeRegex).join('\\s+');
        const regex = new RegExp(pattern);

        const sourceToSearch = source.substring(startIndex);
        const match = sourceToSearch.match(regex);
        
        if (match && typeof match.index !== 'undefined') {
            return {
                index: startIndex + match.index,
                content: match[0], // This is the crucial part: we return the verbatim content from the source.
            };
        }

        return null;
    };

    explanation.blocks.forEach((block, blockIndex) => {
        const blockContentFromAI = block.code_block;
        if (!blockContentFromAI) return;

        const match = findBlock(code, blockContentFromAI, lastIndex);
        
        if (!match) {
            console.warn("Could not find code block in source. View might be inaccurate.", { block: blockContentFromAI });
            // Don't add this block and continue with the next one.
            // The un-matched code will be rendered as 'unexplained'.
            return;
        }

        const { index: currentIndex, content: verbatimContent } = match;

        // Add any code between the last match and this one as "unexplained".
        if (currentIndex > lastIndex) {
            newSegments.push({
                type: 'unexplained',
                content: code.substring(lastIndex, currentIndex),
            });
        }

        // Add the matched block as "explained".
        newSegments.push({
            type: 'explained',
            content: verbatimContent, // Use the verbatim content for rendering
            explanation: block.explanation,
            deep_dive_explanation: block.deep_dive_explanation,
            blockIndex: blockIndex,
        });

        // Update the starting point for the next search.
        lastIndex = currentIndex + verbatimContent.length;
    });

    // Add any remaining code at the end of the file as "unexplained".
    if (lastIndex < code.length) {
        newSegments.push({
            type: 'unexplained',
            content: code.substring(lastIndex),
        });
    }

    return newSegments;
  }, [code, explanation]);

  const explanationSegments = useMemo(() => segments.filter(s => s.type === 'explained'), [segments]);

  useEffect(() => {
    if (hoverSource === 'left' && hoveredIndex !== null && rightPaneRef.current) {
      explanationRefs.current[hoveredIndex]?.scrollIntoView(scrollOptions);
    }
  }, [hoveredIndex, hoverSource]);

  useEffect(() => {
    if (hoverSource === 'right' && hoveredIndex !== null && leftPaneRef.current) {
        codeBlockRefs.current[hoveredIndex]?.scrollIntoView(scrollOptions);
    }
  }, [hoveredIndex, hoverSource]);

  useEffect(() => {
    const pane = rightPaneRef.current;
    if (!pane) return;

    const isScrolledToBottom = pane.scrollHeight - pane.clientHeight <= pane.scrollTop + 50;

    if (isLoading && isScrolledToBottom) {
        streamingIndicatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [explanation?.blocks.length, isLoading, explanationSegments.length]);

  const language = getLanguage(fileName);
  
  const showInitialLoading = isLoading && (!explanation || explanation.blocks.length === 0);

  return (
    <div className="grid grid-cols-2 h-full font-mono">
      <div ref={leftPaneRef} className="col-span-1 h-full overflow-y-auto bg-gray-900">
        <div className="p-4">
          {segments.map((segment, index) => {
             if (segment.type === 'unexplained') {
                return (
                    <div key={`unexplained-${index}`} className="opacity-40">
                        <SyntaxHighlighter language={language} style={customCodeStyle} PreTag="div">
                            {segment.content}
                        </SyntaxHighlighter>
                    </div>
                );
            }
            // Explained block
            const blockIndex = segment.blockIndex!;
            return (
                <div
                    key={`explained-${blockIndex}`}
                    ref={el => { if(typeof blockIndex === 'number') codeBlockRefs.current[blockIndex] = el; }}
                    onMouseEnter={() => { setHoverSource('left'); setHoveredIndex(blockIndex); }}
                    onMouseLeave={() => { setHoverSource(null); setHoveredIndex(null); }}
                    className={`rounded-lg transition-colors duration-200 border border-transparent ${hoveredIndex === blockIndex ? 'bg-gray-800' : ''}`}
                >
                    <SyntaxHighlighter language={language} style={customCodeStyle} PreTag="div">
                        {segment.content}
                    </SyntaxHighlighter>
                </div>
            );
          })}
        </div>
      </div>
      
      <div ref={rightPaneRef} className="col-span-1 h-full overflow-y-auto bg-gray-800 border-l border-gray-700">
         <div className="p-6 space-y-2 font-sans">
            <div className="pb-4 mb-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-blue-light">Code Explanations</h2>
                <p className="text-sm text-gray-500">Hover over code on the left or an explanation below.</p>
            </div>
            
            {showInitialLoading && (
                 <div className="col-span-1 h-full flex flex-col items-center justify-center text-gray-500">
                    <SpinnerIcon className="w-12 h-12 text-blue-accent" />
                    <p className="mt-4 text-lg font-sans">Analyzing {fileName}...</p>
                    <p className="text-sm font-sans">Explanations will appear here as they're generated.</p>
                </div>
            )}

            {explanationSegments.map((segment, explainerIndex) => {
               const blockIndex = segment.blockIndex!;
               const isDeepDiving = deepDiveStatus.isLoading && deepDiveStatus.blockIndex === blockIndex;
               const blockExplanation = segment.explanation || '';
               const hasExplanationStreamed = isLoading && explanationSegments.length === (explanation?.blocks?.length || 0);

               return (
                 <div
                    key={`expl-${blockIndex}`}
                    ref={el => { if(typeof blockIndex === 'number') explanationRefs.current[blockIndex] = el; }}
                    onMouseEnter={() => { setHoverSource('right'); setHoveredIndex(blockIndex); }}
                    onMouseLeave={() => { setHoverSource(null); setHoveredIndex(null); }}
                    className={`group p-4 rounded-lg transition-all duration-300 border ${hoveredIndex === blockIndex ? 'bg-gray-700/50 border-blue-accent/50' : 'bg-transparent border-transparent'}`}
                 >
                    <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light prose-p:mb-4 prose-headings:text-cyan-accent prose-strong:text-orange-accent prose-code:text-orange-accent prose-code:before:content-[''] prose-code:after:content-[''] prose-li:text-blue-light prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{blockExplanation.trim()}</ReactMarkdown>
                      {hasExplanationStreamed && explainerIndex === explanationSegments.length - 1 && <span className="inline-block w-2 h-4 bg-blue-light animate-pulse ml-1"></span>}
                    </div>
                    <div className="mt-3">
                        {segment.deep_dive_explanation ? (
                            <div className="mt-4 p-4 border-l-2 border-cyan-accent/50 bg-gray-900/30 rounded-r-lg">
                                <h4 className="font-bold text-sm text-cyan-accent flex items-center mb-2">
                                    <SparklesIcon className="w-4 h-4 mr-2" />
                                    Deep Dive
                                </h4>
                                <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light/90 prose-strong:text-orange-accent prose-li:text-blue-light prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment.deep_dive_explanation}</ReactMarkdown>
                                    {isDeepDiving && <span className="inline-block w-2 h-4 bg-blue-light animate-pulse ml-1"></span>}
                                </div>
                            </div>
                        ) : (
                          blockExplanation.trim() && (
                            <button
                                onClick={() => onDeepDive(blockIndex)}
                                disabled={deepDiveStatus.isLoading}
                                className="flex items-center space-x-2 text-sm text-cyan-accent hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed font-semibold py-1 px-2 rounded-md bg-gray-700/50 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all duration-300"
                            >
                                {isDeepDiving ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                <span>{isDeepDiving ? 'Analyzing...' : 'Deep Dive'}</span>
                            </button>
                          )
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
      </div>
    </div>
  );
};

export default CodeExplainerView;
