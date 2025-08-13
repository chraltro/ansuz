# 🤖 AI Code Explainer

> Transform complex code into clear, understandable explanations with AI-powered analysis

## ✨ Features

- **🎯 Smart Code Analysis** - Upload any code file and get instant, block-by-block explanations
- **🔍 Deep Dive Mode** - Get advanced insights into design patterns, trade-offs, and best practices  
- **📁 Multi-file Support** - Analyze entire projects with the built-in file explorer
- **💫 Real-time Streaming** - Watch explanations generate in real-time as AI processes your code
- **🎨 Syntax Highlighting** - Beautiful code display with language-specific highlighting
- **🔒 Privacy First** - All processing happens locally and through Gemini API - no data stored on servers

## 🚀 Live Demo

Experience the app in action: **[ai-code-explainer.pages.dev](https://chraltro.github.io/ai-code-explainer)**

## 📸 Screenshots

![AI Code Explainer Interface](https://via.placeholder.com/800x400/1a1b26/a9b1d6?text=Add+Screenshot+Here)

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **AI:** Google Gemini 2.5 Flash API
- **Syntax Highlighting:** React Syntax Highlighter (Prism)
- **Markdown:** React Markdown
- **Build Tool:** Vite

## 🎯 How It Works

1. **Upload** your code files (single files or entire project folders)
2. **Analyze** - AI breaks down your code into logical blocks with explanations
3. **Explore** - Hover over code blocks to see synchronized explanations
4. **Deep Dive** - Click for advanced analysis of design patterns and trade-offs

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js 18+ 
- A [Google AI Studio API key](https://aistudio.google.com/app/apikey)

### Local Development

```bash
# Clone the repository
git clone https://github.com/chraltro/ai-code-explainer.git
cd ai-code-explainer

# Install dependencies
npm install

# Set up your environment
cp .env.local.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

### Getting Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env.local` file

## 📁 Project Structure

```
ai-code-explainer/
├── components/           # React components
│   ├── CodeExplainerView.tsx
│   ├── FileExplorer.tsx
│   ├── WelcomeScreen.tsx
│   └── icons/           # SVG icon components
├── services/            # API services
│   └── geminiService.ts # Gemini AI integration
├── types.ts            # TypeScript type definitions
├── App.tsx             # Main application component
└── index.tsx           # Application entry point
```

## 🎨 Features in Detail

### Smart Code Analysis
The AI analyzes your code and breaks it down into logical blocks, explaining:
- What each section does
- Why it's structured that way
- How different parts work together

### Deep Dive Mode
For advanced users, get insights into:
- **Design Patterns** - Identify architectural patterns in use
- **Trade-offs** - Understand why code was written a certain way
- **Best Practices** - Learn about potential improvements
- **Context** - How code fits into larger applications

### Multi-file Support
- Upload entire project folders
- Navigate through file explorer
- Batch analyze all files
- Visual processing status indicators

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Supported File Types

- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)  
- Python (.py)
- Java (.java)
- HTML (.html)
- CSS (.css)
- JSON (.json)
- Markdown (.md)

## 🚀 Deployment

### Deploy to GitHub Pages

This project is configured for easy GitHub Pages deployment:

```bash
# Build for production
npm run build

# Deploy to GitHub Pages (if using gh-pages)
npm run deploy
```

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use existing component patterns
- Add proper error handling
- Include JSDoc comments for complex functions
- Test thoroughly with different file types

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) for the powerful AI API
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) for beautiful code display
- [Tailwind CSS](https://tailwindcss.com/) for the styling system
- [Lucide React](https://lucide.dev/) for the icon set
