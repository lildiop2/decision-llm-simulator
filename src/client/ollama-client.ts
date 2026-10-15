import type { OllamaModelInfo, SimulationOptions } from '../types/index.js';

export interface OllamaGenerateResponse {
  response: string;
  totalDurationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export class OllamaClient {
  private baseUrl: string;

  constructor(host: string = process.env.OLLAMA_HOST || 'http://localhost:11434') {
    this.baseUrl = host.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Checks if Ollama API is reachable.
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches list of all locally available models in Ollama.
   */
  public async listModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`Failed to list Ollama models: HTTP ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { models?: OllamaModelInfo[] };
    return data.models || [];
  }

  /**
   * Requests a decision generation from Ollama.
   */
  public async generateDecision(
    prompt: string,
    systemPrompt: string,
    options: SimulationOptions
  ): Promise<OllamaGenerateResponse> {
    const startTime = performance.now();
    const timeoutMs = options.timeoutMs ?? 60000;

    const payload = {
      model: options.model,
      prompt,
      system: systemPrompt,
      format: 'json',
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        top_p: options.topP ?? 0.9,
        num_predict: options.maxTokens ?? 2048
      }
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Ollama request failed (${options.model}): ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama returned error ${response.status} (${options.model}): ${errorBody || response.statusText}`
      );
    }

    const data = (await response.json()) as {
      response: string;
      total_duration?: number;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const durationMs = performance.now() - startTime;

    return {
      response: data.response,
      totalDurationMs: Math.round(durationMs),
      promptTokens: data.prompt_eval_count,
      completionTokens: data.eval_count
    };
  }
}
