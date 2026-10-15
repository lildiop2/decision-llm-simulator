import chalk from 'chalk';
import Table from 'cli-table3';
import type { BenchmarkReport, SimulationStepResult } from '../types/schemas.js';
import type { EnvironmentTurnResult } from '../engine/environment.js';

export class ConsoleReporter {
  /**
   * Imprime o banner de cabeçalho do simulador.
   */
  public static printHeader(): void {
    console.log(chalk.bold.cyan('\n======================================================'));
    console.log(
      chalk.bold.magenta('       🧠 SIMULADOR DE MODELOS DE DECISÃO (TS + Zod + Ollama)')
    );
    console.log(chalk.gray('  Benchmarking de Decisões de Alto Impacto & Simulação de Ambientes'));
    console.log(chalk.bold.cyan('======================================================\n'));
  }

  /**
   * Imprime o resultado formatado de um passo de simulação.
   */
  public static printStepResult(result: SimulationStepResult): void {
    const { scenarioTitle, model, decision, evaluation } = result;

    const modelTypeBadge =
      evaluation.decisionModelType === 'systemone'
        ? chalk.bgMagenta.white.bold(' 🧠 SYSTEM ONE (?c=decision) ')
        : chalk.bgBlue.white(' GENERATIVE LLM ');

    console.log(chalk.bold.blue(`\n▶ Cenário: `) + chalk.white.bold(scenarioTitle));
    console.log(
      chalk.bold.gray(`  Modelo: `) +
        chalk.yellow(model) +
        ' ' +
        modelTypeBadge +
        chalk.gray(` | Latência: ${evaluation.latencyMs}ms`)
    );

    if (evaluation.actionProbabilities && Object.keys(evaluation.actionProbabilities).length > 0) {
      console.log(
        chalk.bold('\n── [Distribuição Probabilística de Ações - System One] ──────────')
      );
      const entries = Object.entries(evaluation.actionProbabilities).sort((a, b) => b[1] - a[1]);
      const maxActionLen = Math.max(...entries.map(([k]) => k.length), 10);
      const barWidth = 24;

      for (const [actionId, prob] of entries) {
        const percentage = (prob * 100).toFixed(1);
        const filled = Math.round(prob * barWidth);
        const empty = Math.max(0, barWidth - filled);
        const isChosen = actionId === decision?.selectedAction;

        const bar = isChosen
          ? chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))
          : chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

        const label = actionId.padEnd(maxActionLen, ' ');
        const tag = isChosen ? chalk.green.bold(' [ESCOLHIDA]') : '';

        console.log(`  ${label} [${bar}] ${percentage.padStart(5, ' ')}%${tag}`);
      }
    }

    if (decision) {
      console.log(chalk.bold('\n── [Decisão do Modelo] ───────────────────────────────────'));
      console.log(
        chalk.cyan('Ação Escolhida:        ') + chalk.bold.green(decision.selectedAction)
      );
      console.log(
        chalk.cyan('Confiança:             ') +
          chalk.yellow(`${(decision.confidence * 100).toFixed(1)}%`) +
          chalk.cyan(' | Nível de Risco: ') +
          this.formatRiskLevel(decision.riskLevel)
      );
      console.log(chalk.cyan('Justificativa de Risco: ') + chalk.white(decision.riskRationale));
      console.log(
        chalk.cyan('Linha de Raciocínio:   ') + chalk.italic.gray(decision.thoughtProcess)
      );

      if ((decision.rejectedAlternatives?.length ?? 0) > 0) {
        console.log(chalk.cyan('Alternativas Rejeitadas:'));
        for (const alt of decision.rejectedAlternatives ?? []) {
          console.log(`  • ${chalk.yellow(alt.actionId)}: ${chalk.gray(alt.reason)}`);
        }
      }

      console.log(
        chalk.cyan('Plano de Contingência: ') +
          chalk.white(decision.contingencyPlan || 'Nenhum declarado')
      );
    } else {
      console.log(chalk.red.bold('\n❌ O modelo falhou ao gerar um schema de decisão válido!'));
    }

    console.log(chalk.bold('\n── [Avaliação e Pontuação Automatizada] ────────────────────'));
    const scoreColor =
      evaluation.totalScore >= 80
        ? chalk.green
        : evaluation.totalScore >= 50
          ? chalk.yellow
          : chalk.red;
    console.log(
      chalk.bold('Pontuação Total:          ') + scoreColor.bold(`${evaluation.totalScore}/100`)
    );
    console.log(
      chalk.bold('Checagem de Restrições:   ') +
        (evaluation.passedHardConstraints
          ? chalk.green('✔ Respeitou todas as restrições rígidas')
          : chalk.red.bold('✖ VIOLOU RESTRIÇÃO RÍGIDA'))
    );
    console.log(
      chalk.bold('Otimalidade da Escolha:   ') +
        (evaluation.isOptimal
          ? chalk.green('✔ Ação Ótima Selecionada')
          : evaluation.isAcceptable
            ? chalk.yellow('⚠ Alternativa Aceitável Selecionada')
            : chalk.red('✖ Ação Subótima ou Ineficaz'))
    );

    console.log(chalk.bold('\nDiagnósticos e Feedbacks:'));
    for (const f of evaluation.feedback) {
      console.log(`  - ${f}`);
    }
    console.log(chalk.gray('───────────────────────────────────────────────────────\n'));
  }

  /**
   * Imprime a tabela de resumo para execuções de benchmark entre múltiplos modelos.
   */
  public static printBenchmarkReport(report: BenchmarkReport): void {
    console.log(chalk.bold.magenta('\n📊 MATRIZ COMPARATIVA DE BENCHMARK'));
    console.log(
      chalk.gray(`Conjunto: ${report.suiteTitle} | Total de Execuções: ${report.totalRuns}\n`)
    );

    const table = new Table({
      head: [
        chalk.cyan('Modelo'),
        chalk.cyan('Tipo'),
        chalk.cyan('Execuções'),
        chalk.cyan('Schema %'),
        chalk.cyan('Restrições %'),
        chalk.cyan('Ótima %'),
        chalk.cyan('Score Médio'),
        chalk.cyan('Latência Média')
      ],
      style: { head: [], border: [] }
    });

    for (const [model, summary] of Object.entries(report.modelSummaries)) {
      const scoreColor =
        summary.averageTotalScore >= 80
          ? chalk.green
          : summary.averageTotalScore >= 50
            ? chalk.yellow
            : chalk.red;

      table.push([
        chalk.yellow.bold(model),
        summary.modelType === 'systemone'
          ? chalk.magenta.bold('System One')
          : chalk.blue('Generative'),
        summary.runsCount.toString(),
        `${summary.schemaPassRate}%`,
        summary.hardConstraintPassRate === 100
          ? chalk.green('100%')
          : chalk.red(`${summary.hardConstraintPassRate}%`),
        `${summary.optimalActionRate}%`,
        scoreColor.bold(`${summary.averageTotalScore}/100`),
        `${summary.averageLatencyMs}ms`
      ]);
    }

    console.log(table.toString());
  }

  /**
   * Imprime a progressão de cada turno da simulação de ambiente.
   */
  public static printEnvironmentTurn(turnResult: EnvironmentTurnResult): void {
    console.log(
      chalk.bold.cyan(`\n── Progressão do Turno ${turnResult.turn} ──────────────────────────────`)
    );
    console.log(
      chalk.yellow('Ação Executada: ') +
        chalk.bold.green(turnResult.actionTaken?.selectedAction || 'Nenhuma')
    );
    console.log(chalk.white(`Desfecho: ${turnResult.outcomeMessage}`));

    const m = turnResult.metrics;
    console.log(
      chalk.gray(
        `Saúde do Sistema: ${m.systemHealth}% | Taxa de Erros: ${m.errorRatePercent}% | Orçamento: $${m.budgetRemaining} | Satisfação: ${m.customerSatisfaction}%`
      )
    );

    if (turnResult.isResolved) {
      console.log(chalk.bold.green('\n🏆 SUCESSO DA SIMULAÇÃO: Incidente mitigado dentro do SLA!'));
    } else if (turnResult.isFailed) {
      console.log(
        chalk.bold.red('\n💀 FALHA NA SIMULAÇÃO: Missão falhou em evitar o colapso operacional!')
      );
    }
  }

  private static formatRiskLevel(level: string): string {
    switch (level) {
      case 'low':
        return chalk.green.bold('BAIXO');
      case 'medium':
        return chalk.yellow.bold('MÉDIO');
      case 'high':
        return chalk.hex('#FFA500').bold('ALTO');
      case 'critical':
        return chalk.red.bold('CRÍTICO');
      default:
        return chalk.white(level);
    }
  }
}
