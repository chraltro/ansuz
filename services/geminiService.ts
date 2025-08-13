import { GoogleGenAI } from "@google/genai";
import type { ExplanationBlock } from "../types";

const baseSystemInstruction = `You are an expert software engineer acting as a code tutor. Your task is to analyze the provided code and generate concise, block-by-block explanations.

- Respond ONLY with the format: \`---CODE---\`\n[code]\n\`---EXPLANATION---\`\n[explanation] for each block.
- The [code] part must be the exact, verbatim code snippet.
- The [explanation] part should be a clear, concise explanation in Markdown.
- Use Markdown lists (* or -) for enumerating points for better readability.
- Group related lines into logical blocks. For imports, explain the purpose of the library/module.
- DO NOT include any other text, formatting, or introductory/closing remarks outside of this structure. The entire response must be a sequence of these blocks.`;


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


const deepDiveSystemInstruction = `You are a senior software engineer and code architect. A user wants a more detailed explanation of a code snippet.

The user has already seen this initial explanation:
"""
{original_explanation}
"""

Your task is to provide a "deep dive" analysis of the code. Go beyond the surface-level "what it does." Focus on:
- **Design Patterns:** Is it using a known design pattern?
- **Nuances & Trade-offs:** Why was it likely written this way versus an alternative? What are the performance or maintainability implications?
- **Best Practices:** Does it follow best practices? Are there potential improvements?
- **Broader Context:** How might this code interact with other parts of a larger application?

Do NOT repeat the original explanation. Provide new, more profound insights. Respond only with the detailed explanation in Markdown format.`;


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