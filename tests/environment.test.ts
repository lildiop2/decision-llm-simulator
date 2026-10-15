import { describe, it, expect } from 'vitest';
import { IncidentManagementEnvironment } from '../src/engine/environment.js';
import type { DecisionOutput } from '../src/types/schemas.js';

describe('IncidentManagementEnvironment', () => {
  it('should initialize with turn 0 and healthy starting metrics', () => {
    const env = new IncidentManagementEnvironment(4);
    expect(env.getTurn()).toBe(0);
    const metrics = env.getMetrics();
    expect(metrics.systemHealth).toBe(45);
    expect(metrics.errorRatePercent).toBe(22);
  });

  it('should improve metrics when circuit breaker action is applied', () => {
    const env = new IncidentManagementEnvironment(4);
    const decision: DecisionOutput = {
      thoughtProcess: 'Applying circuit breaker to protect primary database.',
      selectedAction: 'circuit_breaker_non_critical',
      actionParameters: {},
      confidence: 0.9,
      riskLevel: 'low',
      riskRationale: 'Low risk.',
      rejectedAlternatives: [],
      contingencyPlan: 'None.'
    };

    const result = env.step(decision);
    expect(result.turn).toBe(1);
    expect(result.metrics.systemHealth).toBeGreaterThan(45);
    expect(result.metrics.errorRatePercent).toBeLessThan(22);
    expect(result.isFailed).toBe(false);
  });

  it('should trigger failure when catastrophic cold reboot is chosen', () => {
    const env = new IncidentManagementEnvironment(4);
    const decision: DecisionOutput = {
      thoughtProcess: 'Cold rebooting all nodes simultaneously.',
      selectedAction: 'hard_reboot_all_nodes',
      actionParameters: {},
      confidence: 0.1,
      riskLevel: 'critical',
      riskRationale: 'Severe risk.',
      rejectedAlternatives: [],
      contingencyPlan: 'None.'
    };

    const result = env.step(decision);
    expect(result.isFailed).toBe(true);
    expect(result.metrics.systemHealth).toBe(0);
  });
});
