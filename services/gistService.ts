/**
 * GitHub Gists Service for Ansuz
 * Handles saving and loading code analysis history to/from GitHub Gists
 */

import type { HistoryEntry, HistoryData } from '../types';

const GIST_FILENAME = 'ansuz-history.json';
const GIST_DESCRIPTION = 'Ansuz Code Analysis History (Private)';

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
  size?: number;
}

interface Gist {
  id: string;
  description: string;
  files: Record<string, GistFile>;
}

/**
 * Find the Ansuz history gist for this user
 */
async function findAnsuzGist(githubToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const gists: Gist[] = await response.json();
    const ansuzGist = gists.find(g =>
      g.description === GIST_DESCRIPTION && g.files[GIST_FILENAME]
    );

    return ansuzGist?.id || null;
  } catch (error) {
    console.error('Error finding Ansuz gist:', error);
    throw error;
  }
}

/**
 * Create a new gist for Ansuz history
 */
async function createAnsuzGist(githubToken: string, historyData: HistoryData): Promise<string> {
  try {
    const payload = {
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(historyData, null, 2)
        }
      }
    };

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create gist: ${response.status} - ${errorText}`);
    }

    const gist: Gist = await response.json();
    console.log('✓ Ansuz history gist created:', gist.id);
    return gist.id;
  } catch (error) {
    console.error('Error creating Ansuz gist:', error);
    throw error;
  }
}

/**
 * Update existing gist with new history data
 */
async function updateGist(githubToken: string, gistId: string, historyData: HistoryData): Promise<void> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(historyData, null, 2)
          }
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update gist: ${response.status}`);
    }

    console.log('✓ Ansuz history gist updated');
  } catch (error) {
    console.error('Error updating gist:', error);
    throw error;
  }
}

/**
 * Get file content from gist (handles truncated files)
 */
async function getFileContent(file: GistFile | undefined): Promise<string | null> {
  if (!file) return null;

  // If file is truncated, fetch from raw_url
  if (file.truncated && file.raw_url) {
    try {
      const response = await fetch(file.raw_url);
      if (response.ok) {
        return await response.text();
      }
    } catch (err) {
      console.error('Failed to fetch raw content:', err);
    }
  }

  // Use inline content if available
  if (file.content) return file.content;

  // Fallback to raw_url
  if (file.raw_url) {
    try {
      const response = await fetch(file.raw_url);
      if (response.ok) {
        return await response.text();
      }
    } catch (err) {
      console.error('Failed to fetch raw content:', err);
    }
  }

  return null;
}

/**
 * Load history from GitHub Gist
 */
export async function loadHistoryFromGist(githubToken: string): Promise<HistoryEntry[]> {
  if (!githubToken) {
    console.log('No GitHub token provided, skipping gist load');
    return [];
  }

  try {
    const gistId = await findAnsuzGist(githubToken);

    if (!gistId) {
      console.log('No Ansuz history gist found');
      return [];
    }

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load gist: ${response.status}`);
    }

    const gist: Gist = await response.json();
    const fileContent = await getFileContent(gist.files[GIST_FILENAME]);

    if (!fileContent) {
      console.log('No history data found in gist');
      return [];
    }

    const historyData: HistoryData = JSON.parse(fileContent);
    console.log(`✓ Loaded ${historyData.entries.length} history entries from gist`);
    return historyData.entries;
  } catch (error) {
    console.error('Error loading history from gist:', error);
    throw new Error('Failed to load history from GitHub. Please check your token and try again.');
  }
}

/**
 * Save history to GitHub Gist
 */
export async function saveHistoryToGist(githubToken: string, entries: HistoryEntry[]): Promise<void> {
  if (!githubToken) {
    console.log('No GitHub token provided, skipping gist save');
    return;
  }

  try {
    const historyData: HistoryData = { entries };
    const gistId = await findAnsuzGist(githubToken);

    if (gistId) {
      await updateGist(githubToken, gistId, historyData);
    } else {
      await createAnsuzGist(githubToken, historyData);
    }

    console.log(`✓ Saved ${entries.length} history entries to gist`);
  } catch (error) {
    console.error('Error saving history to gist:', error);
    throw new Error('Failed to save history to GitHub. Changes saved locally only.');
  }
}

/**
 * Save to localStorage as backup
 */
export function saveHistoryToLocalStorage(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem('ansuz_history', JSON.stringify({ entries }));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * Load from localStorage
 */
export function loadHistoryFromLocalStorage(): HistoryEntry[] {
  try {
    const data = localStorage.getItem('ansuz_history');
    if (!data) return [];

    const parsed: HistoryData = JSON.parse(data);
    return parsed.entries || [];
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return [];
  }
}

/**
 * Test GitHub token validity
 */
export async function testGitHubToken(githubToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
