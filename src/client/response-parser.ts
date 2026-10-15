import { DecisionOutputSchema, type DecisionOutput } from '../types/schemas.js';

export interface ParseResult {
  success: boolean;
  decision?: DecisionOutput;
  rawJson?: unknown;
  cleanedText: string;
  extractedThought?: string;
  errors: string[];
}

export class ResponseParser {
  /**
   * Extracts and validates structured DecisionOutput from raw LLM output.
   */
  public static parse(rawOutput: string): ParseResult {
    const extractedThought = this.extractThinking(rawOutput);
    const cleanedText = this.stripThinking(rawOutput).trim();

    const jsonCandidates = this.extractJsonStrings(cleanedText);
    const errors: string[] = [];

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);

        // If thought was in <think> tags and not inside the JSON, inject it if missing
        if (
          extractedThought &&
          typeof parsed === 'object' &&
          parsed !== null &&
          (!parsed.thoughtProcess || parsed.thoughtProcess.length < 10)
        ) {
          parsed.thoughtProcess = extractedThought;
        }

        // Validate strictly using Zod
        const result = DecisionOutputSchema.safeParse(parsed);
        if (result.success) {
          return {
            success: true,
            decision: result.data,
            rawJson: parsed,
            cleanedText,
            extractedThought,
            errors: []
          };
        } else {
          for (const issue of result.error.issues) {
            errors.push(`${issue.path.join('.') || 'root'}: ${issue.message}`);
          }
        }
      } catch (err: unknown) {
        errors.push(`Erro ao analisar JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (jsonCandidates.length === 0) {
      errors.push('Nenhuma estrutura JSON válida encontrada na resposta do modelo');
    }

    return {
      success: false,
      cleanedText,
      extractedThought,
      errors
    };
  }

  /**
   * Extracts reasoning enclosed in <think>...</think> tags.
   */
  public static extractThinking(text: string): string | undefined {
    const match = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return undefined;
  }

  /**
   * Strips out <think>...</think> tags.
   */
  public static stripThinking(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  /**
   * Finds all potential JSON object candidates in text, prioritizing markdown code blocks and auto-repairing truncated JSON.
   */
  private static extractJsonStrings(text: string): string[] {
    const candidates: string[] = [];

    // 1. Look for ```json ... ``` blocks
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const code = match[1].trim();
      if (code.startsWith('{') && code.endsWith('}')) {
        candidates.push(code);
      }
    }

    // 2. Look for the first '{' and last '}' in the text
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1).trim();
      if (!candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    }

    // 3. Attempt truncated JSON repair if firstBrace was found but unclosed
    if (firstBrace !== -1) {
      const candidateFromFirstBrace = text.slice(firstBrace).trim();
      const repaired = this.tryRepairTruncatedJson(candidateFromFirstBrace);
      if (repaired && !candidates.includes(repaired)) {
        candidates.push(repaired);
      }
    }

    return candidates;
  }

  /**
   * Attempts to repair truncated JSON strings by closing open quotes and balancing braces.
   */
  public static tryRepairTruncatedJson(raw: string): string | null {
    let inString = false;
    let escaped = false;
    const stack: string[] = [];

    let cleaned = '';

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];

      if (escaped) {
        escaped = false;
        cleaned += char;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        cleaned += char;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        cleaned += char;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}') {
          if (stack.length > 0 && stack[stack.length - 1] === '{') {
            stack.pop();
          }
        } else if (char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === '[') {
            stack.pop();
          }
        }
      }

      cleaned += char;
    }

    // If still inside string, close it
    if (inString) {
      cleaned += '"';
    }

    // Balance remaining open brackets in reverse order
    while (stack.length > 0) {
      const open = stack.pop();
      if (open === '{') cleaned += '}';
      else if (open === '[') cleaned += ']';
    }

    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      return null;
    }
  }
}
