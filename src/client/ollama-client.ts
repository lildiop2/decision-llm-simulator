import { LiteLlmClient } from './litellm-client.js';
import type { LiteLlmDecisionResponse, SystemOneExecuteResult } from './litellm-client.js';

export type OllamaGenerateResponse = LiteLlmDecisionResponse;
export type { SystemOneExecuteResult };

/**
 * @deprecated OllamaClient foi descontinuado em prol de LiteLlmClient.
 * O LiteLLM Proxy é o único provider de modelos do sistema, fornecendo /decision e /systemone.
 */
export class OllamaClient extends LiteLlmClient {
  constructor(
    host: string = process.env.LITELLM_HOST ||
      process.env.LITELLM_BASE_URL ||
      process.env.OLLAMA_HOST ||
      'http://localhost:4000',
    apiKey: string = process.env.LITELLM_API_KEY || ''
  ) {
    super(host, apiKey);
  }

  public async isSystemOneModel(modelName: string): Promise<boolean> {
    return this.isKnownSystemOneModel(modelName);
  }
}
