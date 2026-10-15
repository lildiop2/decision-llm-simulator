import type { OllamaModelInfo, SimulationOptions } from '../types/index.js';
import type { SystemOneRequest, SystemOneResponse } from '../types/schemas.js';

export interface OllamaGenerateResponse {
  response: string;
  totalDurationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface SystemOneExecuteResult {
  response: SystemOneResponse;
  totalDurationMs: number;
  inputTokens?: number;
  outputTokens?: number;
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
   * Verifica se a API do Ollama está acessível.
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
   * Obtém a lista de todos os modelos disponíveis no Ollama local.
   */
  public async listModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`Falha ao listar modelos do Ollama: HTTP ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { models?: OllamaModelInfo[] };
    return data.models || [];
  }

  /**
   * Verifica se um modelo específico é um modelo nativo de decisão (System One) do Ollama (?c=decision).
   */
  public async isSystemOneModel(modelName: string): Promise<boolean> {
    const knownDecisionPrefixes = ['tev1', 'kev', 'nimble', 'clef', 'laya', 'strands-decider'];

    if (knownDecisionPrefixes.some((p) => modelName.toLowerCase().startsWith(p))) {
      return true;
    }

    try {
      const models = await this.listModels();
      const found = models.find((m) => m.name === modelName || m.model === modelName);
      if (found && found.capabilities?.includes('decision')) {
        return true;
      }
    } catch {
      // Ignora erro de inspeção
    }
    return false;
  }

  /**
   * Executa uma decisão com LLMs generativos tradicionais via /api/generate com Zod JSON.
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
      throw new Error(`Requisição ao Ollama falhou (${options.model}): ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama retornou erro ${response.status} (${options.model}): ${errorBody || response.statusText}`
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

  /**
   * Executa uma chamada nativa de modelo de decisão usando o endpoint /v1/systemone do Ollama (?c=decision).
   */
  public async executeSystemOne(
    request: SystemOneRequest,
    timeoutMs: number = 30000
  ): Promise<SystemOneExecuteResult> {
    const startTime = performance.now();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/systemone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Chamada /v1/systemone falhou (${request.model}): ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama /v1/systemone retornou erro ${response.status} (${request.model}): ${errorBody || response.statusText}`
      );
    }

    const data = (await response.json()) as SystemOneResponse;
    const durationMs = Math.round(performance.now() - startTime);

    return {
      response: data,
      totalDurationMs: durationMs,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens
    };
  }
}
