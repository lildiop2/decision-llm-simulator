import type { Scenario } from '../types/schemas.js';

export class PromptBuilder {
  /**
   * Generates a strict system prompt tailored for Decision-Making Models in Portuguese.
   */
  public static buildSystemPrompt(): string {
    return [
      'Você é uma inteligência autônoma especialista em tomada de decisão operacional em ambientes críticos e de alto impacto.',
      'Sua função é avaliar cenários com rigor, ponderar objetivos conflitantes, respeitar restrições operacionais e selecionar a ação ideal.',
      '',
      'REGRAS CRÍTICAS:',
      '1. Você DEVE responder ESTRITAMENTE em formato JSON compatível com o schema solicitado.',
      '2. Restrições rígidas (HARD CONSTRAINTS) NUNCA podem ser violadas. Qualquer escolha que viole uma restrição rígida é falha catastrófica.',
      '3. Detalhe claramente sua linha de raciocínio e análise de trade-offs no campo "thoughtProcess" em português.',
      '4. Forneça uma estimativa realista de confiança (0.0 a 1.0) e classifique o "riskLevel" ("low", "medium", "high", "critical").',
      '5. Justifique explicitamente por que alternativas foram descartadas em "rejectedAlternatives".',
      '6. Defina um plano de contingência acionável em "contingencyPlan" caso o ambiente degrade de forma imprevista.',
      '7. Não inclua blocos markdown fora do JSON. Retorne apenas o objeto JSON puro.'
    ].join('\n');
  }

  /**
   * Builds the scenario observation prompt for the model in Portuguese.
   */
  public static buildScenarioPrompt(scenario: Scenario): string {
    const priorityLabels: Record<string, string> = {
      primary: 'PRIMÁRIO',
      secondary: 'SECUNDÁRIO',
      tertiary: 'TERCIÁRIO'
    };

    const goalsFormatted = scenario.goals
      .map((g) => `- [${priorityLabels[g.priority] || g.priority.toUpperCase()}] ${g.description}`)
      .join('\n');

    const constraintsFormatted =
      (scenario.constraints?.length ?? 0) > 0
        ? (scenario.constraints ?? [])
            .map(
              (c) =>
                `- ${c.isHardConstraint ? '🚨 [RESTRIÇÃO RÍGIDA]' : '⚠️ [RESTRIÇÃO SUAVE]'} ${c.description}`
            )
            .join('\n')
        : 'Nenhuma restrição declarada explicitamente.';

    const actionsFormatted = scenario.availableActions
      .map(
        (a) =>
          `* ID da Ação: "${a.id}"\n  Título: ${a.title}\n  Descrição: ${a.description}\n  Risco: ${a.risk} | Custo: ${a.cost ?? 0}${
            a.expectedImpact ? ` | Impacto Esperado: ${a.expectedImpact}` : ''
          }`
      )
      .join('\n\n');

    const stateVarsFormatted = Object.entries(scenario.stateVariables)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join('\n');

    return [
      `### CENÁRIO: ${scenario.title} (${scenario.category.toUpperCase()})`,
      `Descrição: ${scenario.description}`,
      '',
      '#### CONTEXTO OPERACIONAL E ESTADO ATUAL',
      scenario.context,
      '',
      '#### TELEMETRIA / VARIÁVEIS DE ESTADO',
      stateVarsFormatted,
      '',
      '#### OBJETIVOS',
      goalsFormatted,
      '',
      '#### RESTRIÇÕES OPERACIONAIS',
      constraintsFormatted,
      '',
      '#### AÇÕES DISPONÍVEIS PARA ESCOLHA',
      actionsFormatted,
      '',
      '#### FORMATO OBRIGATÓRIO DE RESPOSTA JSON',
      JSON.stringify(
        {
          selectedAction: 'id_da_acao_escolhida',
          confidence: 0.95,
          riskLevel: 'medium',
          riskRationale: 'Justificativa do risco operacional e por que esse nível foi atribuído...',
          thoughtProcess:
            'Raciocínio detalhado avaliando telemetria, objetivos, restrições e trade-offs...',
          rejectedAlternatives: [
            {
              actionId: 'id_da_alternativa',
              reason: 'Por que esta alternativa foi descartada ou violou restrições...'
            }
          ],
          contingencyPlan:
            'Acionar failover imediato caso a taxa de erros ultrapasse 5% após execução...'
        },
        null,
        2
      )
    ].join('\n');
  }
}
