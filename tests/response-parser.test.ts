import { describe, it, expect } from 'vitest';
import { ResponseParser } from '../src/client/response-parser.js';

describe('ResponseParser', () => {
  it('should parse clean raw JSON', () => {
    const raw = JSON.stringify({
      thoughtProcess: 'A long enough thought process analyzing the options in detail.',
      selectedAction: 'action_a',
      actionParameters: {},
      confidence: 0.9,
      riskLevel: 'low',
      riskRationale: 'Low risk operational procedure.',
      rejectedAlternatives: [],
      contingencyPlan: 'Rollback if necessary.'
    });

    const result = ResponseParser.parse(raw);
    expect(result.success).toBe(true);
    expect(result.decision?.selectedAction).toBe('action_a');
  });

  it('should extract JSON from markdown code fences', () => {
    const markdown = `
Here is my decision based on the operational data:

\`\`\`json
{
  "thoughtProcess": "Considering the severe impact of data loss, we must choose carefully.",
  "selectedAction": "action_safe",
  "actionParameters": {},
  "confidence": 0.85,
  "riskLevel": "medium",
  "riskRationale": "Risk is contained by gradual rollout.",
  "rejectedAlternatives": [
    { "actionId": "action_unsafe", "reason": "Causes data loss" }
  ],
  "contingencyPlan": "Revert immediately on alert."
}
\`\`\`

Hope this helps!
`;

    const result = ResponseParser.parse(markdown);
    expect(result.success).toBe(true);
    expect(result.decision?.selectedAction).toBe('action_safe');
    expect(result.decision?.rejectedAlternatives).toHaveLength(1);
  });

  it('should extract <think> tags and use them as thoughtProcess if missing', () => {
    const outputWithThink = `
<think>
We are facing an urgent database crisis. Option A loses data. Option B is safe. We should definitely go with Option B.
</think>
{
  "thoughtProcess": "",
  "selectedAction": "action_b",
  "actionParameters": {},
  "confidence": 0.95,
  "riskLevel": "low",
  "riskRationale": "Controlled procedure.",
  "rejectedAlternatives": [],
  "contingencyPlan": "Alert DBA team."
}
`;

    const result = ResponseParser.parse(outputWithThink);
    expect(result.success).toBe(true);
    expect(result.extractedThought).toContain('facing an urgent database crisis');
    expect(result.decision?.thoughtProcess).toContain('facing an urgent database crisis');
  });

  it('should auto-repair and parse truncated JSON', () => {
    const truncated =
      '{"selectedAction": "action_safe", "confidence": 0.9, "riskLevel": "low", "riskRationale": "Safe procedure", "thoughtProcess": "Truncated thought at the end';
    const result = ResponseParser.parse(truncated);
    expect(result.success).toBe(true);
    expect(result.decision?.selectedAction).toBe('action_safe');
    expect(result.decision?.confidence).toBe(0.9);
  });

  it('should return errors for invalid JSON', () => {
    const invalidText = 'I think action_a is the best choice, but I will not provide JSON.';
    const result = ResponseParser.parse(invalidText);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
