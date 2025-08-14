
import React, { useRef } from 'react';
import type { FileNode } from '../types';

interface WelcomeScreenProps {
  onProjectReady: (files: FileNode) => void;
  setIsLoading: (isLoading: boolean) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProjectReady, setIsLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = (type: 'file' | 'folder') => {
    if (type === 'file') {
      fileInputRef.current?.click();
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    // Check file limit
    if (selectedFiles.length > 25) {
      alert(`Error: Too many files selected (${selectedFiles.length}). This tool supports up to 25 files at once. Please select fewer files or break your upload into smaller batches.`);
      if(event.target) {
        event.target.value = '';
      }
      return;
    }
    
    setIsLoading(true);

    const root: FileNode = { name: 'root', content: null, children: [], path: '' };
    const filePromises: Promise<void>[] = [];

    for (const file of Array.from(selectedFiles)) {
        const path = (file as any).webkitRelativePath || file.name;
        const parts = path.split('/').filter(p => p);
        
        const filePromise = new Promise<void>((resolve, reject) => {
             const reader = new FileReader();
             reader.onload = (e) => {
                let currentNode = root;
                parts.forEach((part, index) => {
                    let childNode = currentNode.children.find(c => c.name === part);
                    if (!childNode) {
                        const isLastPart = index === parts.length - 1;
                        childNode = {
                            name: part,
                            content: isLastPart ? (e.target?.result as string) : null,
                            children: [],
                            path: parts.slice(0, index + 1).join('/'),
                        };
                        currentNode.children.push(childNode);
                    }
                    currentNode = childNode;
                });
                resolve();
             };
             reader.onerror = reject;
             reader.readAsText(file);
        });
        filePromises.push(filePromise);
    }

    try {
        await Promise.all(filePromises);
        onProjectReady(root);
    } catch(error) {
        console.error("Error reading files:", error);
        // Add user-facing error handling here
    } finally {
        setIsLoading(false);
        // Reset file input value to allow re-uploading the same file/folder
        if(event.target) {
            event.target.value = '';
        }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-2xl max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-blue-light mb-4">Ready to Analyze</h1>
        <p className="text-lg text-gray-500 mb-8">
          Upload your code to get a detailed, AI-powered breakdown. Select individual files or an entire project folder.
        </p>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFileChange}
          className="hidden"
          // @ts-ignore
          webkitdirectory=""
          directory=""
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleUploadClick('file')}
              className="w-full sm:w-auto bg-blue-accent hover:bg-opacity-80 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-blue-accent/20"
            >
              Select File(s)
            </button>
            <span className="text-gray-600 font-medium">OR</span>
            <button
              onClick={() => handleUploadClick('folder')}
              className="w-full sm:w-auto bg-cyan-accent hover:bg-opacity-80 text-gray-900 font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-cyan-accent/20"
            >
              Select Folder
            </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;