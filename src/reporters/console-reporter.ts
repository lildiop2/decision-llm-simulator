import chalk from 'chalk';
import Table from 'cli-table3';
import type { BenchmarkReport, SimulationStepResult } from '../types/schemas.js';
import type { EnvironmentTurnResult } from '../engine/environment.js';

export class ConsoleReporter {
  /**
   * Prints the header banner for the simulator.
   */
  public static printHeader(): void {
    console.log(chalk.bold.cyan('\n======================================================'));
    console.log(chalk.bold.magenta('       🧠 DECISION LLM SIMULATOR (TS + Zod + Ollama)'));
    console.log(chalk.gray('  High-Stakes Decision Benchmarking & Environment Simulation'));
    console.log(chalk.bold.cyan('======================================================\n'));
  }

  /**
   * Prints a formatted simulation step result.
   */
  public static printStepResult(result: SimulationStepResult): void {
    const { scenarioTitle, model, decision, evaluation } = result;

    console.log(chalk.bold.blue(`\n▶ Scenario: `) + chalk.white.bold(scenarioTitle));
    console.log(
      chalk.bold.gray(`  Model: `) +
        chalk.yellow(model) +
        chalk.gray(` | Latency: ${evaluation.latencyMs}ms`)
    );

    if (decision) {
      console.log(chalk.bold('\n── [Model Decision] ───────────────────────────────────'));
      console.log(chalk.cyan('Action Chosen: ') + chalk.bold.green(decision.selectedAction));
      console.log(
        chalk.cyan('Confidence:    ') +
          chalk.yellow(`${(decision.confidence * 100).toFixed(1)}%`) +
          chalk.cyan(' | Risk Level: ') +
          this.formatRiskLevel(decision.riskLevel)
      );
      console.log(chalk.cyan('Risk Rationale: ') + chalk.white(decision.riskRationale));
      console.log(chalk.cyan('Thought Process: ') + chalk.italic.gray(decision.thoughtProcess));

      if ((decision.rejectedAlternatives?.length ?? 0) > 0) {
        console.log(chalk.cyan('Rejected Alternatives:'));
        for (const alt of decision.rejectedAlternatives ?? []) {
          console.log(`  • ${chalk.yellow(alt.actionId)}: ${chalk.gray(alt.reason)}`);
        }
      }

      console.log(chalk.cyan('Contingency Plan: ') + chalk.white(decision.contingencyPlan));
    } else {
      console.log(chalk.red.bold('\n❌ Model failed to produce a structured decision schema!'));
    }

    console.log(chalk.bold('\n── [Automated Evaluation & Scoring] ────────────────────'));
    const scoreColor =
      evaluation.totalScore >= 80
        ? chalk.green
        : evaluation.totalScore >= 50
          ? chalk.yellow
          : chalk.red;
    console.log(
      chalk.bold('Total Score:       ') + scoreColor.bold(`${evaluation.totalScore}/100`)
    );
    console.log(
      chalk.bold('Constraint Check:  ') +
        (evaluation.passedHardConstraints
          ? chalk.green('✔ Passed all hard constraints')
          : chalk.red.bold('✖ VIOLATED HARD CONSTRAINT'))
    );
    console.log(
      chalk.bold('Optimality:        ') +
        (evaluation.isOptimal
          ? chalk.green('✔ Optimal Action Selected')
          : evaluation.isAcceptable
            ? chalk.yellow('⚠ Acceptable Alternative Selected')
            : chalk.red('✖ Suboptimal / Ineffective Action'))
    );

    console.log(chalk.bold('\nFeedback & Diagnostics:'));
    for (const f of evaluation.feedback) {
      console.log(`  - ${f}`);
    }
    console.log(chalk.gray('───────────────────────────────────────────────────────\n'));
  }

  /**
   * Prints the summary table for benchmark runs across multiple models.
   */
  public static printBenchmarkReport(report: BenchmarkReport): void {
    console.log(chalk.bold.magenta('\n📊 BENCHMARK COMPARISON MATRIX'));
    console.log(chalk.gray(`Suite: ${report.suiteTitle} | Total Runs: ${report.totalRuns}\n`));

    const table = new Table({
      head: [
        chalk.cyan('Model'),
        chalk.cyan('Runs'),
        chalk.cyan('Schema %'),
        chalk.cyan('Constraints %'),
        chalk.cyan('Optimal %'),
        chalk.cyan('Avg Score'),
        chalk.cyan('Avg Latency')
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
   * Prints environmental turn progression.
   */
  public static printEnvironmentTurn(turnResult: EnvironmentTurnResult): void {
    console.log(
      chalk.bold.cyan(`\n── Turn ${turnResult.turn} Progression ──────────────────────────────`)
    );
    console.log(
      chalk.yellow('Action Executed: ') +
        chalk.bold.green(turnResult.actionTaken?.selectedAction || 'None')
    );
    console.log(chalk.white(`Outcome: ${turnResult.outcomeMessage}`));

    const m = turnResult.metrics;
    console.log(
      chalk.gray(
        `System Health: ${m.systemHealth}% | Error Rate: ${m.errorRatePercent}% | Budget: $${m.budgetRemaining} | Customer Sat: ${m.customerSatisfaction}%`
      )
    );

    if (turnResult.isResolved) {
      console.log(chalk.bold.green('\n🏆 SIMULATION SUCCESS: Incident resolved within SLA!'));
    } else if (turnResult.isFailed) {
      console.log(chalk.bold.red('\n💀 SIMULATION FAILURE: Mission failed to avert collapse!'));
    }
  }

  private static formatRiskLevel(level: string): string {
    switch (level) {
      case 'low':
        return chalk.green.bold('LOW');
      case 'medium':
        return chalk.yellow.bold('MEDIUM');
      case 'high':
        return chalk.hex('#FFA500').bold('HIGH');
      case 'critical':
        return chalk.red.bold('CRITICAL');
      default:
        return chalk.white(level);
    }
  }
}
