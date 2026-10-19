import type { LiteLlmModelInfo, SimulationOptions } from '../types/index.js';
import type { Scenario, SystemOneRequest, SystemOneResponse } from '../types/schemas.js';

export interface LiteLlmDecisionResponse {
  response: string;
  totalDurationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  raw?: unknown;
}

export interface SystemOneExecuteResult {
  response: SystemOneResponse;
  totalDurationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export class LiteLlmClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(
    host: string = process.env.LITELLM_HOST ||
      process.env.LITELLM_BASE_URL ||
      'http://localhost:4000',
    apiKey: string = process.env.LITELLM_API_KEY || ''
  ) {
    this.baseUrl = host.replace(/\/+$/, '');
    this.apiKey = apiKey.trim() || undefined;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getApiKey(): string | undefined {
    return this.apiKey;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim() || undefined;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Verifica se o LiteLLM Proxy está ativo e acessível.
   */
  public async isHealthy(): Promise<boolean> {
    try {
      // 1. Tenta endpoint /health
      const healthRes = await fetch(`${this.baseUrl}/health`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (healthRes.ok) return true;
    } catch {
      // Falha esperada caso /health não esteja mapeado; tenta fallback abaixo
    }

    try {
      // 2. Fallback para /models ou /v1/models
      const modelsRes = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (modelsRes.ok) return true;

      const v1Res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      return v1Res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lista todos os modelos disponíveis configurados no LiteLLM Proxy.
   */
  public async listModels(): Promise<LiteLlmModelInfo[]> {
    let res: Response | null = null;
    let lastError: Error | null = null;

    for (const path of ['/models', '/v1/models']) {
      try {
        const candidate = await fetch(`${this.baseUrl}${path}`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000)
        });
        if (candidate.ok) {
          res = candidate;
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!res) {
      throw new Error(
        `Falha ao listar modelos do LiteLLM Proxy em ${this.baseUrl}: ${
          lastError ? lastError.message : 'Conexão recusada ou rota não encontrada'
        }`
      );
    }

    const data = (await res.json()) as {
      data?: Array<{ id: string; owned_by?: string; created?: number }>;
      models?: Array<{ name?: string; id?: string; model?: string }>;
    };

    const rawList = data.data || data.models || [];
    return rawList.map((item) => {
      const record = item as Record<string, unknown>;
      const id = String(record.id || record.name || record.model || 'unknown');
      const isSystemOne = this.isKnownSystemOneModel(id);
      return {
        id,
        name: id,
        model: id,
        endpoints: isSystemOne ? ['systemone', 'decision'] : ['decision'],
        capabilities: isSystemOne
          ? ['decision', 'systemone', 'probabilities']
          : ['decision', 'generative'],
        owned_by: typeof record.owned_by === 'string' ? record.owned_by : undefined,
        created: typeof record.created === 'number' ? record.created : undefined
      };
    });
  }

  /**
   * Helper para identificar modelos compatíveis com o endpoint nativo System One (/systemone).
   */
  public isKnownSystemOneModel(modelName: string): boolean {
    const knownDecisionPrefixes = [
      'tev1',
      'kev',
      'nimble',
      'clef',
      'laya',
      'strands-decider',
      'systemone'
    ];
    const lower = modelName.toLowerCase();
    return knownDecisionPrefixes.some((p) => lower.startsWith(p) || lower.includes(p));
  }

  /**
   * Resolve se a chamada deve ser roteada para o endpoint /decision ou /systemone.
   */
  public resolveEndpointType(
    modelName: string,
    explicit?: 'auto' | 'decision' | 'systemone'
  ): 'decision' | 'systemone' {
    if (explicit === 'systemone') return 'systemone';
    if (explicit === 'decision') return 'decision';
    return this.isKnownSystemOneModel(modelName) ? 'systemone' : 'decision';
  }

  /**
   * Executa uma decisão com LLMs generativos via endpoint /decision do LiteLLM Proxy.
   */
  public async generateDecision(
    prompt: string,
    systemPrompt: string,
    options: SimulationOptions,
    scenario?: Scenario
  ): Promise<LiteLlmDecisionResponse> {
    const startTime = performance.now();
    const timeoutMs = options.timeoutMs ?? 60000;

    const payload = {
      model: options.model,
      prompt,
      system: systemPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      scenario: scenario
        ? {
            id: scenario.id,
            title: scenario.title,
            category: scenario.category
          }
        : undefined,
      format: 'json',
      response_format: { type: 'json_object' },
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 0.9
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/decision`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Requisição ao LiteLLM Proxy /decision falhou (${options.model}): ${errorMsg}`
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `LiteLLM Proxy /decision retornou erro ${response.status} (${options.model}): ${
          errorBody || response.statusText
        }`
      );
    }

    const durationMs = Math.round(performance.now() - startTime);
    const data = (await response.json()) as Record<string, unknown>;

    let responseText = '';
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    if (data.usage && typeof data.usage === 'object') {
      const usage = data.usage as Record<string, unknown>;
      promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens) || undefined;
      completionTokens = Number(usage.completion_tokens ?? usage.output_tokens) || undefined;
    }

    if (typeof data.response === 'string') {
      responseText = data.response;
    } else if (data.response && typeof data.response === 'object') {
      responseText = JSON.stringify(data.response);
    } else if (
      Array.isArray(data.choices) &&
      data.choices[0] &&
      typeof data.choices[0] === 'object'
    ) {
      const choice = data.choices[0] as { message?: { content?: string } };
      responseText = choice.message?.content || '';
    } else if (data.decision && typeof data.decision === 'object') {
      responseText = JSON.stringify(data.decision);
    } else if (data.selectedAction) {
      responseText = JSON.stringify(data);
    } else {
      responseText = JSON.stringify(data);
    }

    return {
      response: responseText,
      totalDurationMs: durationMs,
      promptTokens,
      completionTokens,
      raw: data
    };
  }

  /**
   * Executa uma chamada nativa de modelo de decisão usando o endpoint /systemone do LiteLLM Proxy.
   * Suporta fallback para /sytemone e /v1/systemone.
   */
  public async executeSystemOne(
    request: SystemOneRequest,
    timeoutMs: number = 30000
  ): Promise<SystemOneExecuteResult> {
    const startTime = performance.now();
    const candidatePaths = ['/systemone', '/sytemone', '/v1/systemone'];

    let lastError: Error | null = null;
    let response: Response | null = null;

    for (const path of candidatePaths) {
      try {
        const candidate = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(timeoutMs)
        });

        // Se retornar 404, tenta a rota de fallback seguinte
        if (candidate.status === 404 && path !== candidatePaths[candidatePaths.length - 1]) {
          continue;
        }

        response = candidate;
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!response) {
      throw new Error(
        `Chamada System One ao LiteLLM Proxy falhou (${request.model}): ${
          lastError?.message || 'Falha de conexão'
        }`
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `LiteLLM Proxy System One retornou erro ${response.status} (${request.model}): ${
          errorBody || response.statusText
        }`
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
