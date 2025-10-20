import React, { useState, useEffect } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';
import { getAssetPath } from '../utils/paths';

interface LoginScreenProps {
  onSuccess: (geminiKey: string, githubToken?: string) => void;
  onError: (error: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualApiKey, setManualApiKey] = useState('');
  const [manualGithubToken, setManualGithubToken] = useState('');

  useEffect(() => {
    // Load Firebase
    const loadFirebase = async () => {
      try {
        const { initFirebase } = await import('../../shared/firebase-auth.js');
        await initFirebase();
      } catch (err) {
        console.error('Failed to load Firebase:', err);
        onError('Failed to initialize. Please try manual entry.');
        setShowManualEntry(true);
      }
    };
    loadFirebase();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setStatus('Signing in with Google...');

    try {
      const { signInWithGoogle, retrieveKeys } = await import('../../shared/firebase-auth.js');
      await signInWithGoogle();
      setStatus('Checking for saved keys...');

      // Try to retrieve saved keys
      const keys = await retrieveKeys();

      if (keys && keys.geminiKey) {
        setStatus('Keys found! Signing you in...');
        setTimeout(() => {
          onSuccess(keys.geminiKey, keys.githubToken || undefined);
        }, 500);
      } else {
        // First time - need to enter keys
        setStatus('Welcome! Please enter your API keys to get started.');
        setShowManualEntry(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setIsLoading(false);
      setStatus('');
      onError(err.message || 'Sign-in failed');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualApiKey.trim()) {
      onError('Please enter a valid Gemini API key');
      return;
    }

    setIsLoading(true);
    setStatus('Saving keys...');

    try {
      const { getCurrentUser, saveKeys } = await import('../../shared/firebase-auth.js');
      const user = getCurrentUser();

      if (user) {
        // Save to Firebase
        await saveKeys({
          geminiKey: manualApiKey.trim(),
          githubToken: manualGithubToken.trim() || null
        });
        setStatus('Keys saved and synced!');
      } else {
        // Fallback to localStorage
        localStorage.setItem('gemini_api_key', manualApiKey.trim());
        if (manualGithubToken.trim()) {
          localStorage.setItem('github_token', manualGithubToken.trim());
        }
      }

      setTimeout(() => {
        onSuccess(manualApiKey.trim(), manualGithubToken.trim() || undefined);
      }, 500);
    } catch (err: any) {
      console.error('Save error:', err);
      // Save to localStorage as fallback
      localStorage.setItem('gemini_api_key', manualApiKey.trim());
      if (manualGithubToken.trim()) {
        localStorage.setItem('github_token', manualGithubToken.trim());
      }
      onSuccess(manualApiKey.trim(), manualGithubToken.trim() || undefined);
    }
  };

  const skipToManual = () => {
    setShowManualEntry(true);
    setIsLoading(false);
    setStatus('');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 px-4">
      <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-2xl max-w-2xl w-full">
        <div className="flex items-center justify-center gap-4 mb-4">
          <img src={getAssetPath('logo.svg')} alt="Ansuz Logo" className="w-16 h-16" />
          <h1 className="text-4xl font-bold text-cyan-accent">Ansuz</h1>
        </div>
        <p className="text-lg text-gray-500 mb-8">
          Code Decoded by AI - Sign in to sync your API keys across devices
        </p>

        {!showManualEntry && !isLoading && (
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              className="w-full max-w-md mx-auto bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <button
              onClick={skipToManual}
              className="text-gray-500 hover:text-cyan-accent text-sm transition-colors"
            >
              Or enter keys manually (no sync)
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <SpinnerIcon className="w-12 h-12 text-cyan-accent animate-spin" />
            <p className="text-gray-400">{status}</p>
          </div>
        )}

        {showManualEntry && !isLoading && (
          <form onSubmit={handleManualSubmit} className="max-w-md mx-auto space-y-4">
            <p className="text-sm text-gray-400 mb-4">{status || 'Enter your API keys'}</p>

            <input
              type="password"
              value={manualApiKey}
              onChange={(e) => setManualApiKey(e.target.value)}
              placeholder="Gemini API Key (required)"
              className="w-full bg-gray-800 border-2 text-blue-light rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-accent transition-colors border-gray-700"
              autoFocus
            />

            <input
              type="password"
              value={manualGithubToken}
              onChange={(e) => setManualGithubToken(e.target.value)}
              placeholder="GitHub Token (optional)"
              className="w-full bg-gray-800 border-2 text-blue-light rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-accent transition-colors border-gray-700"
            />

            <button
              type="submit"
              disabled={!manualApiKey.trim()}
              className="w-full bg-blue-accent hover:bg-opacity-80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-blue-accent/20"
            >
              Continue
            </button>
          </form>
        )}

        <div className="text-sm text-gray-600 mt-6 space-y-1">
          <p>
            Get a Gemini API key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-accent hover:underline"
            >
              Google AI Studio
            </a>
          </p>
          {manualGithubToken && (
            <p className="text-xs">
              GitHub token is optional - only needed if you use GitHub features
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
