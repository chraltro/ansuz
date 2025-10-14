
import React, { useRef, useState } from 'react';
import type { FileNode } from '../types';

const FILE_LIMIT = 25;

interface WelcomeScreenProps {
  onProjectReady: (files: FileNode) => void;
  setIsLoading: (isLoading: boolean) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProjectReady, setIsLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pastedCode, setPastedCode] = useState('');
  const [fileName, setFileName] = useState('pasted-code');

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
    if (selectedFiles.length > FILE_LIMIT) {
      alert(`Error: Too many files selected (${selectedFiles.length}). This tool supports up to ${FILE_LIMIT} files at once. Please select fewer files or break your upload into smaller batches.`);
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

  const parseMultiFileContent = (content: string): FileNode[] => {
    // Check for Claude Code format first (------ filepath ------)
    // Must have exactly 6 dashes on each side and contain a file path (with . or /)
    const claudePattern = /^------\s+([^\s].*?[./][^\s]*.*?)\s+------\s*\n/gm;
    const claudeMatches = Array.from(content.matchAll(claudePattern));
    
    if (claudeMatches.length > 0) {
      // Claude Code format
      const files: FileNode[] = [];
      
      claudeMatches.forEach((match, index) => {
        const filepath = match[1].trim();
        const filename = filepath.split('/').pop() || filepath;
        const startIndex = match.index! + match[0].length;
        
        // Find the end of this file's content (start of next file or end of string)
        let endIndex = content.length;
        if (index < claudeMatches.length - 1) {
          endIndex = claudeMatches[index + 1].index!;
        }
        
        // Extract content and remove code block markers if present
        let fileContent = content.substring(startIndex, endIndex).trim();
        
        // Remove code block markers (`````` or ```)
        const sixTickMatch = fileContent.match(/^``````[\w]*\n?([\s\S]*?)\n?``````$/);
        const threeTickMatch = fileContent.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
        
        if (sixTickMatch) {
          fileContent = sixTickMatch[1];
        } else if (threeTickMatch) {
          fileContent = threeTickMatch[1];
        }
        
        files.push({
          name: filename,
          content: fileContent,
          children: [],
          path: filepath,
        });
      });
      
      return files;
    }
    
    // Check for legacy format (### `filename`)
    const legacyPattern = /^###\s*`([^`]+)`\s*\n/gm;
    const legacyMatches = Array.from(content.matchAll(legacyPattern));
    
    if (legacyMatches.length > 0) {
      // Legacy multi-file format
      const files: FileNode[] = [];

      legacyMatches.forEach((match, index) => {
        const filename = match[1];
        const startIndex = match.index! + match[0].length;
        
        // Find the end of this file's content (start of next file or end of string)
        let endIndex = content.length;
        if (index < legacyMatches.length - 1) {
          endIndex = legacyMatches[index + 1].index!;
        }
        
        // Extract content between code blocks (remove ```language and ``` markers)
        let fileContent = content.substring(startIndex, endIndex).trim();
        
        // Remove code block markers if present
        const codeBlockMatch = fileContent.match(/^```[\w]*\n([\s\S]*?)\n```$/);
        if (codeBlockMatch) {
          fileContent = codeBlockMatch[1];
        }
        
        files.push({
          name: filename,
          content: fileContent,
          children: [],
          path: filename,
        });
      });

      return files;
    }
    
    // Single file format
    const fileExtension = fileName.includes('.') ? fileName : `${fileName}.txt`;
    return [{
      name: fileExtension,
      content: content,
      children: [],
      path: fileExtension,
    }];
  };

  const handlePasteSubmit = () => {
    if (!pastedCode.trim()) return;
    
    setIsLoading(true);

    try {
      const parsedFiles = parseMultiFileContent(pastedCode);
      
      // Check if we exceed the 25-file limit
      if (parsedFiles.length > FILE_LIMIT) {
        alert(`Error: Too many files parsed (${parsedFiles.length}). This tool supports up to ${FILE_LIMIT} files at once. Please split your content into smaller batches.`);
        return;
      }
      
      const root: FileNode = {
        name: 'root',
        content: null,
        children: parsedFiles,
        path: ''
      };

      onProjectReady(root);
    } catch(error) {
      console.error("Error processing pasted code:", error);
      alert("Error parsing the pasted content. Please check the format and try again.");
    } finally {
      setIsLoading(false);
      // Reset paste area
      setPastedCode('');
      setFileName('pasted-code');
      setShowPasteArea(false);
    }
  };

  const handleShowPaste = () => {
    setShowPasteArea(true);
  };

  const handleCancelPaste = () => {
    setShowPasteArea(false);
    setPastedCode('');
    setFileName('pasted-code');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-2xl max-w-2xl w-full">
        <div className="flex items-center justify-center gap-4 mb-4">
          <img src="/logo.svg" alt="ANSUZ Logo" className="w-16 h-16" />
          <h1 className="text-4xl font-bold text-cyan-accent">ANSUZ</h1>
        </div>
        <p className="text-lg text-gray-500 mb-8">
          Code Decoded by AI - Upload your code to reveal its wisdom through the power of Ansuz
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

        {!showPasteArea ? (
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
              <span className="text-gray-600 font-medium">OR</span>
              <button
                onClick={handleShowPaste}
                className="w-full sm:w-auto bg-orange-accent hover:bg-opacity-80 text-gray-900 font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-orange-accent/20"
              >
                Paste Code
              </button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <div className="text-left">
              <label htmlFor="filename" className="block text-sm font-medium text-gray-300 mb-2">
                Filename (for single file only):
              </label>
              <input
                id="filename"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g., main.py, app.js, config.yml"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-accent"
              />
            </div>
            
            <div className="text-left">
              <label htmlFor="code-paste" className="block text-sm font-medium text-gray-300 mb-2">
                Paste your code here:
              </label>
              <div className="mb-2 text-xs text-gray-400">
                <strong>Single file:</strong> Just paste your code<br/>
                <strong>Multiple files:</strong> Use Claude Code format: <code className="bg-gray-700 px-1 rounded">------ filepath ------</code> followed by code block<br/>
                <strong>Legacy:</strong> Also supports <code className="bg-gray-700 px-1 rounded">### `filename.ext`</code> format
              </div>
              <textarea
                id="code-paste"
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder={`Single file: Just paste your code here...

Multiple files (Claude Code format):
------ .claude/file.json ------
\`\`\`\`\`\`
{
  "permissions": {
    "allow": ["Bash(npm install)"]
  }
}
\`\`\`\`\`\`

------ components/Button.tsx ------
\`\`\`\`\`\`
export const Button = () => {
  return <button>Click me</button>;
};
\`\`\`\`\`\`

Legacy format also supported:
### \`main.js\`
\`\`\`javascript
console.log('Hello');
\`\`\``}
                rows={16}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-accent font-mono text-sm resize-vertical"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handlePasteSubmit}
                disabled={!pastedCode.trim()}
                className="px-6 py-3 bg-blue-accent hover:bg-opacity-80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-300 shadow-lg shadow-blue-accent/20"
              >
                Analyze Code
              </button>
              <button
                onClick={handleCancelPaste}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;