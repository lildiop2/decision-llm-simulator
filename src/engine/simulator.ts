import { LiteLlmClient } from '../client/litellm-client.js';
import { ResponseParser } from '../client/response-parser.js';
import { PromptBuilder } from './prompt-builder.js';
import { DecisionEvaluator } from './evaluator.js';
import type {
  BenchmarkReport,
  DecisionOutput,
  Scenario,
  SimulationStepResult,
  SystemOneAnswerChoice,
  SystemOneAnswerNoul,
  SystemOneAnswerScore,
  SystemOneResponse
} from '../types/schemas.js';
import type { SimulationOptions } from '../types/index.js';
import type { EnvironmentTurnResult, IncidentManagementEnvironment } from './environment.js';

export class DecisionSimulator {
  private litellm: LiteLlmClient;

  constructor(client?: LiteLlmClient) {
    this.litellm = client || new LiteLlmClient();
  }

  public getClient(): LiteLlmClient {
    return this.litellm;
  }

  /**
   * Converte a resposta estruturada de um modelo nativo de decisão (/systemone) em um DecisionOutput.
   */
  private convertSystemOneToDecision(
    scenario: Scenario,
    data: SystemOneResponse
  ): { decision: DecisionOutput; probabilities: Record<string, number> } {
    const actionAnswer = data.answers?.selected_action as SystemOneAnswerChoice | undefined;
    const selectedAction = actionAnswer?.choice || scenario.availableActions[0]?.id || 'unknown';
    const probabilities = actionAnswer?.probabilities ?? {};
    const confidence = probabilities[selectedAction] ?? actionAnswer?.confidence ?? 0;

    const riskAnswer = data.answers?.risk_level as SystemOneAnswerScore | undefined;
    const rawScore = riskAnswer?.score ?? 1;
    const roundedScore = Math.min(3, Math.max(0, Math.round(rawScore)));
    const riskMap: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
      0: 'low',
      1: 'medium',
      2: 'high',
      3: 'critical'
    };
    const riskLevel = riskMap[roundedScore] ?? 'medium';

    const safetyAnswer = data.answers?.respects_safety as SystemOneAnswerNoul | undefined;
    const safetyScore = safetyAnswer?.noul ?? 1.0;

    const sortedAlts = Object.entries(probabilities)
      .filter(([id]) => id !== selectedAction)
      .sort((a, b) => b[1] - a[1]);

    const secondBest = sortedAlts[0];

    const rejectedAlternatives = sortedAlts.map(([actionId, prob]) => {
      const actionObj = scenario.availableActions.find((a) => a.id === actionId);
      const title = actionObj ? actionObj.title : actionId;
      return {
        actionId,
        reason: `Probabilidade inferior calculada pelo modelo: ${(prob * 100).toFixed(2)}% (${title})`
      };
    });

    const contingencyPlan = secondBest
      ? `Se "${selectedAction}" falhar ou encontrar bloqueio, acionar alternativa com maior probabilidade residual: "${secondBest[0]}" (${(secondBest[1] * 100).toFixed(2)}%).`
      : 'Monitorar telemetria continuamente durante a execução.';

    const probSummary = Object.entries(probabilities)
      .sort((a, b) => b[1] - a[1])
      .map(([id, p]) => `${id}: ${(p * 100).toFixed(1)}%`)
      .join(', ');

    const thoughtProcess = [
      `Modelo de Decisão System One avaliou ${Object.keys(probabilities).length} alternativas operacionais.`,
      `Ação "${selectedAction}" obteve a maior distribuição de probabilidade (${(confidence * 100).toFixed(1)}%).`,
      probSummary ? `Distribuição calculada: ${probSummary}.` : ''
    ]
      .filter(Boolean)
      .join(' ');

    const riskRationale = `Avaliação probabilística calibrada via System One. Score de risco operacional: ${rawScore.toFixed(2)} (${riskLevel.toUpperCase()}). Índice de conformidade de segurança: ${(safetyScore * 100).toFixed(1)}%.`;

    const decision: DecisionOutput = {
      selectedAction,
      confidence,
      riskLevel,
      riskRationale,
      thoughtProcess,
      rejectedAlternatives,
      contingencyPlan
    };

    return { decision, probabilities };
  }

  /**
   * Executa a simulação de decisão de um cenário usando o LiteLLM Proxy.
   * Roteia automaticamente ou explicitamente para /systemone ou /decision.
   */
  public async runScenario(
    scenario: Scenario,
    options: SimulationOptions
  ): Promise<SimulationStepResult> {
    const endpointType = this.litellm.resolveEndpointType(options.model, options.endpoint);

    if (endpointType === 'systemone') {
      const request = PromptBuilder.buildSystemOneRequest(scenario, options.model);
      const executeResult = await this.litellm.executeSystemOne(request, options.timeoutMs);

      const { decision, probabilities } = this.convertSystemOneToDecision(
        scenario,
        executeResult.response
      );

      const evaluation = DecisionEvaluator.evaluate(
        scenario,
        {
          success: true,
          decision,
          rawJson: decision,
          cleanedText: JSON.stringify(decision),
          errors: []
        },
        executeResult.totalDurationMs,
        executeResult.inputTokens,
        executeResult.outputTokens,
        {
          actionProbabilities: probabilities,
          decisionModelType: 'systemone'
        }
      );

      return {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        model: options.model,
        timestamp: new Date().toISOString(),
        decision,
        evaluation,
        rawOutput: JSON.stringify(executeResult.response, null, 2)
      };
    }

    // Caso padrão: endpoint /decision do LiteLLM Proxy
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildScenarioPrompt(scenario);

    const generateResult = await this.litellm.generateDecision(
      userPrompt,
      systemPrompt,
      options,
      scenario
    );

    const parseResult = ResponseParser.parse(generateResult.response);

    const evaluation = DecisionEvaluator.evaluate(
      scenario,
      parseResult,
      generateResult.totalDurationMs,
      generateResult.promptTokens,
      generateResult.completionTokens,
      {
        decisionModelType: 'generative'
      }
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
   * Executa uma matriz de benchmark comparativa entre múltiplos cenários e modelos no LiteLLM Proxy.
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
          litellmHost: baseOptions.litellmHost,
          apiKey: baseOptions.apiKey,
          endpoint: baseOptions.endpoint,
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

      const endpointType = this.litellm.resolveEndpointType(model, baseOptions.endpoint);
      modelSummaries[model] = {
        runsCount: runCount,
        schemaPassRate: Math.round((schemaPasses / (runCount || 1)) * 100),
        hardConstraintPassRate: Math.round((hardConstraintPasses / (runCount || 1)) * 100),
        optimalActionRate: Math.round((optimalChoices / (runCount || 1)) * 100),
        averageTotalScore: Math.round(totalScores / (runCount || 1)),
        averageLatencyMs: Math.round(totalLatency / (runCount || 1)),
        modelType: endpointType === 'systemone' ? 'systemone' : 'generative'
      };
    }

    return {
      suiteTitle: 'Decision-Making LLM Benchmark (LiteLLM Proxy)',
      generatedAt: new Date().toISOString(),
      modelsTested: models,
      totalRuns: results.length,
      results,
      modelSummaries
    };
  }

  /**
   * Executa uma simulação dinâmica multi-turno de ambiente com o modelo selecionado.
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
          `O modelo ${options.model} falhou em gerar um schema de decisão válido no turno ${env.getTurn() + 1}`
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
