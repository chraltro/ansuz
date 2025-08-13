
import React, { useRef, useState, useEffect } from 'react';
import type { FileNode } from '../types';

interface WelcomeScreenProps {
  onProjectReady: (files: FileNode, apiKey: string) => void;
  setIsLoading: (isLoading: boolean) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProjectReady, setIsLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');

  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  const handleUploadClick = (type: 'file' | 'folder') => {
    if (!apiKey.trim()) {
      setApiKeyError('Please enter your Gemini API Key to continue.');
      return;
    }
    localStorage.setItem('gemini_api_key', apiKey);
    setApiKeyError('');

    if (type === 'file') {
      fileInputRef.current?.click();
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    if (!apiKey.trim()) {
      setApiKeyError('Please enter your Gemini API Key to continue.');
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
        onProjectReady(root, apiKey);
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
        <h1 className="text-4xl font-bold text-blue-light mb-4">AI Code Explainer</h1>
        <p className="text-lg text-gray-500 mb-6">
          Upload your code to get a detailed, AI-powered breakdown. Select individual files or an entire project folder.
        </p>
        
        <div className="mb-6 max-w-md mx-auto">
          <label htmlFor="api-key-input" className="sr-only">Gemini API Key</label>
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (e.target.value) setApiKeyError('');
            }}
            placeholder="Enter your Gemini API Key"
            className={`w-full bg-gray-800 border-2 text-blue-light rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-accent transition-colors ${apiKeyError ? 'border-orange-accent/60' : 'border-gray-700'}`}
            aria-describedby="api-key-error"
          />
          {apiKeyError && <p id="api-key-error" className="text-orange-accent text-sm mt-2">{apiKeyError}</p>}
        </div>

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

         <p className="text-sm text-gray-600 mt-6">
            Your API key is stored in your browser's local storage and is never sent to our servers.
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
