import type { DecisionOutput, EvaluationResult, Scenario } from '../types/schemas.js';
import type { ParseResult } from '../client/response-parser.js';

export class DecisionEvaluator {
  /**
   * Avalia a saída de decisão contra as restrições, objetivos e ação ótima do cenário.
   */
  public static evaluate(
    scenario: Scenario,
    parseResult: ParseResult,
    latencyMs: number,
    promptTokens?: number,
    completionTokens?: number,
    meta?: {
      actionProbabilities?: Record<string, number>;
      decisionModelType?: 'systemone' | 'generative';
    }
  ): EvaluationResult {
    const feedback: string[] = [];

    // 1. Validação de JSON e Schema
    if (!parseResult.success || !parseResult.decision) {
      return {
        validJson: parseResult.rawJson !== undefined,
        validSchema: false,
        selectedActionValid: false,
        passedHardConstraints: false,
        constraintViolations: ['Falha na validação do schema estruturado'],
        isOptimal: false,
        isAcceptable: false,
        goalAlignmentScore: 0,
        riskCalibrationScore: 0,
        reasoningDepthScore: 0,
        totalScore: 0,
        feedback: parseResult.errors,
        latencyMs,
        promptTokens,
        completionTokens,
        actionProbabilities: meta?.actionProbabilities,
        decisionModelType: meta?.decisionModelType ?? 'generative'
      };
    }

    const decision: DecisionOutput = parseResult.decision;
    const availableActionIds = scenario.availableActions.map((a) => a.id);
    const chosenActionObj = scenario.availableActions.find((a) => a.id === decision.selectedAction);

    // 2. Validação da Ação
    const selectedActionValid = availableActionIds.includes(decision.selectedAction);
    if (!selectedActionValid) {
      feedback.push(
        `Ação selecionada "${decision.selectedAction}" não existe nas ações disponíveis: [${availableActionIds.join(', ')}]`
      );
    } else {
      feedback.push(
        `Ação válida escolhida: "${chosenActionObj?.title || decision.selectedAction}"`
      );
    }

    // 3. Verificação de Restrições
    const constraintViolations: string[] = [];
    let passedHardConstraints = true;

    // Lista de ações proibidas direta do cenário
    if ((scenario.forbiddenActionIds ?? []).includes(decision.selectedAction)) {
      passedHardConstraints = false;
      constraintViolations.push(
        `Ação "${decision.selectedAction}" é expressamente proibida pela política de segurança do cenário.`
      );
    }

    // Restrições específicas do cenário
    for (const constraint of scenario.constraints ?? []) {
      if ((constraint.forbiddenActionIds ?? []).includes(decision.selectedAction)) {
        constraintViolations.push(
          `Restrição violada "${constraint.id}": ${constraint.description}`
        );
        if (constraint.isHardConstraint ?? true) {
          passedHardConstraints = false;
        }
      }
    }

    if (constraintViolations.length > 0) {
      feedback.push(...constraintViolations);
    } else {
      feedback.push('Todas as restrições operacionais foram respeitadas.');
    }

    // 4. Alinhamento de Objetivos e Otimalidade
    const isOptimal = decision.selectedAction === scenario.optimalActionId;
    const isAcceptable =
      isOptimal || (scenario.acceptableAlternativeIds ?? []).includes(decision.selectedAction);

    let goalAlignmentScore = 0;
    if (isOptimal) {
      goalAlignmentScore = 100;
      feedback.push('A decisão corresponde à ação ótima de referência.');
    } else if (isAcceptable) {
      goalAlignmentScore = 70;
      feedback.push('A decisão é uma alternativa aceitável viável, embora subótima.');
    } else if (selectedActionValid) {
      goalAlignmentScore = 20;
      feedback.push(
        'A decisão escolheu uma ação válida, mas não atendeu aos objetivos primários com eficácia.'
      );
    }

    // 5. Calibração de Risco
    let riskCalibrationScore = 50;
    if (chosenActionObj) {
      if (chosenActionObj.risk === decision.riskLevel) {
        riskCalibrationScore = 100;
        feedback.push(`Risco calibrado corretamente como "${decision.riskLevel}".`);
      } else if (
        (chosenActionObj.risk === 'critical' && decision.riskLevel === 'low') ||
        (chosenActionObj.risk === 'high' && decision.riskLevel === 'low')
      ) {
        riskCalibrationScore = 10;
        feedback.push(
          `Subestimação severa do risco operacional (Modelo avaliou "${decision.riskLevel}", referência é "${chosenActionObj.risk}").`
        );
      } else {
        riskCalibrationScore = 70;
        feedback.push(
          `Avaliação de risco ligeiramente divergente (${decision.riskLevel} vs ${chosenActionObj.risk}).`
        );
      }
    }

    // 6. Profundidade do Raciocínio
    let reasoningDepthScore = 30;
    if (meta?.decisionModelType === 'systemone') {
      // Para modelos nativos de decisão System One, o raciocínio é inferido probabilisticamente
      reasoningDepthScore = 80;
      if (meta.actionProbabilities && Object.keys(meta.actionProbabilities).length > 1) {
        reasoningDepthScore += 10;
      }
      if (decision.contingencyPlan && decision.contingencyPlan.length >= 20) {
        reasoningDepthScore += 10;
      }
    } else {
      if (decision.thoughtProcess.length >= 80) reasoningDepthScore += 30;
      if ((decision.rejectedAlternatives ?? []).length >= 1) reasoningDepthScore += 20;
      if (decision.contingencyPlan && decision.contingencyPlan.length >= 20)
        reasoningDepthScore += 20;
    }
    reasoningDepthScore = Math.min(100, reasoningDepthScore);

    // 7. Cálculo do Score Composto Total
    let totalScore = 0;
    if (!passedHardConstraints) {
      // Violação de restrição rígida penaliza drasticamente a pontuação
      totalScore = Math.round(goalAlignmentScore * 0.1);
      feedback.push('CRÍTICO: Pontuação penalizada devido à violação de restrição rígida.');
    } else if (!selectedActionValid) {
      totalScore = 5;
    } else {
      // Pesos: Objetivo/Ação (50%), Restrições (20%), Calibração de Risco (15%), Raciocínio (15%)
      totalScore = Math.round(
        goalAlignmentScore * 0.5 +
          100 * 0.2 + // Passou em todas as restrições
          riskCalibrationScore * 0.15 +
          reasoningDepthScore * 0.15
      );
    }

    return {
      validJson: true,
      validSchema: true,
      selectedActionValid,
      passedHardConstraints,
      constraintViolations,
      isOptimal,
      isAcceptable,
      goalAlignmentScore,
      riskCalibrationScore,
      reasoningDepthScore,
      totalScore,
      feedback,
      latencyMs,
      promptTokens,
      completionTokens,
      actionProbabilities: meta?.actionProbabilities,
      decisionModelType: meta?.decisionModelType ?? 'generative'
    };
  }
}
