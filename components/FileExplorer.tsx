
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FileNode, HistoryEntry } from '../types';
import FileIcon from './icons/FileIcon';
import FolderIcon from './icons/FolderIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import CheckIcon from './icons/CheckIcon';
import type { SummaryStatus } from '../App';

export type ProcessingStatus = 'idle' | 'processing' | 'done';

interface FileExplorerProps {
  node: FileNode;
  selectedFile: FileNode | null;
  onSelectFile: (file: FileNode) => void;
  onProcessAll: () => void;
  processingStatus: Map<string, ProcessingStatus>;
  isProcessingQueueActive: boolean;
  processingQueueLength: number;
  remainingFilesToProcess: number;
  fileSummaries: Map<string, string>;
  summaryStatus: Map<string, SummaryStatus>;
  projectSummary: string;
  isProjectSummaryLoading: boolean;
  onLogout?: () => void;
  history: HistoryEntry[];
  activeHistoryId: string | null;
  onSelectHistory: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

interface FileExplorerContentProps {
  node: FileNode;
  selectedFile: FileNode | null;
  onSelectFile: (file: FileNode) => void;
  processingStatus: Map<string, ProcessingStatus>;
  fileSummaries: Map<string, string>;
  summaryStatus: Map<string, SummaryStatus>;
  depth?: number;
  history?: HistoryEntry[];
  activeHistoryId?: string | null;
  onSelectHistory?: (entry: HistoryEntry) => void;
}


const FileExplorerContent: React.FC<FileExplorerContentProps> = ({ node, selectedFile, onSelectFile, processingStatus, fileSummaries, summaryStatus, depth = 0, history, activeHistoryId, onSelectHistory }) => {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const isDirectory = node.children && node.children.length > 0;

    const handleToggle = () => {
        if (isDirectory) {
            setIsOpen(!isOpen);
        } else {
            onSelectFile(node);
        }
    };

    if (isDirectory) {
        const sortedChildren = [...node.children].sort((a, b) => {
            const aIsDir = a.children.length > 0;
            const bIsDir = b.children.length > 0;
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.name.localeCompare(b.name);
        });

        return (
            <div style={{ paddingLeft: depth > 0 ? '0.5rem' : '0' }}>
                <div
                    onClick={handleToggle}
                    className="flex items-center space-x-2 p-1.5 rounded-md cursor-pointer hover:bg-gray-700/50"
                >
                    <FolderIcon className="w-5 h-5 text-blue-accent flex-shrink-0" />
                    <span className="font-medium text-blue-light truncate">{node.name}</span>
                </div>
                {isOpen && (
                    <div className="mt-1 border-l border-gray-700 ml-2.5">
                        {sortedChildren.map((child) => (
                            <FileExplorerContent
                                key={child.path}
                                node={child}
                                selectedFile={selectedFile}
                                onSelectFile={onSelectFile}
                                processingStatus={processingStatus}
                                fileSummaries={fileSummaries}
                                summaryStatus={summaryStatus}
                                depth={depth + 1}
                                history={history}
                                activeHistoryId={activeHistoryId}
                                onSelectHistory={onSelectHistory}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // It's a file
    const isSelected = selectedFile?.path === node.path;
    const explanationStatus = processingStatus.get(node.path) ?? 'idle';
    const summaryStatusVal = summaryStatus.get(node.path);
    const summary = fileSummaries.get(node.path);
    
    return (
        <div style={{ paddingLeft: depth > 0 ? '0.5rem' : '0' }}>
            <div
                onClick={handleToggle}
                className={`group relative flex items-center justify-between space-x-2 p-1.5 rounded-md cursor-pointer hover:bg-gray-700/50 transition-colors duration-200 ${isSelected ? 'bg-blue-accent/20 text-blue-light' : 'text-gray-500'}`}
            >
                <div className="flex items-center space-x-2 overflow-hidden">
                    <FileIcon className="w-5 h-5 text-cyan-accent flex-shrink-0" />
                    <span className="truncate">{node.name}</span>
                </div>
                
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    {explanationStatus === 'processing' && <SpinnerIcon className="w-4 h-4 text-blue-accent" />}
                    {explanationStatus === 'done' && <CheckIcon className="w-4 h-4 text-green-accent" />}
                    {explanationStatus === 'idle' && summaryStatusVal === 'summarizing' && <SpinnerIcon className="w-4 h-4 text-orange-accent" />}
                </div>

                {summaryStatusVal === 'done' && summary && (
                    <div className="absolute left-6 top-full mt-2 w-72 p-3 bg-gray-900 border border-gray-700 rounded-md shadow-lg text-sm invisible group-hover:visible z-50 transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                        <p className="text-blue-light/90 whitespace-pre-wrap">{summary}</p>
                    </div>
                )}
            </div>
        </div>
    )
}

const FileExplorer: React.FC<FileExplorerProps> = (props) => {
    const { node, selectedFile, onSelectFile, onProcessAll, processingStatus, isProcessingQueueActive, processingQueueLength, remainingFilesToProcess, fileSummaries, summaryStatus, projectSummary, isProjectSummaryLoading, onLogout, history, activeHistoryId, onSelectHistory, onClearHistory } = props;
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    
    const getButtonText = () => {
        if (remainingFilesToProcess === 0) {
            return 'All Files Analyzed';
        }
        
        // True queue processing means there are files actually in the processing queue
        const hasActiveQueue = processingQueueLength > 0;
        
        if (hasActiveQueue) {
            // Queue is active (multiple files being processed via queue)
            return `Processing... (${remainingFilesToProcess} left)`;
        }
        
        // Check if any single file is being processed (but no queue)
        const isSingleFileProcessing = Array.from(processingStatus.values()).some(s => s === 'processing');
        
        if (isSingleFileProcessing && remainingFilesToProcess > 1) {
            return `Queue ${remainingFilesToProcess} Remaining Files`;
        }
        
        if (remainingFilesToProcess === 1) {
            return isSingleFileProcessing ? 'Queue Last File' : 'Analyze Last File';
        }
        
        return `Analyze ${remainingFilesToProcess} Files`;
    };
    
    return (
        <div className="h-full flex flex-col bg-gray-800">
            <div className="p-3 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-blue-light">File Explorer</h2>
                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-md transition-colors duration-200 text-xs font-medium"
                        >
                            Logout
                        </button>
                    )}
                </div>
                 <div className="mt-2 mb-4 p-2 bg-gray-900/50 rounded-md min-h-[6rem]">
                    <h3 className="text-sm font-bold text-cyan-accent mb-1">Project Summary</h3>
                    {isProjectSummaryLoading && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <SpinnerIcon className="w-4 h-4" />
                            <span>Generating...</span>
                        </div>
                    )}
                    {!isProjectSummaryLoading && projectSummary && (
                         <div className="prose prose-invert max-w-none prose-sm prose-p:text-blue-light/90 prose-p:my-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{projectSummary}</ReactMarkdown>
                        </div>
                    )}
                     {!isProjectSummaryLoading && !projectSummary && (
                        <p className="text-sm text-gray-600">Upload files to generate a summary.</p>
                    )}
                </div>
                <button
                    onClick={onProcessAll}
                    disabled={remainingFilesToProcess === 0}
                    className={`w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm flex items-center justify-center space-x-2 ${
                        remainingFilesToProcess === 0 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-accent hover:bg-opacity-80 text-gray-900'
                    }`}
                >
                    {isProcessingQueueActive ? <SpinnerIcon className="w-4 h-4" /> : null}
                    <span>{getButtonText()}</span>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto p-2">
                 <FileExplorerContent
                    node={node}
                    selectedFile={selectedFile}
                    onSelectFile={onSelectFile}
                    processingStatus={processingStatus}
                    fileSummaries={fileSummaries}
                    summaryStatus={summaryStatus}
                    history={history}
                    activeHistoryId={activeHistoryId}
                    onSelectHistory={onSelectHistory}
                 />
            </div>

            {/* History Section */}
            <div className="border-t border-gray-700">
                <button
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                    <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-300">History</span>
                        <span className="text-xs text-gray-500">({history.length})</span>
                    </div>
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isHistoryExpanded && (
                    <div className="max-h-48 overflow-y-auto border-t border-gray-700">
                        {history.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                <p>No history yet</p>
                                <p className="text-xs mt-1">Analyzed projects will appear here</p>
                            </div>
                        ) : (
                            <>
                                {history.map((entry) => (
                                    <button
                                        key={entry.id}
                                        onClick={() => onSelectHistory(entry)}
                                        className={`w-full p-2 text-left hover:bg-gray-700/50 transition-colors border-b border-gray-700/50 ${
                                            activeHistoryId === entry.id ? 'bg-blue-accent/10 border-l-2 border-l-blue-accent' : ''
                                        }`}
                                    >
                                        <div className="text-sm font-medium text-gray-300 truncate">{entry.projectName}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {new Date(entry.timestamp).toLocaleDateString()} • {Object.keys(entry.explanationsCache || {}).length} files
                                        </div>
                                    </button>
                                ))}
                                <button
                                    onClick={() => {
                                        if (confirm('Clear all history? This cannot be undone.')) {
                                            onClearHistory();
                                        }
                                    }}
                                    className="w-full p-2 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700/50 transition-colors"
                                >
                                    Clear History
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default FileExplorer;