
import React, { useState } from 'react';

interface ApiKeyScreenProps {
  onApiKeySubmit: (apiKey: string) => void;
  showLogout?: boolean;
  onLogout?: () => void;
}

const ApiKeyScreen: React.FC<ApiKeyScreenProps> = ({ onApiKeySubmit, showLogout = false, onLogout }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      onApiKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      {showLogout && onLogout && (
        <div className="absolute top-4 right-4">
          <button
            onClick={onLogout}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
          >
            Logout
          </button>
        </div>
      )}
      <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-2xl max-w-2xl w-full">
        <div className="flex items-center justify-center gap-4 mb-4">
          <img src="/logo.svg" alt="ANSUZ Logo" className="w-16 h-16" />
          <h1 className="text-4xl font-bold text-cyan-accent">ANSUZ</h1>
        </div>
        <p className="text-lg text-gray-500 mb-8">
          Code Decoded by AI - Enter your Gemini API Key to unlock the wisdom of Ansuz
        </p>
        
        <form onSubmit={handleSubmit} className="max-w-md mx-auto">
          <label htmlFor="api-key-input" className="sr-only">Gemini API Key</label>
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API Key"
            className="w-full bg-gray-800 border-2 text-blue-light rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-accent transition-colors border-gray-700 mb-4"
            autoFocus
          />
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="w-full bg-blue-accent hover:bg-opacity-80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-blue-accent/20"
          >
            Continue
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-6">
            Your API key is stored securely in your browser's local storage.
            You can get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-accent hover:underline">Google AI Studio</a>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyScreen;