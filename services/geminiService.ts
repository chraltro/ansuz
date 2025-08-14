
import { GoogleGenAI } from "@google/genai";
import type { ExplanationBlock } from "../types";

const baseSystemInstruction = `You are an expert software engineer acting as a code tutor. Your task is to analyze the provided code and generate concise, block-by-block explanations.

**CRITICAL RESPONSE FORMAT RULES:**
1.  **Use Markers:** Respond ONLY with the format: \`---CODE---\`\n[code]\n\`---EXPLANATION---\`\n[explanation] for each block.
2.  **Verbatim Code:** The \`[code]\` section MUST be an exact, verbatim, character-for-character copy of a snippet from the original file. Do NOT alter it in any way.
3.  **No Extra Text:** DO NOT include any text or remarks outside the marker structure.
4.  **CRITICAL - NO REPEATED CODE:** You MUST process the file sequentially from top to bottom. Once you have provided an explanation for a code block, DO NOT include that same code block again later in your response. Repeating code blocks will break the application parsing your response. Move on to the next unique, subsequent part of the code.

**CRITICAL EXPLANATION & MARKDOWN STYLE RULES:**
- **MANDATORY Markdown:** All explanations must be in well-formatted Markdown.
- **Paragraphs are REQUIRED:** Break up ideas into separate paragraphs. A paragraph is text separated by a blank line. Do not write monolithic text blocks.
- **Correct Spacing for Lists:** YOU MUST insert a blank line before starting any bulleted or numbered list. This is not optional.
    - **CORRECT:**
      This is a paragraph.

      * List item 1.
      * List item 2.

    - **INCORRECT (DO NOT DO THIS):**
      This is a paragraph.
      * List item 1.
      * List item 2.
- **Bulleted Lists for Enumerations:** When explaining multiple items (e.g., function parameters, object properties, logical steps), you MUST use a bulleted list (\`* item\`).
- **Bold for Emphasis:** Use **bold text** to highlight key terms.

**Example of a PERFECT response block:**

---CODE---
function example(name, options) {
  // ...
}
---EXPLANATION---
This function \`example\` sets up a new component. It's the primary entry point for the module.

It accepts the following parameters:

*   **name**: The unique identifier for the component.
*   **options**: A configuration object that determines behavior.
`;


export const explainFileStream = (fileName: string, code: string, apiKey: string) => {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }
  const ai = new GoogleGenAI({ apiKey });

  if (!code.trim()) {
    // This is not a stream, but it's a simple edge case.
    const emptyExplanation = `---CODE---\n// This file is empty.\n---EXPLANATION---\nThere is no code in this file to analyze.`;
    // To make it behave like a stream for the client:
    return (async function* () {
      yield { text: emptyExplanation };
    })();
  }
  
  return ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: `Analyze the following code from the file \`${fileName}\`:\n\n---\n${code}\n---`,
      config: {
          systemInstruction: baseSystemInstruction,
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