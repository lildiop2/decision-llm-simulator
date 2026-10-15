import { describe, it, expect } from 'vitest';
import { DecisionEvaluator } from '../src/engine/evaluator.js';
import { incidentTriageScenario } from '../src/scenarios/incident-triage.js';

describe('DecisionEvaluator', () => {
  it('should score high for optimal action respecting constraints', () => {
    const parseResult = {
      success: true,
      cleanedText: '',
      errors: [],
      decision: {
        thoughtProcess:
          'Throttling writes prevents data loss while allowing replication to catch up smoothly.',
        selectedAction: 'throttle_writes_and_coordinated_failover',
        actionParameters: {},
        confidence: 0.9,
        riskLevel: 'medium' as const,
        riskRationale: 'Medium risk due to transient throttling.',
        rejectedAlternatives: [
          {
            actionId: 'immediate_force_failover',
            reason: 'Violates hard constraint against data loss.'
          }
        ],
        contingencyPlan: 'If replication lag does not drop in 30 seconds, scale read pool.'
      }
    };

    const evalResult = DecisionEvaluator.evaluate(incidentTriageScenario, parseResult, 250);
    expect(evalResult.passedHardConstraints).toBe(true);
    expect(evalResult.isOptimal).toBe(true);
    expect(evalResult.totalScore).toBeGreaterThanOrEqual(85);
  });

  it('should heavily penalize score when a hard constraint is violated', () => {
    const parseResult = {
      success: true,
      cleanedText: '',
      errors: [],
      decision: {
        thoughtProcess: 'We want quick recovery so we force failover immediately.',
        selectedAction: 'immediate_force_failover', // Forbidden hard constraint!
        actionParameters: {},
        confidence: 0.99,
        riskLevel: 'low' as const,
        riskRationale: 'Quick recovery.',
        rejectedAlternatives: [],
        contingencyPlan: 'None.'
      }
    };

    const evalResult = DecisionEvaluator.evaluate(incidentTriageScenario, parseResult, 300);
    expect(evalResult.passedHardConstraints).toBe(false);
    expect(evalResult.constraintViolations.length).toBeGreaterThan(0);
    expect(evalResult.totalScore).toBeLessThan(20);
  });

  it('should flag unrecognized actions', () => {
    const parseResult = {
      success: true,
      cleanedText: '',
      errors: [],
      decision: {
        thoughtProcess: 'Taking random non-existent action.',
        selectedAction: 'invented_fake_action',
        actionParameters: {},
        confidence: 0.5,
        riskLevel: 'low' as const,
        riskRationale: 'Unknown.',
        rejectedAlternatives: [],
        contingencyPlan: 'None.'
      }
    };

    const evalResult = DecisionEvaluator.evaluate(incidentTriageScenario, parseResult, 100);
    expect(evalResult.selectedActionValid).toBe(false);
    expect(evalResult.totalScore).toBeLessThanOrEqual(10);
  });

  it('should evaluate System One models with action probabilities correctly', () => {
    const parseResult = {
      success: true,
      cleanedText: '',
      errors: [],
      decision: {
        thoughtProcess: 'System One probability distribution calculated across actions.',
        selectedAction: 'throttle_writes_and_coordinated_failover',
        actionParameters: {},
        confidence: 0.85,
        riskLevel: 'high' as const,
        riskRationale: 'Operational risk assessed at score 2.',
        rejectedAlternatives: [
          { actionId: 'drain_connections_and_graceful_switch', reason: 'Lower probability.' }
        ],
        contingencyPlan: 'Trigger secondary action if throttle fails.'
      }
    };

    const evalResult = DecisionEvaluator.evaluate(
      incidentTriageScenario,
      parseResult,
      120,
      150,
      0,
      {
        actionProbabilities: {
          throttle_writes_and_coordinated_failover: 0.85,
          drain_connections_and_graceful_switch: 0.15
        },
        decisionModelType: 'systemone'
      }
    );

    expect(evalResult.decisionModelType).toBe('systemone');
    expect(evalResult.actionProbabilities).toBeDefined();
    expect(evalResult.reasoningDepthScore).toBeGreaterThanOrEqual(90);
    expect(evalResult.totalScore).toBeGreaterThanOrEqual(85);
  });
});
