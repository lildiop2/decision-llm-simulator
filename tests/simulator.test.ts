import { describe, it, expect, vi } from 'vitest';
import { DecisionSimulator } from '../src/engine/simulator.js';
import { OllamaClient } from '../src/client/ollama-client.js';
import { incidentTriageScenario } from '../src/scenarios/incident-triage.js';

describe('DecisionSimulator with mock OllamaClient', () => {
  it('should run a scenario and produce a complete SimulationStepResult', async () => {
    const mockClient = new OllamaClient('http://localhost:11434');

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
      model: 'test-model:latest'
    });

    expect(result.scenarioId).toBe(incidentTriageScenario.id);
    expect(result.model).toBe('test-model:latest');
    expect(result.decision?.selectedAction).toBe('throttle_writes_and_coordinated_failover');
    expect(result.evaluation.isOptimal).toBe(true);
    expect(result.evaluation.passedHardConstraints).toBe(true);
    expect(result.evaluation.totalScore).toBeGreaterThanOrEqual(80);
  });

  it('should run benchmark across scenarios and aggregate model summary', async () => {
    const mockClient = new OllamaClient('http://localhost:11434');

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
});
