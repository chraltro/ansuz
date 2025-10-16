# Ansuz - Code Explainer

A code analysis tool that generates detailed explanations for source files using the Gemini API. Named after the Norse rune of knowledge and communication.

## Features

- Block-by-block code explanations with streaming responses
- Deep dive mode for architectural analysis and design patterns
- Multi-file project support with tree navigation
- File hover previews showing brief summaries
- Syntax highlighting for multiple languages
- Batch processing with progress tracking
- Client-side caching to avoid duplicate API calls

## Live Demo

[chraltro.github.io/ansuz](https://chraltro.github.io/ansuz)

## How It Works

1. Upload code files (single files or entire project folders)
2. Select a file from the explorer to trigger analysis
3. View synchronized code blocks with explanations
4. Click "Deep Dive" on any block for advanced analysis covering design patterns, trade-offs, and best practices

All explanations stream in real-time, with duplicate code blocks automatically detected and cached to reduce API usage.

## Prerequisites

- Node.js 18+
- [Google Gemini API key](https://aistudio.google.com/app/apikey)

## Local Development

```bash
git clone https://github.com/chraltro/ansuz.git
cd ansuz
npm install

# Add your API key to .env.local
echo "VITE_GEMINI_API_KEY=your_key_here" > .env.local

npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Tech Stack

- React 19 with TypeScript
- Vite build tool
- Tailwind CSS
- Gemini 2.5 Flash API
- React Syntax Highlighter (Prism)
- React Markdown

## Project Structure

```
ansuz/
├── components/
│   ├── CodeExplainerView.tsx    # Main explanation display
│   ├── FileExplorer.tsx          # File tree navigation
│   ├── WelcomeScreen.tsx         # Project upload interface
│   └── icons/                    # SVG icon components
├── services/
│   └── geminiService.ts          # API integration with streaming
├── types.ts                      # TypeScript definitions
└── App.tsx                       # Root component
```

## Supported Languages

JavaScript, TypeScript, Python, Java, HTML, CSS, JSON, Markdown, and most common programming languages supported by Prism.

## Deployment

```bash
npm run build
```

The build output in `dist/` can be deployed to any static hosting service.

## License

MIT
