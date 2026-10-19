import { describe, it, expect, vi } from 'vitest';
import { DecisionSimulator } from '../src/engine/simulator.js';
import { LiteLlmClient } from '../src/client/litellm-client.js';
import { incidentTriageScenario } from '../src/scenarios/incident-triage.js';

describe('DecisionSimulator with mock LiteLlmClient', () => {
  it('should run a scenario via /decision and produce a complete SimulationStepResult', async () => {
    const mockClient = new LiteLlmClient('http://localhost:4000');

    vi.spyOn(mockClient, 'generateDecision').mockResolvedValue({
      response: JSON.stringify({
        thoughtProcess: 'Coordinated failover avoids data loss and satisfies all goals.',
        selectedAction: 'throttle_writes_and_coordinated_failover',
        actionParameters: {},
        confidence: 0.92,
        riskLevel: 'medium',
        riskRationale: 'Controlled write pause.',
        rejectedAlternatives: [
          { actionId: 'immediate_force_failover', reason: 'Causes data loss.' }
        ],
        contingencyPlan: 'Retry switchover if ping fails.'
      }),
      totalDurationMs: 450,
      promptTokens: 120,
      completionTokens: 85
    });

    const simulator = new DecisionSimulator(mockClient);
    const result = await simulator.runScenario(incidentTriageScenario, {
      model: 'gpt-4o-mini'
    });

    expect(result.scenarioId).toBe(incidentTriageScenario.id);
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.decision?.selectedAction).toBe('throttle_writes_and_coordinated_failover');
    expect(result.evaluation.isOptimal).toBe(true);
    expect(result.evaluation.passedHardConstraints).toBe(true);
    expect(result.evaluation.decisionModelType).toBe('generative');
    expect(result.evaluation.totalScore).toBeGreaterThanOrEqual(80);
  });

  it('should run benchmark across scenarios and aggregate model summary', async () => {
    const mockClient = new LiteLlmClient('http://localhost:4000');

    vi.spyOn(mockClient, 'generateDecision').mockResolvedValue({
      response: JSON.stringify({
        thoughtProcess: 'A well reasoned analysis for the benchmark scenario.',
        selectedAction: 'throttle_writes_and_coordinated_failover',
        actionParameters: {},
        confidence: 0.9,
        riskLevel: 'medium',
        riskRationale: 'Well calibrated.',
        rejectedAlternatives: [],
        contingencyPlan: 'Fallback plan.'
      }),
      totalDurationMs: 200
    });

    const simulator = new DecisionSimulator(mockClient);
    const report = await simulator.runBenchmark([incidentTriageScenario], ['model-a']);

    expect(report.totalRuns).toBe(1);
    expect(report.modelsTested).toContain('model-a');
    expect(report.modelSummaries['model-a'].schemaPassRate).toBe(100);
    expect(report.modelSummaries['model-a'].averageTotalScore).toBeGreaterThan(0);
  });

  it('should execute native System One decision model via /systemone and map probabilities', async () => {
    const mockClient = new LiteLlmClient('http://localhost:4000');

    vi.spyOn(mockClient, 'executeSystemOne').mockResolvedValue({
      response: {
        model: 'tev1:0.8b',
        answers: {
          selected_action: {
            type: 'choice',
            choice: 'throttle_writes_and_coordinated_failover',
            probabilities: {
              throttle_writes_and_coordinated_failover: 0.78,
              drain_connections_and_graceful_switch: 0.2,
              force_immediate_split_brain_failover: 0.01,
              cancel_failover_wait_primary: 0.01
            },
            confidence: 0.78
          },
          risk_level: {
            type: 'score',
            score: 2
          },
          respects_safety: {
            type: 'noul',
            noul: 0.99
          }
        },
        usage: {
          input_tokens: 180,
          output_tokens: 0
        }
      },
      totalDurationMs: 150,
      inputTokens: 180,
      outputTokens: 0
    });

    const simulator = new DecisionSimulator(mockClient);
    const result = await simulator.runScenario(incidentTriageScenario, {
      model: 'tev1:0.8b'
    });

    expect(result.model).toBe('tev1:0.8b');
    expect(result.decision?.selectedAction).toBe('throttle_writes_and_coordinated_failover');
    expect(result.decision?.confidence).toBe(0.78);
    expect(result.decision?.riskLevel).toBe('high');
    expect(result.evaluation.decisionModelType).toBe('systemone');
    expect(result.evaluation.actionProbabilities).toBeDefined();
    expect(
      result.evaluation.actionProbabilities?.['throttle_writes_and_coordinated_failover']
    ).toBe(0.78);
    expect(result.evaluation.isOptimal).toBe(true);
    expect(result.evaluation.passedHardConstraints).toBe(true);
    expect(result.decision?.rejectedAlternatives?.length).toBe(3);
    expect(result.decision?.contingencyPlan).toContain('drain_connections_and_graceful_switch');
  });

  it('should support explicit endpoint override to /decision even for systemone-named model', async () => {
    const mockClient = new LiteLlmClient('http://localhost:4000');

    const generateSpy = vi.spyOn(mockClient, 'generateDecision').mockResolvedValue({
      response: JSON.stringify({
        thoughtProcess: 'Forced decision route analysis.',
        selectedAction: 'throttle_writes_and_coordinated_failover',
        confidence: 0.88,
        riskLevel: 'medium',
        riskRationale: 'Tested.',
        rejectedAlternatives: []
      }),
      totalDurationMs: 220
    });

    const simulator = new DecisionSimulator(mockClient);
    const result = await simulator.runScenario(incidentTriageScenario, {
      model: 'tev1:0.8b',
      endpoint: 'decision'
    });

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(result.evaluation.decisionModelType).toBe('generative');
  });
});
