import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiteLlmClient } from '../src/client/litellm-client.js';

describe('LiteLlmClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default or provided URL and auth headers', () => {
    const client = new LiteLlmClient('http://localhost:4000/', 'my-secret-key');
    expect(client.getBaseUrl()).toBe('http://localhost:4000');
    expect(client.getApiKey()).toBe('my-secret-key');
  });

  it('should return true for isHealthy if /health succeeds', async () => {
    const client = new LiteLlmClient('http://localhost:4000');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    );

    const healthy = await client.isHealthy();
    expect(healthy).toBe(true);
  });

  it('should fallback to /models if /health fails in isHealthy', async () => {
    const client = new LiteLlmClient('http://localhost:4000');
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Health route not found'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'model-1' }] }), { status: 200 })
      );

    const healthy = await client.isHealthy();
    expect(healthy).toBe(true);
  });

  it('should list models from LiteLLM proxy and identify supported endpoints', async () => {
    const client = new LiteLlmClient('http://localhost:4000');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-4o', owned_by: 'openai' },
            { id: 'tev1:0.8b', owned_by: 'custom' },
            { id: 'decision-model', owned_by: 'litellm' }
          ]
        }),
        { status: 200 }
      )
    );

    const models = await client.listModels();
    expect(models).toHaveLength(3);

    const gpt = models.find((m) => m.id === 'gpt-4o');
    expect(gpt?.endpoints).toEqual(['decision']);

    const tev = models.find((m) => m.id === 'tev1:0.8b');
    expect(tev?.endpoints).toContain('systemone');
    expect(tev?.endpoints).toContain('decision');
  });

  it('should resolve endpoint type based on model name and explicit overrides', () => {
    const client = new LiteLlmClient();

    // Auto resolution
    expect(client.resolveEndpointType('gpt-4o')).toBe('decision');
    expect(client.resolveEndpointType('tev1:0.8b')).toBe('systemone');
    expect(client.resolveEndpointType('kev:latest')).toBe('systemone');
    expect(client.resolveEndpointType('nimble-decision')).toBe('systemone');
    expect(client.resolveEndpointType('custom-systemone-model')).toBe('systemone');

    // Explicit overrides
    expect(client.resolveEndpointType('tev1:0.8b', 'decision')).toBe('decision');
    expect(client.resolveEndpointType('gpt-4o', 'systemone')).toBe('systemone');
  });

  it('should call /decision and parse json response', async () => {
    const client = new LiteLlmClient('http://localhost:4000', 'test-key');

    const mockResponsePayload = {
      thoughtProcess: 'Selected based on lowest latency and zero data loss.',
      selectedAction: 'action_a',
      confidence: 0.95,
      riskLevel: 'low',
      riskRationale: 'Well tested pathway.',
      rejectedAlternatives: [{ actionId: 'action_b', reason: 'Too slow' }],
      contingencyPlan: 'Rollback if errors occur'
    };

    let requestedUrl = '';
    let requestedHeaders: Headers | undefined;
    let requestBody: any;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      requestedUrl = url.toString();
      requestedHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          response: JSON.stringify(mockResponsePayload),
          usage: { prompt_tokens: 150, completion_tokens: 60 }
        }),
        { status: 200 }
      );
    });

    const res = await client.generateDecision('User prompt', 'System prompt', {
      model: 'decision-model',
      temperature: 0.3
    });

    expect(requestedUrl).toBe('http://localhost:4000/decision');
    expect(requestedHeaders?.get('authorization')).toBe('Bearer test-key');
    expect(requestBody.model).toBe('decision-model');
    expect(requestBody.temperature).toBe(0.3);
    expect(res.promptTokens).toBe(150);
    expect(res.completionTokens).toBe(60);
    expect(JSON.parse(res.response).selectedAction).toBe('action_a');
  });

  it('should call /decision and handle OpenAI chat choices format', async () => {
    const client = new LiteLlmClient('http://localhost:4000');

    const mockContent = JSON.stringify({
      thoughtProcess: 'Fast analysis.',
      selectedAction: 'failover_now',
      confidence: 0.9,
      riskLevel: 'medium',
      riskRationale: 'Moderate risk.',
      rejectedAlternatives: [],
      contingencyPlan: 'None'
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockContent } }],
          usage: { input_tokens: 100, output_tokens: 50 }
        }),
        { status: 200 }
      )
    );

    const res = await client.generateDecision('Prompt', 'System', {
      model: 'gpt-4o-mini'
    });

    expect(res.promptTokens).toBe(100);
    expect(res.completionTokens).toBe(50);
    expect(JSON.parse(res.response).selectedAction).toBe('failover_now');
  });

  it('should call /systemone and return structured response', async () => {
    const client = new LiteLlmClient('http://localhost:4000');

    const systemOneData = {
      model: 'tev1:0.8b',
      answers: {
        selected_action: {
          type: 'choice',
          choice: 'drain_connections',
          probabilities: { drain_connections: 0.85, force_kill: 0.15 },
          confidence: 0.85
        },
        risk_level: { type: 'score', score: 1 },
        respects_safety: { type: 'noul', noul: 1.0 }
      },
      usage: { input_tokens: 80, output_tokens: 10 }
    };

    let requestedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify(systemOneData), { status: 200 });
    });

    const res = await client.executeSystemOne({
      model: 'tev1:0.8b',
      state: 'sample state',
      questions: {} as any
    });

    expect(requestedUrl).toBe('http://localhost:4000/systemone');
    expect(res.response.answers.selected_action.choice).toBe('drain_connections');
    expect(res.inputTokens).toBe(80);
  });

  it('should fallback to /sytemone or /v1/systemone if /systemone returns 404', async () => {
    const client = new LiteLlmClient('http://localhost:4000');

    const systemOneData = {
      model: 'tev1:0.8b',
      answers: {
        selected_action: {
          type: 'choice',
          choice: 'drain_connections',
          probabilities: { drain_connections: 0.9 },
          confidence: 0.9
        }
      }
    };

    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async (url) => {
        requestedUrls.push(url.toString());
        return new Response('Not Found', { status: 404 });
      })
      .mockImplementationOnce(async (url) => {
        requestedUrls.push(url.toString());
        return new Response(JSON.stringify(systemOneData), { status: 200 });
      });

    const res = await client.executeSystemOne({
      model: 'tev1:0.8b',
      state: 'state',
      questions: {} as any
    });

    expect(requestedUrls[0]).toBe('http://localhost:4000/systemone');
    expect(requestedUrls[1]).toBe('http://localhost:4000/sytemone');
    expect(res.response.answers.selected_action.choice).toBe('drain_connections');
  });

  it('should throw an informative error when /decision returns HTTP error', async () => {
    const client = new LiteLlmClient('http://localhost:4000');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Model not found in LiteLLM configuration', {
        status: 404,
        statusText: 'Not Found'
      })
    );

    await expect(
      client.generateDecision('Prompt', 'System', { model: 'invalid-model' })
    ).rejects.toThrow('LiteLLM Proxy /decision retornou erro 404');
  });
});
