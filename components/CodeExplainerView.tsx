
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
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

  // Scroll right pane when hovering left pane
  useEffect(() => {
    if (hoverSource === 'left' && hoveredIndex !== null && rightPaneRef.current) {
      explanationRefs.current[hoveredIndex]?.scrollIntoView(scrollOptions);
    }
  }, [hoveredIndex, hoverSource]);

  // Scroll left pane when hovering right pane
  useEffect(() => {
    if (hoverSource === 'right' && hoveredIndex !== null && leftPaneRef.current) {
        codeBlockRefs.current[hoveredIndex]?.scrollIntoView(scrollOptions);
    }
  }, [hoveredIndex, hoverSource]);

  // Auto-scroll to streaming indicator only if user is already at the bottom
  useEffect(() => {
    const pane = rightPaneRef.current;
    if (!pane) return;

    // A user is considered "at the bottom" if they are within 50px of it.
    const isScrolledToBottom = pane.scrollHeight - pane.clientHeight <= pane.scrollTop + 50;

    if (isLoading && isScrolledToBottom) {
        streamingIndicatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [explanation?.blocks.length, isLoading]);

  const language = getLanguage(fileName);

  const remainingCode = useMemo(() => {
    if (!explanation || explanation.blocks.length === 0) {
      return code;
    }
  
    let lastIndex = 0;
    for (const block of explanation.blocks) {
      const currentIndex = code.indexOf(block.code_block, lastIndex);
      if (currentIndex !== -1) {
        lastIndex = currentIndex + block.code_block.length;
      } else {
        console.warn("Could not find code block in source. View might be inaccurate.", { block: block.code_block });
        lastIndex += block.code_block.length;
      }
    }
    
    return code.substring(lastIndex);
  }, [code, explanation]);
  
  const showInitialLoading = isLoading && (!explanation || explanation.blocks.length === 0);

  return (
    <div className="grid grid-cols-2 h-full font-mono">
      {/* Left Pane: Code */}
      <div ref={leftPaneRef} className="col-span-1 h-full overflow-y-auto bg-gray-900">
        <div className="p-4">
          {explanation?.blocks.map((block, index) => (
            <div
              key={index}
              ref={el => { codeBlockRefs.current[index] = el; }}
              onMouseEnter={() => { setHoverSource('left'); setHoveredIndex(index); }}
              onMouseLeave={() => { setHoverSource(null); setHoveredIndex(null); }}
              className={`rounded-lg transition-colors duration-200 border border-transparent ${hoveredIndex === index ? 'bg-gray-800' : ''}`}
            >
              <SyntaxHighlighter language={language} style={customCodeStyle} PreTag="div">
                {block.code_block}
              </SyntaxHighlighter>
            </div>
          ))}
          {remainingCode && (
              <div className="opacity-40">
                 <SyntaxHighlighter language={language} style={customCodeStyle} PreTag="div">
                    {remainingCode}
                </SyntaxHighlighter>
              </div>
          )}
        </div>
      </div>
      
      {/* Right Pane: Explanation */}
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

            {explanation?.blocks.map((block, index) => {
               const isDeepDiving = deepDiveStatus.isLoading && deepDiveStatus.blockIndex === index;
               return (
                 <div
                    key={index}
                    ref={el => { explanationRefs.current[index] = el; }}
                    onMouseEnter={() => { setHoverSource('right'); setHoveredIndex(index); }}
                    onMouseLeave={() => { setHoverSource(null); setHoveredIndex(null); }}
                    className={`group p-4 rounded-lg transition-all duration-300 border ${hoveredIndex === index ? 'bg-gray-700/50 border-blue-accent/50' : 'bg-transparent border-transparent'}`}
                 >
                    <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light prose-p:mb-4 prose-headings:text-cyan-accent prose-strong:text-orange-accent prose-code:text-orange-accent prose-code:before:content-[''] prose-code:after:content-[''] prose-li:text-blue-light prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5">
                      <ReactMarkdown>{block.explanation.trim() || ''}</ReactMarkdown>
                      {isLoading && index === explanation.blocks.length - 1 && !block.explanation && <span className="inline-block w-2 h-4 bg-blue-light animate-pulse ml-1"></span>}
                    </div>
                    <div className="mt-3">
                        {block.deep_dive_explanation && (
                            <div className="mt-4 p-4 border-l-2 border-cyan-accent/50 bg-gray-900/30 rounded-r-lg">
                                <h4 className="font-bold text-sm text-cyan-accent flex items-center mb-2">
                                    <SparklesIcon className="w-4 h-4 mr-2" />
                                    Deep Dive
                                </h4>
                                <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light/90 prose-strong:text-orange-accent prose-li:text-blue-light prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5">
                                    <ReactMarkdown>{block.deep_dive_explanation}</ReactMarkdown>
                                    {isDeepDiving && <span className="inline-block w-2 h-4 bg-blue-light animate-pulse ml-1"></span>}
                                </div>
                            </div>
                        )}
                        {!block.deep_dive_explanation && (
                            <button
                                onClick={() => onDeepDive(index)}
                                disabled={deepDiveStatus.isLoading}
                                className="flex items-center space-x-2 text-sm text-cyan-accent hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed font-semibold py-1 px-2 rounded-md bg-gray-700/50 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all duration-300"
                            >
                                {isDeepDiving ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                <span>{isDeepDiving ? 'Analyzing...' : 'Deep Dive'}</span>
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
      </div>
    </div>
  );
};

export default CodeExplainerView;
