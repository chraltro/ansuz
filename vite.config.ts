import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: process.env.NODE_ENV === 'production' ? '/ai-code-explainer/' : '/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        external: [
          'react',
          'react-dom',
          'react-dom/client',
          '@google/genai',
          'react-syntax-highlighter',
          'react-syntax-highlighter/dist/esm/styles/prism',
          'react-markdown',
          'remark-gfm'
        ],
        output: {
          globals: {
            'react': 'React',
            'react-dom': 'ReactDOM',
            'react-dom/client': 'ReactDOM',
            '@google/genai': 'GoogleGenAI',
            'react-syntax-highlighter': 'ReactSyntaxHighlighter',
            'react-markdown': 'ReactMarkdown',
            'remark-gfm': 'remarkGfm'
          }
        }
      }
    }
  };
});