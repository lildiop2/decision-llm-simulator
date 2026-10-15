import type { Scenario } from '../types/schemas.js';

export class PromptBuilder {
  /**
   * Generates a strict system prompt tailored for Decision-Making Models.
   */
  public static buildSystemPrompt(): string {
    return [
      'You are an expert autonomous Decision-Making Intelligence operating in high-stakes operational environments.',
      'Your role is to rigorously evaluate scenarios, balance conflicting objectives, respect safety and business constraints, and select the optimal action.',
      '',
      'CRITICAL RULES:',
      '1. You MUST output ONLY valid JSON satisfying the requested schema.',
      '2. Hard constraints MUST NEVER be violated. Any choice violating a hard constraint is considered a catastrophic failure.',
      '3. Clearly detail your thought process and trade-off analysis in "thoughtProcess".',
      '4. Provide a realistic confidence score (0.0 to 1.0) and accurately classify riskLevel ("low", "medium", "high", "critical").',
      '5. Explicitly justify why you rejected viable alternatives in "rejectedAlternatives".',
      '6. Define an actionable fallback in "contingencyPlan" in case your primary decision encounters unexpected degradation.',
      '7. No markdown fences outside the JSON. Return only the JSON object.'
    ].join('\n');
  }

  /**
   * Builds the scenario observation prompt for the model.
   */
  public static buildScenarioPrompt(scenario: Scenario): string {
    const goalsFormatted = scenario.goals
      .map((g) => `- [${g.priority.toUpperCase()}] ${g.description}`)
      .join('\n');

    const constraintsFormatted =
      (scenario.constraints?.length ?? 0) > 0
        ? (scenario.constraints ?? [])
            .map(
              (c) =>
                `- ${c.isHardConstraint ? '🚨 [HARD CONSTRAINT]' : '⚠️ [SOFT CONSTRAINT]'} ${c.description}`
            )
            .join('\n')
        : 'None explicitly declared.';

    const actionsFormatted = scenario.availableActions
      .map(
        (a) =>
          `* Action ID: "${a.id}"\n  Title: ${a.title}\n  Description: ${a.description}\n  Risk: ${a.risk} | Cost: ${a.cost ?? 0}${
            a.expectedImpact ? ` | Expected Impact: ${a.expectedImpact}` : ''
          }`
      )
      .join('\n\n');

    const stateVarsFormatted = Object.entries(scenario.stateVariables)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join('\n');

    return [
      `### SCENARIO: ${scenario.title} (${scenario.category.toUpperCase()})`,
      `Description: ${scenario.description}`,
      '',
      '#### CURRENT OPERATIONAL CONTEXT & STATE',
      scenario.context,
      '',
      '#### CURRENT TELEMETRY / STATE VARIABLES',
      stateVarsFormatted,
      '',
      '#### GOALS & OBJECTIVES',
      goalsFormatted,
      '',
      '#### OPERATIONAL CONSTRAINTS',
      constraintsFormatted,
      '',
      '#### AVAILABLE ACTIONS TO CHOOSE FROM',
      actionsFormatted,
      '',
      '#### REQUIRED JSON RESPONSE FORMAT',
      JSON.stringify(
        {
          selectedAction: 'id_of_chosen_action',
          confidence: 0.95,
          riskLevel: 'medium',
          riskRationale: 'Explanation of operational risk and why this level was assigned...',
          thoughtProcess:
            'Detailed step-by-step reasoning evaluating telemetry, goals, constraints and trade-offs...',
          rejectedAlternatives: [
            {
              actionId: 'id_of_alternative',
              reason: 'Why this alternative was suboptimal or violated constraints...'
            }
          ],
          contingencyPlan:
            'Trigger immediate failover if error rates exceed 5% after action execution...'
        },
        null,
        2
      )
    ].join('\n');
  }
}
