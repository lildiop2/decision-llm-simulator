export * from './schemas.js';

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  capabilities?: string[];
}

export interface SimulationOptions {
  model: string;
  ollamaHost?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
  verbose?: boolean;
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
