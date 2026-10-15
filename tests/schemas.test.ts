import { describe, it, expect } from 'vitest';
import { DecisionOutputSchema, ScenarioSchema } from '../src/types/schemas.js';

describe('Zod Schemas', () => {
  describe('DecisionOutputSchema', () => {
    it('should successfully parse a valid decision output', () => {
      const validDecision = {
        thoughtProcess: 'Carefully evaluating the risk of database corruption versus error rates.',
        selectedAction: 'throttle_writes_and_coordinated_failover',
        actionParameters: { timeout_sec: 30 },
        confidence: 0.95,
        riskLevel: 'medium',
        riskRationale: 'Medium risk due to brief 30 second read-only window during failover.',
        rejectedAlternatives: [
          {
            actionId: 'immediate_force_failover',
            reason: 'Would drop 45 seconds of committed transactions.'
          }
        ],
        contingencyPlan:
          'If replica fails to catch up in 45s, revert write throttle and notify DBA.'
      };

      const result = DecisionOutputSchema.safeParse(validDecision);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(0.95);
        expect(result.data.riskLevel).toBe('medium');
      }
    });

    it('should reject decision with confidence outside 0-1', () => {
      const invalidDecision = {
        thoughtProcess: 'Reasoning here that is long enough.',
        selectedAction: 'act1',
        confidence: 1.5,
        riskLevel: 'low',
        riskRationale: 'Rationale here.',
        contingencyPlan: 'Fallback plan.'
      };

      const result = DecisionOutputSchema.safeParse(invalidDecision);
      expect(result.success).toBe(false);
    });

    it('should reject decision with invalid risk level', () => {
      const invalidDecision = {
        thoughtProcess: 'Reasoning here that is long enough.',
        selectedAction: 'act1',
        confidence: 0.8,
        riskLevel: 'ultra_extreme',
        riskRationale: 'Rationale here.',
        contingencyPlan: 'Fallback plan.'
      };

      const result = DecisionOutputSchema.safeParse(invalidDecision);
      expect(result.success).toBe(false);
    });
  });

  describe('ScenarioSchema', () => {
    it('should reject scenario with less than 2 actions', () => {
      const invalidScenario = {
        id: 'test_scen',
        title: 'Test',
        category: 'test',
        description: 'Test',
        context: 'Context narrative',
        stateVariables: {},
        goals: [{ id: 'g1', description: 'Goal', priority: 'primary', weight: 1 }],
        constraints: [],
        availableActions: [
          { id: 'a1', title: 'A1', description: 'Action 1', cost: 0, risk: 'low' }
        ],
        optimalActionId: 'a1'
      };

      const result = ScenarioSchema.safeParse(invalidScenario);
      expect(result.success).toBe(false);
    });
  });
});
