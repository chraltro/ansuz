
import { GoogleGenAI, Type } from "@google/genai";
import type { Explanation, ExplanationBlock } from "../types";

// Constants
const MODEL_NAME = "gemini-2.5-flash";
const FILE_LIMIT = 25;

// Common utility functions
const validateApiKey = (apiKey: string) => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }
};

const createAI = (apiKey: string) => {
    validateApiKey(apiKey);
    return new GoogleGenAI({ apiKey });
};

const bulkSystemInstruction = `You are an expert software engineer acting as a code tutor. Your task is to analyze the provided code and generate concise, block-by-block explanations in a single JSON object.

**CRITICAL RESPONSE FORMAT RULES:**
1.  **JSON OBJECT ONLY:** You MUST respond with a single, valid JSON object and nothing else. Do not wrap it in markdown, and do not include any text or remarks outside of this JSON object.
2.  **JSON STRUCTURE:** The JSON object must have a single key "blocks". The value must be an array of objects. Each object in the array represents a sequential code block and its explanation, with the keys "code_block" and "explanation".
3.  **VERBATIM CODE:** The "code_block" value MUST be an exact, verbatim, character-for-character copy of a snippet from the original file.
4.  **SEQUENTIAL & NON-REPEATING:** You MUST process the file sequentially from top to bottom. Once you have provided an explanation for a code block, DO NOT include that same code block again.

**CRITICAL EXPLANATION & MARKDOWN STYLE RULES:**
- **MANDATORY Markdown:** All "explanation" values must be in well-formatted Markdown.
- **NO TABLES:** You MUST NOT use markdown tables. Use bulleted lists instead for tabular data.
- **Paragraphs are REQUIRED:** Break up ideas into separate paragraphs. A paragraph is text separated by a blank line.
- **Correct Spacing for Lists:** YOU MUST insert a blank line before starting any bulleted or numbered list.
- **Bulleted Lists for Enumerations:** When explaining multiple items (e.g., function parameters, object properties, logical steps), you MUST use a bulleted list (\`* item\`).
- **Bold for Emphasis:** Use **bold text** to highlight key terms.

**EXAMPLE OF A PERFECT JSON RESPONSE:**
{
  "blocks": [
    {
      "code_block": "function example(name, options) {\\n  // ...\\n}",
      "explanation": "This function \`example\` sets up a new component. It's the primary entry point for the module.\\n\\nIt accepts the following parameters:\\n\\n*   **name**: The unique identifier for the component.\\n*   **options**: A configuration object that determines behavior."
    }
  ]
}
`;

export const explainFileInBulk = (fileName: string, code: string, apiKey: string) => {
    const ai = createAI(apiKey);
  
    if (!code.trim()) {
      return Promise.resolve({ blocks: [{ code_block: "// This file is empty.", explanation: "There is no code in this file to analyze." }]});
    }
    
    console.log(`🤖 API Call: Streaming bulk explanation for file "${fileName}" (${code.length} characters)`);
    
    const streamingSystemInstruction = `You are an expert software engineer acting as a code tutor. Your task is to analyze the provided code and generate concise, block-by-block explanations.

**CRITICAL STREAMING FORMAT:**
You MUST respond by streaming explanations as individual JSON objects, one per line:
{"code_block": "exact verbatim code snippet", "explanation": "markdown explanation"}
{"code_block": "next exact verbatim code snippet", "explanation": "markdown explanation"}
...

**CRITICAL RESPONSE FORMAT RULES:**
1. **ONE JSON OBJECT PER LINE:** Each code block and explanation pair must be a separate JSON object on its own line.
2. **VERBATIM CODE:** The "code_block" value MUST be an exact, verbatim, character-for-character copy of a snippet from the original file.
3. **SEQUENTIAL & NON-REPEATING:** Process the file sequentially from top to bottom. Once you explain a code block, DO NOT include it again.

**EXPLANATION & MARKDOWN STYLE RULES:**
- **MANDATORY Markdown:** All "explanation" values must be in well-formatted Markdown.
- **NO TABLES:** You MUST NOT use markdown tables. Use bulleted lists instead.
- **Paragraphs are REQUIRED:** Break up ideas into separate paragraphs (blank lines).
- **Correct Spacing for Lists:** Insert a blank line before starting any bulleted or numbered list.
- **Bulleted Lists for Enumerations:** Use bulleted lists (\`* item\`) for multiple items.
- **Bold for Emphasis:** Use **bold text** to highlight key terms.

**EXAMPLE OUTPUT:**
{"code_block": "function example(name, options) {\\n  // ...\\n}", "explanation": "This function \`example\` sets up a new component.\\n\\nIt accepts the following parameters:\\n\\n*   **name**: The unique identifier\\n*   **options**: Configuration object"}
{"code_block": "const result = process(data);", "explanation": "This line processes the input data and stores the result.\\n\\n**Important:** The process function handles validation internally."}`;

    return ai.models.generateContentStream({
        model: MODEL_NAME,
        contents: `Analyze the following code from the file \`${fileName}\`:\n\n---\n${code}\n---`,
        config: {
            systemInstruction: streamingSystemInstruction,
            temperature: 0.2,
        }
    });
};


const deepDiveSystemInstruction = `You are a senior software engineer and code architect providing a detailed analysis.

The user has already seen this initial explanation:
"""
{original_explanation}
"""

Your task is to provide a "deep dive" analysis. Focus on the "why" and "how else."

**DEEP DIVE ANALYSIS POINTS:**
*   **Design Patterns:** Name any relevant patterns and explain their use here.
*   **Nuances & Trade-offs:** Discuss why this approach was chosen over alternatives (e.g., performance, readability).
*   **Best Practices & Improvements:** Does it follow modern best practices? Suggest specific improvements.
*   **Broader Context:** How might this code interact with a larger application?

**CRITICAL MARKDOWN FORMATTING RULES:**
- **MANDATORY Markdown:** Your entire response must be well-formatted Markdown.
- **Use Paragraphs:** Separate distinct ideas with blank lines to form paragraphs.
- **Correct List Spacing:** YOU MUST insert a blank line before starting any list. This is critical for readability.
    - **CORRECT:**
      Here are the trade-offs:

      * **Performance:** This is faster.
      * **Readability:** This is less clear.

    - **INCORRECT (DO NOT DO THIS):**
      Here are the trade-offs:
      * **Performance:** This is faster.
      * **Readability:** This is less clear.
- **Use Bullet Points:** You MUST use bulleted lists to enumerate points, alternatives, or improvements.
- **Use Bold:** Use **bold text** to emphasize key terms.
`;


export const explainSnippetStream = (block: ExplanationBlock, fileName:string, apiKey: string) => {
    const ai = createAI(apiKey);

    console.log(`🤖 API Call: Deep dive analysis for code block in "${fileName}" (${block.code_block.length} characters)`);
    return ai.models.generateContentStream({
        model: MODEL_NAME,
        contents: `Here is the code from \`${fileName}\` that needs a deep dive:\n\n\`\`\`\n${block.code_block}\n\`\`\``,
        config: {
            systemInstruction: deepDiveSystemInstruction.replace('{original_explanation}', block.explanation),
            temperature: 0.4,
        }
    });
};


export const generateAllSummariesStream = async function* (files: { path: string; name: string; content: string }[], apiKey: string): AsyncGenerator<{ type: 'file_summary', path: string, summary: string } | { type: 'project_summary', summary: string } | { type: 'error', message: string }> {
    if (files.length === 0) return;
    
    const ai = createAI(apiKey);
    const systemInstruction = `You are a code analysis expert. You will receive multiple files from a project and must provide individual file summaries followed by an overall project summary.

**CRITICAL STREAMING FORMAT:**
You MUST respond by streaming summaries in this exact order:
1. First, provide individual file summaries in JSON format: {"type": "file_summary", "path": "file_path", "summary": "2-3 sentence summary"}
2. After all file summaries, provide the project summary: {"type": "project_summary", "summary": "overall summary with paragraph breaks"}

**File Summary Rules:**
- Each file summary must be 2-3 sentences maximum
- Focus on the file's main purpose and role
- No markdown formatting
- Be concise but informative

**Project Summary Rules:**
- Maximum 3 sentences total
- Use 2-3 short paragraphs separated by blank lines
- Synthesize the overall project purpose from all files
- Focus on high-level architecture and goals

**Example Output Format:**
{"type": "file_summary", "path": "src/main.ts", "summary": "This is the main entry point that initializes the application. It sets up routing and starts the server."}
{"type": "file_summary", "path": "src/utils.ts", "summary": "Contains utility functions for data processing and validation. Provides helper methods used throughout the application."}
{"type": "project_summary", "summary": "This project is a web application backend built with TypeScript.\\n\\nIt provides REST API endpoints for data management and includes comprehensive utility functions.\\n\\nThe architecture follows modern Node.js patterns with clear separation of concerns."}

**IMPORTANT:** Output each JSON object on its own line. Do not wrap in markdown or add extra formatting.`;

    const filesContent = files.map(f => 
        `=== FILE: ${f.path} ===\n${f.content}\n\n`
    ).join('');
    
    console.log(`🤖 API Call: Streaming summaries for ${files.length} files (${filesContent.length} total characters)`);
    
    try {
        const stream = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: `Analyze these project files and provide streaming summaries:\n\n${filesContent}`,
            config: {
                systemInstruction,
                temperature: 0.2,
            }
        });

        let buffer = '';
        let fileSummariesProcessed = 0;
        let projectSummaryProcessed = false;
        
        for await (const chunk of stream) {
            if (chunk.text) {
                buffer += chunk.text;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the incomplete line in buffer
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && trimmedLine.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(trimmedLine);
                            if (parsed.type === 'file_summary' && parsed.path && parsed.summary) {
                                fileSummariesProcessed++;
                                yield { type: 'file_summary', path: parsed.path, summary: parsed.summary };
                            } else if (parsed.type === 'project_summary' && parsed.summary) {
                                projectSummaryProcessed = true;
                                yield { type: 'project_summary', summary: parsed.summary };
                            }
                        } catch (e) {
                            // Skip invalid JSON lines
                            console.warn('Skipping invalid JSON line:', trimmedLine);
                        }
                    }
                }
            }
        }

        // Process any remaining content in buffer
        if (buffer.trim() && buffer.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(buffer.trim());
                if (parsed.type === 'file_summary' && parsed.path && parsed.summary) {
                    fileSummariesProcessed++;
                    yield { type: 'file_summary', path: parsed.path, summary: parsed.summary };
                } else if (parsed.type === 'project_summary' && parsed.summary) {
                    projectSummaryProcessed = true;
                    yield { type: 'project_summary', summary: parsed.summary };
                }
            } catch (e) {
                console.warn('Skipping invalid JSON in buffer:', buffer.trim());
            }
        }
        
        console.log(`📊 Summary streaming completed: ${fileSummariesProcessed} file summaries, project summary: ${projectSummaryProcessed ? 'received' : 'MISSING'}`);
        
        // If we got file summaries but no project summary, signal completion anyway
        if (fileSummariesProcessed > 0 && !projectSummaryProcessed) {
            console.warn("⚠️ Project summary was not generated by streaming API");
        }

    } catch (error) {
        console.error("Stream processing failed:", error);
        yield { type: 'error', message: 'Failed to generate summaries due to streaming error.' };
    }
};


export const generateProjectSummary = async (fileSummaries: { path: string; summary: string }[], apiKey: string): Promise<string> => {
    if (fileSummaries.length === 0) return "";
    
    const ai = createAI(apiKey);
    const systemInstruction = `You are a project architect. You will be given a list of files and their individual summaries. Your task is to synthesize these into a single, high-level project summary.

**Formatting Rules:**
- The entire summary MUST be a maximum of 3 sentences total.
- You MUST use 2-3 short paragraphs for visual separation. A paragraph is text separated by a blank line.

**EXAMPLE OF PERFECT OUTPUT:**

This project orchestrates data pipelines within a Databricks environment.

It includes utilities for determining the runtime context and managing environment-specific configurations.

The primary goal is to ensure that data jobs run consistently across different stages like dev, test, and prod.`;

    const summariesText = fileSummaries.map(s => `File: ${s.path}\nSummary: ${s.summary}`).join('\n\n');
    
    console.log(`🤖 API Call: Generating project summary from ${fileSummaries.length} file summaries`);
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Here are the file summaries for a project:\n\n${summariesText}\n\nBased on these, what is the overall purpose of this project?`,
        config: {
            systemInstruction,
            temperature: 0.3,
        }
    });
    return response.text;
}
