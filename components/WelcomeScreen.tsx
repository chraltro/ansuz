
import React, { useRef, useState } from 'react';
import type { FileNode } from '../types';

interface WelcomeScreenProps {
  onProjectReady: (files: FileNode, apiKey: string) => void;
  setIsLoading: (isLoading: boolean) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProjectReady, setIsLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');

  const handleButtonClick = () => {
    if (!apiKey.trim()) {
      setApiKeyError('Please enter your Gemini API Key to continue.');
      return;
    }
    fileInputRef.current?.click();
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
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-2xl max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-blue-light mb-4">AI Code Explainer</h1>
        <p className="text-lg text-gray-500 mb-6">
          Upload your code file(s) to get a detailed, AI-powered breakdown. Understand the 'what' and the 'why' behind every line.
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
        <button
          onClick={handleButtonClick}
          className="bg-blue-accent hover:bg-opacity-80 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-blue-accent/20"
        >
          Select File(s)
        </button>

         <p className="text-sm text-gray-600 mt-6">
            All processing happens in your browser and through the Gemini API. Your code and API key are not stored on our servers.
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;