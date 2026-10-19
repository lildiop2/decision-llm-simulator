export * from './schemas.js';

export interface LiteLlmModelInfo {
  id: string;
  name: string;
  endpoints: Array<'decision' | 'systemone'>;
  capabilities?: string[];
  owned_by?: string;
  created?: number;
  // Compatibilidade retroativa
  model?: string;
  size?: number;
  digest?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

// Alias para compatibilidade com código existente
export type OllamaModelInfo = LiteLlmModelInfo;

export interface SimulationOptions {
  model: string;
  litellmHost?: string;
  apiKey?: string;
  endpoint?: 'auto' | 'decision' | 'systemone';
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
  verbose?: boolean;
  // Alias de legado
  ollamaHost?: string;
}

export interface EnvironmentState {
  turn: number;
  maxTurns: number;
  isResolved: boolean;
  isFailed: boolean;
  summary: string;
  metrics: Record<string, number | string | boolean>;
  log: string[];
}
