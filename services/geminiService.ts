
import { GoogleGenAI, Type } from "@google/genai";
import type { Explanation, ExplanationBlock } from "../types";

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

export const explainFileInBulk = async (fileName: string, code: string, apiKey: string): Promise<Explanation> => {
    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }
    const ai = new GoogleGenAI({ apiKey });
  
    if (!code.trim()) {
      return { blocks: [{ code_block: "// This file is empty.", explanation: "There is no code in this file to analyze." }]};
    }
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Analyze the following code from the file \`${fileName}\`:\n\n---\n${code}\n---`,
        config: {
            systemInstruction: bulkSystemInstruction,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    blocks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                code_block: { type: Type.STRING },
                                explanation: { type: Type.STRING }
                            },
                            required: ["code_block", "explanation"]
                        }
                    }
                },
                required: ["blocks"]
            }
        }
    });

    const jsonText = response.text;
    try {
        const parsed = JSON.parse(jsonText);
        if (parsed && Array.isArray(parsed.blocks)) {
            return parsed as Explanation;
        } else {
            console.error("Invalid JSON structure received from API:", jsonText);
            throw new Error("Invalid JSON structure received from API.");
        }
    } catch (e) {
        console.error("Failed to parse JSON response:", jsonText, e);
        throw new Error("Failed to parse explanation from API response.");
    }
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
    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }
    const ai = new GoogleGenAI({ apiKey });

    return ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: `Here is the code from \`${fileName}\` that needs a deep dive:\n\n\`\`\`\n${block.code_block}\n\`\`\``,
        config: {
            systemInstruction: deepDiveSystemInstruction.replace('{original_explanation}', block.explanation),
            temperature: 0.4,
        }
    });
};

export const generateFileSummary = async (fileName: string, code: string, apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("Gemini API key is not configured.");
    if (!code.trim()) return "This file is empty.";

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are a helpful code assistant. Your task is to provide a very short, 2-3 sentence summary of the given code file's purpose. Focus on its main role and functionality. Do not talk about specific implementation details unless they are core to the file's identity. Do not use markdown.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Summarize this file named \`${fileName}\`:\n\n---\n${code}\n---`,
        config: {
            systemInstruction,
            temperature: 0.1,
        }
    });
    return response.text;
}

export const generateProjectSummary = async (fileSummaries: { path: string; summary: string }[], apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("Gemini API key is not configured.");
    if (fileSummaries.length === 0) return "";

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are a project architect. You will be given a list of files and their individual summaries. Your task is to synthesize these into a single, high-level project summary.

**Formatting Rules:**
- The entire summary MUST be a maximum of 3 sentences total.
- You MUST use 2-3 short paragraphs for visual separation. A paragraph is text separated by a blank line.

**EXAMPLE OF PERFECT OUTPUT:**

This project orchestrates data pipelines within a Databricks environment.

It includes utilities for determining the runtime context and managing environment-specific configurations.

The primary goal is to ensure that data jobs run consistently across different stages like dev, test, and prod.`;

    const summariesText = fileSummaries.map(s => `File: ${s.path}\nSummary: ${s.summary}`).join('\n\n');
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Here are the file summaries for a project:\n\n${summariesText}\n\nBased on these, what is the overall purpose of this project?`,
        config: {
            systemInstruction,
            temperature: 0.3,
        }
    });
    return response.text;
}
