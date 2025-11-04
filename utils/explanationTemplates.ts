/**
 * Custom explanation template system for Ansuz
 * Allows users to customize AI explanation prompts and styles
 */

export interface ExplanationTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  style: TemplateStyle;
  examples?: string[];
  tags?: string[];
  createdAt: number;
  isDefault?: boolean;
}

export interface TemplateStyle {
  useMarkdown: boolean;
  useBullets: boolean;
  useBold: boolean;
  useCodeBlocks: boolean;
  paragraphSpacing: boolean;
  maxExplanationLength?: number;
}

const STORAGE_KEY = 'ansuz_custom_templates';

/**
 * Default built-in templates
 */
export const DEFAULT_TEMPLATES: ExplanationTemplate[] = [
  {
    id: 'beginner-friendly',
    name: 'Beginner Friendly',
    description: 'Simple explanations for coding newcomers',
    systemPrompt: `You are a friendly code tutor explaining code to beginners. Use simple language, avoid jargon, and explain basic concepts. Use analogies where helpful.

**Key Points:**
- Use everyday language
- Explain what AND why
- Include analogies for complex concepts
- No assumption of prior knowledge`,
    temperature: 0.2,
    style: {
      useMarkdown: true,
      useBullets: true,
      useBold: true,
      useCodeBlocks: true,
      paragraphSpacing: true,
    },
    tags: ['beginner', 'educational', 'simple'],
    isDefault: true,
    createdAt: Date.now(),
  },
  {
    id: 'technical-deep-dive',
    name: 'Technical Deep Dive',
    description: 'Detailed technical analysis for experienced developers',
    systemPrompt: `You are a senior software engineer providing detailed technical analysis. Focus on design patterns, performance implications, and best practices.

**Key Points:**
- Identify design patterns and architectural decisions
- Discuss trade-offs and alternatives
- Mention edge cases and potential issues
- Reference industry standards and best practices`,
    temperature: 0.3,
    style: {
      useMarkdown: true,
      useBullets: true,
      useBold: true,
      useCodeBlocks: true,
      paragraphSpacing: true,
    },
    tags: ['expert', 'technical', 'detailed'],
    isDefault: true,
    createdAt: Date.now(),
  },
  {
    id: 'security-focused',
    name: 'Security Focused',
    description: 'Emphasis on security vulnerabilities and best practices',
    systemPrompt: `You are a security expert analyzing code for vulnerabilities. Focus on security issues, potential exploits, and secure coding practices.

**Key Points:**
- Identify security vulnerabilities (injection, XSS, etc.)
- Explain potential attack vectors
- Suggest secure alternatives
- Reference OWASP and security standards`,
    temperature: 0.25,
    style: {
      useMarkdown: true,
      useBullets: true,
      useBold: true,
      useCodeBlocks: true,
      paragraphSpacing: true,
    },
    tags: ['security', 'vulnerabilities', 'best-practices'],
    isDefault: true,
    createdAt: Date.now(),
  },
  {
    id: 'performance-optimization',
    name: 'Performance Optimization',
    description: 'Focus on performance, efficiency, and optimization opportunities',
    systemPrompt: `You are a performance optimization expert. Analyze code for efficiency, identify bottlenecks, and suggest optimizations.

**Key Points:**
- Identify performance bottlenecks
- Analyze time and space complexity
- Suggest optimization techniques
- Discuss caching, memoization, and other strategies`,
    temperature: 0.3,
    style: {
      useMarkdown: true,
      useBullets: true,
      useBold: true,
      useCodeBlocks: true,
      paragraphSpacing: true,
    },
    tags: ['performance', 'optimization', 'efficiency'],
    isDefault: true,
    createdAt: Date.now(),
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Comprehensive code review focusing on quality and maintainability',
    systemPrompt: `You are conducting a thorough code review. Focus on code quality, maintainability, readability, and potential improvements.

**Key Points:**
- Assess code quality and readability
- Identify code smells and anti-patterns
- Suggest refactoring opportunities
- Check for proper error handling and edge cases`,
    temperature: 0.25,
    style: {
      useMarkdown: true,
      useBullets: true,
      useBold: true,
      useCodeBlocks: true,
      paragraphSpacing: true,
    },
    tags: ['review', 'quality', 'maintainability'],
    isDefault: true,
    createdAt: Date.now(),
  },
  {
    id: 'concise-summary',
    name: 'Concise Summary',
    description: 'Brief, to-the-point explanations',
    systemPrompt: `Provide concise, focused explanations. Be brief and direct while maintaining clarity.

**Key Points:**
- Maximum 2-3 sentences per block
- Focus on essential information only
- No unnecessary elaboration
- Clear and direct language`,
    temperature: 0.2,
    style: {
      useMarkdown: true,
      useBullets: false,
      useBold: true,
      useCodeBlocks: false,
      paragraphSpacing: false,
      maxExplanationLength: 150,
    },
    tags: ['concise', 'brief', 'summary'],
    isDefault: true,
    createdAt: Date.now(),
  },
];

/**
 * Template manager class
 */
export class TemplateManager {
  private templates: ExplanationTemplate[] = [];

  constructor() {
    this.loadTemplates();
  }

  /**
   * Get all templates (defaults + custom)
   */
  getAllTemplates(): ExplanationTemplate[] {
    return [...DEFAULT_TEMPLATES, ...this.templates];
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ExplanationTemplate | undefined {
    return this.getAllTemplates().find(t => t.id === id);
  }

  /**
   * Get custom (user-created) templates only
   */
  getCustomTemplates(): ExplanationTemplate[] {
    return this.templates;
  }

  /**
   * Create a new custom template
   */
  createTemplate(template: Omit<ExplanationTemplate, 'id' | 'createdAt'>): ExplanationTemplate {
    const newTemplate: ExplanationTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: Date.now(),
      isDefault: false,
    };

    this.templates.push(newTemplate);
    this.saveTemplates();

    return newTemplate;
  }

  /**
   * Update an existing custom template
   */
  updateTemplate(id: string, updates: Partial<ExplanationTemplate>): boolean {
    const index = this.templates.findIndex(t => t.id === id);

    if (index === -1) {
      console.error('Cannot update default template or template not found');
      return false;
    }

    this.templates[index] = {
      ...this.templates[index],
      ...updates,
      id: this.templates[index].id, // Preserve ID
      createdAt: this.templates[index].createdAt, // Preserve creation date
    };

    this.saveTemplates();
    return true;
  }

  /**
   * Delete a custom template
   */
  deleteTemplate(id: string): boolean {
    const initialLength = this.templates.length;
    this.templates = this.templates.filter(t => t.id !== id);

    if (this.templates.length < initialLength) {
      this.saveTemplates();
      return true;
    }

    return false;
  }

  /**
   * Duplicate a template
   */
  duplicateTemplate(id: string, newName?: string): ExplanationTemplate | null {
    const template = this.getTemplate(id);

    if (!template) return null;

    const duplicate: Omit<ExplanationTemplate, 'id' | 'createdAt'> = {
      ...template,
      name: newName || `${template.name} (Copy)`,
      isDefault: false,
    };

    return this.createTemplate(duplicate);
  }

  /**
   * Search templates by name or tags
   */
  searchTemplates(query: string): ExplanationTemplate[] {
    const lowerQuery = query.toLowerCase();

    return this.getAllTemplates().filter(template => {
      const nameMatch = template.name.toLowerCase().includes(lowerQuery);
      const descMatch = template.description.toLowerCase().includes(lowerQuery);
      const tagMatch = template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));

      return nameMatch || descMatch || tagMatch;
    });
  }

  /**
   * Export templates to JSON
   */
  exportTemplates(): string {
    return JSON.stringify(this.templates, null, 2);
  }

  /**
   * Import templates from JSON
   */
  importTemplates(jsonString: string): { success: number; errors: number } {
    let success = 0;
    let errors = 0;

    try {
      const imported = JSON.parse(jsonString) as ExplanationTemplate[];

      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array of templates');
      }

      imported.forEach(template => {
        try {
          this.createTemplate({
            name: template.name,
            description: template.description,
            systemPrompt: template.systemPrompt,
            temperature: template.temperature,
            style: template.style,
            examples: template.examples,
            tags: template.tags,
          });
          success++;
        } catch (e) {
          console.error('Failed to import template:', e);
          errors++;
        }
      });

      this.saveTemplates();
    } catch (e) {
      console.error('Failed to parse imported templates:', e);
      errors++;
    }

    return { success, errors };
  }

  /**
   * Reset to default templates
   */
  resetToDefaults(): void {
    if (confirm('This will delete all custom templates. Are you sure?')) {
      this.templates = [];
      this.saveTemplates();
    }
  }

  // Private methods

  private loadTemplates(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        this.templates = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load custom templates:', e);
      this.templates = [];
    }
  }

  private saveTemplates(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.templates));
    } catch (e) {
      console.error('Failed to save custom templates:', e);
    }
  }
}

/**
 * Global template manager instance
 */
export const templateManager = new TemplateManager();

/**
 * Build system instruction from template
 */
export function buildSystemInstruction(template: ExplanationTemplate): string {
  let instruction = template.systemPrompt;

  // Add formatting rules based on style
  instruction += '\n\n**FORMATTING RULES:**\n';

  if (template.style.useMarkdown) {
    instruction += '- Use well-formatted Markdown for all explanations\n';
  }

  if (template.style.useBullets) {
    instruction += '- Use bulleted lists for multiple items or steps\n';
    if (template.style.paragraphSpacing) {
      instruction += '- Insert a blank line before starting lists\n';
    }
  }

  if (template.style.useBold) {
    instruction += '- Use **bold text** to highlight key terms and concepts\n';
  }

  if (template.style.useCodeBlocks) {
    instruction += '- Use inline `code` for references to code elements\n';
  }

  if (template.style.paragraphSpacing) {
    instruction += '- Separate ideas into distinct paragraphs with blank lines\n';
  }

  if (template.style.maxExplanationLength) {
    instruction += `- Keep explanations under ${template.style.maxExplanationLength} characters\n`;
  }

  // Add examples if provided
  if (template.examples && template.examples.length > 0) {
    instruction += '\n**EXAMPLES:**\n';
    template.examples.forEach((example, i) => {
      instruction += `\nExample ${i + 1}:\n${example}\n`;
    });
  }

  return instruction;
}
