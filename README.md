# Ansuz - Code Explainer

A code analysis tool that generates explanations for source files using the Gemini API. Named after the Norse rune of knowledge and communication.

Live at [chraltro.github.io/ansuz](https://chraltro.github.io/ansuz).

## Features

- Block-by-block explanations, streamed as they are generated
- Three explanation levels (beginner, intermediate, expert), cached per file so you can switch between them
- Deep dive on any block for design patterns, trade-offs, and alternatives
- Upload single files or whole folders, with a file tree and per-file summaries on hover
- Project summary generated from the individual file summaries
- Batch processing of every file in the tree, with progress in the explorer
- History of past sessions, stored in localStorage and optionally synced to a private GitHub Gist
- Sign in with Google (Firebase) to store your API keys, or enter them manually per browser
- Syntax highlighting via Prism
- Repeated code blocks are hashed and explained once, then reused

## Sign-in

The deployed app opens on a login screen. Two ways past it:

- **Sign in with Google.** Keys are encrypted and stored in Firestore against your account, so they follow you between browsers.
- **Enter keys manually.** Click through to manual entry and paste a Gemini key (and optionally a GitHub token). Keys go to localStorage for that browser only. No Firebase account needed.

Either way you supply your own Gemini key. There is no shared or bundled key.

The GitHub token is optional and only used to sync history to a Gist. Without it, history stays in localStorage.

## Prerequisites

- Node.js 20+ (the deploy workflow builds on 20)
- A [Gemini API key](https://aistudio.google.com/app/apikey)

## Local development

```bash
git clone https://github.com/chraltro/ansuz.git
cd ansuz
npm install
npm run dev
```

Open http://localhost:5173 and enter your key through the login screen.

To skip the login screen during local development, put your key in `.env.local`:

```bash
echo "GEMINI_API_KEY=your_key_here" > .env.local
```

The variable is `GEMINI_API_KEY`, not `VITE_GEMINI_API_KEY`. `vite.config.ts` maps it to `process.env.API_KEY` explicitly. This shortcut only applies to dev builds; production always goes through the login screen.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build to dist/
npm run preview    # serve the built output
npm run typecheck  # tsc --noEmit
```

## Tech stack

- React 19, TypeScript, Vite
- Gemini 2.5 Flash (`@google/genai`)
- Firebase auth + Firestore for key storage
- react-syntax-highlighter (Prism), react-markdown

Tailwind is loaded from the CDN script in `index.html` and configured inline there, rather than being a build dependency. It works, but it means no tree-shaking and no plugin ecosystem. Moving it into the build is a worthwhile cleanup that nobody has done yet.

## Project structure

```
ansuz/
├── App.tsx                     # root component, cache and queue logic
├── types.ts                    # shared types
├── index.html                  # entry, Tailwind CDN config, theme vars
├── src/
│   └── main.tsx                # React entry point
├── components/
│   ├── CodeExplainerView.tsx   # explanation display
│   ├── FileExplorer.tsx        # file tree, history, summaries
│   ├── WelcomeScreen.tsx       # upload interface
│   ├── LoginScreen.tsx         # Google sign-in and manual key entry
│   ├── ErrorBoundary.tsx
│   └── icons/
├── services/
│   ├── geminiService.ts        # Gemini calls and streaming
│   └── gistService.ts          # history persistence
├── lib/
│   ├── firebase-auth.js        # sign-in, key storage
│   ├── firebase-config.js      # public web config
│   └── crypto.js               # key encryption before Firestore
├── utils/
│   ├── analytics.ts
│   ├── fileValidation.ts       # size and type limits on upload
│   └── paths.ts                # asset paths across dev and Pages base
└── public/                     # theme.css, logos
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which typechecks, builds, and publishes `dist/` to GitHub Pages. Nothing built is committed to the repo.

The production base path is `/ansuz/`, set in `vite.config.ts`. If you fork this under a different repo name, change it there.

## License

MIT
