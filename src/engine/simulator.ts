import { OllamaClient } from '../client/ollama-client.js';
import { ResponseParser } from '../client/response-parser.js';
import { PromptBuilder } from './prompt-builder.js';
import { DecisionEvaluator } from './evaluator.js';
import type { BenchmarkReport, Scenario, SimulationStepResult } from '../types/schemas.js';
import type { SimulationOptions } from '../types/index.js';
import type { EnvironmentTurnResult, IncidentManagementEnvironment } from './environment.js';

export class DecisionSimulator {
  private ollama: OllamaClient;

  constructor(client?: OllamaClient) {
    this.ollama = client || new OllamaClient();
  }

  public getClient(): OllamaClient {
    return this.ollama;
  }

  /**
   * Executes a single scenario simulation run for a given model.
   */
  public async runScenario(
    scenario: Scenario,
    options: SimulationOptions
  ): Promise<SimulationStepResult> {
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildScenarioPrompt(scenario);

    const generateResult = await this.ollama.generateDecision(userPrompt, systemPrompt, options);

    const parseResult = ResponseParser.parse(generateResult.response);

    const evaluation = DecisionEvaluator.evaluate(
      scenario,
      parseResult,
      generateResult.totalDurationMs,
      generateResult.promptTokens,
      generateResult.completionTokens
    );

    return {
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      model: options.model,
      timestamp: new Date().toISOString(),
      decision: parseResult.decision,
      evaluation,
      rawOutput: generateResult.response
    };
  }

  /**
   * Runs a comparative benchmark matrix across multiple scenarios and models.
   */
  public async runBenchmark(
    scenarios: Scenario[],
    models: string[],
    baseOptions: Partial<SimulationOptions> = {}
  ): Promise<BenchmarkReport> {
    const results: SimulationStepResult[] = [];
    const modelSummaries: BenchmarkReport['modelSummaries'] = {};

    for (const model of models) {
      let schemaPasses = 0;
      let hardConstraintPasses = 0;
      let optimalChoices = 0;
      let totalScores = 0;
      let totalLatency = 0;
      let runCount = 0;

      for (const scenario of scenarios) {
        const stepResult = await this.runScenario(scenario, {
          model,
          ollamaHost: baseOptions.ollamaHost,
          temperature: baseOptions.temperature ?? 0.1,
          timeoutMs: baseOptions.timeoutMs ?? 60000,
          ...baseOptions
        });

        results.push(stepResult);
        runCount++;

        if (stepResult.evaluation.validSchema) schemaPasses++;
        if (stepResult.evaluation.passedHardConstraints) hardConstraintPasses++;
        if (stepResult.evaluation.isOptimal) optimalChoices++;
        totalScores += stepResult.evaluation.totalScore;
        totalLatency += stepResult.evaluation.latencyMs;
      }

      modelSummaries[model] = {
        runsCount: runCount,
        schemaPassRate: Math.round((schemaPasses / (runCount || 1)) * 100),
        hardConstraintPassRate: Math.round((hardConstraintPasses / (runCount || 1)) * 100),
        optimalActionRate: Math.round((optimalChoices / (runCount || 1)) * 100),
        averageTotalScore: Math.round(totalScores / (runCount || 1)),
        averageLatencyMs: Math.round(totalLatency / (runCount || 1))
      };
    }

    return {
      suiteTitle: 'Decision-Making LLM Benchmark',
      generatedAt: new Date().toISOString(),
      modelsTested: models,
      totalRuns: results.length,
      results,
      modelSummaries
    };
  }

  /**
   * Executes a multi-turn dynamic environment simulation with the given model.
   */
  public async runEnvironmentSimulation(
    env: IncidentManagementEnvironment,
    options: SimulationOptions,
    onTurnStep?: (turnResult: EnvironmentTurnResult) => void
  ): Promise<EnvironmentTurnResult[]> {
    const history: EnvironmentTurnResult[] = [];

    while (env.getTurn() < 4) {
      const currentScenario = env.getCurrentScenario();
      const stepResult = await this.runScenario(currentScenario, options);

      if (!stepResult.decision) {
        throw new Error(
          `Model ${options.model} failed to produce a valid decision schema in turn ${env.getTurn() + 1}`
        );
      }

      const turnOutcome = env.step(stepResult.decision);
      history.push(turnOutcome);

      if (onTurnStep) {
        onTurnStep(turnOutcome);
      }

      if (turnOutcome.isResolved || turnOutcome.isFailed) {
        break;
      }
    }

    return history;
  }
}
