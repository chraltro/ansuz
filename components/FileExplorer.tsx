import React, { useState } from 'react';
import type { FileNode } from '../types';
import FileIcon from './icons/FileIcon';
import FolderIcon from './icons/FolderIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import CheckIcon from './icons/CheckIcon';

export type ProcessingStatus = 'idle' | 'processing' | 'done';

interface FileExplorerProps {
  node: FileNode;
  selectedFile: FileNode | null;
  onSelectFile: (file: FileNode) => void;
  onProcessAll: () => void;
  processingStatus: Map<string, ProcessingStatus>;
  isProcessingQueueActive: boolean;
}

interface FileExplorerContentProps {
  node: FileNode;
  selectedFile: FileNode | null;
  onSelectFile: (file: FileNode) => void;
  processingStatus: Map<string, ProcessingStatus>;
  depth?: number;
}


const FileExplorerContent: React.FC<FileExplorerContentProps> = ({ node, selectedFile, onSelectFile, processingStatus, depth = 0 }) => {
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
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // It's a file
    const isSelected = selectedFile?.path === node.path;
    const status = processingStatus.get(node.path);
    return (
        <div style={{ paddingLeft: depth > 0 ? '0.5rem' : '0' }}>
            <div
                onClick={handleToggle}
                className={`flex items-center justify-between space-x-2 p-1.5 rounded-md cursor-pointer hover:bg-gray-700/50 transition-colors duration-200 ${isSelected ? 'bg-blue-accent/20 text-blue-light' : 'text-gray-500'}`}
            >
                <div className="flex items-center space-x-2 overflow-hidden">
                    <FileIcon className="w-5 h-5 text-cyan-accent flex-shrink-0" />
                    <span className="truncate">{node.name}</span>
                </div>
                {status === 'processing' && <SpinnerIcon className="w-4 h-4 text-blue-accent" />}
                {status === 'done' && <CheckIcon className="w-4 h-4 text-green-accent" />}
            </div>
        </div>
    )
}

const FileExplorer: React.FC<FileExplorerProps> = ({ node, selectedFile, onSelectFile, onProcessAll, processingStatus, isProcessingQueueActive }) => {
    return (
        <div className="h-full flex flex-col bg-gray-800">
            <div className="p-3 border-b border-gray-700">
                <h2 className="text-lg font-bold mb-4 text-blue-light">File Explorer</h2>
                <button
                    onClick={onProcessAll}
                    disabled={isProcessingQueueActive}
                    className="w-full bg-green-accent disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-opacity-80 text-gray-900 font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm flex items-center justify-center space-x-2"
                >
                    {isProcessingQueueActive ? <SpinnerIcon className="w-4 h-4" /> : null}
                    <span>{isProcessingQueueActive ? 'Analyzing...' : 'Analyze All Files'}</span>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto p-2">
                 <FileExplorerContent node={node} selectedFile={selectedFile} onSelectFile={onSelectFile} processingStatus={processingStatus} />
            </div>
        </div>
    )
}

export default FileExplorer;
