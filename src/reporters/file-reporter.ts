import fs from 'node:fs/promises';
import path from 'node:path';
import type { BenchmarkReport, SimulationStepResult } from '../types/schemas.js';

export class FileReporter {
  private reportsDir: string;

  constructor(reportsDir: string = './reports') {
    this.reportsDir = reportsDir;
  }

  public async saveBenchmarkReport(
    report: BenchmarkReport
  ): Promise<{ jsonPath: string; mdPath: string }> {
    await fs.mkdir(this.reportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(this.reportsDir, `benchmark-${timestamp}.json`);
    const mdPath = path.join(this.reportsDir, `benchmark-${timestamp}.md`);

    // Save JSON
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    // Generate and save Markdown
    const markdown = this.generateMarkdown(report);
    await fs.writeFile(mdPath, markdown, 'utf-8');

    return { jsonPath, mdPath };
  }

  public async saveSingleRunReport(result: SimulationStepResult): Promise<string> {
    await fs.mkdir(this.reportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.reportsDir, `run-${result.scenarioId}-${timestamp}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
    return filePath;
  }

  private generateMarkdown(report: BenchmarkReport): string {
    const lines: string[] = [];

    lines.push(`# 🧠 Decision LLM Simulator Benchmark Report`);
    lines.push(`**Generated At:** ${report.generatedAt}`);
    lines.push(`**Total Simulation Runs:** ${report.totalRuns}`);
    lines.push(`**Models Tested:** ${report.modelsTested.join(', ')}`);
    lines.push('');
    lines.push('## Model Performance Summary');
    lines.push('');
    lines.push(
      '| Model | Runs | Schema Valid % | Constraint Compliance % | Optimal Action % | Avg Score | Avg Latency |'
    );
    lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

    for (const [model, s] of Object.entries(report.modelSummaries)) {
      lines.push(
        `| **${model}** | ${s.runsCount} | ${s.schemaPassRate}% | ${s.hardConstraintPassRate}% | ${s.optimalActionRate}% | **${s.averageTotalScore}/100** | ${s.averageLatencyMs}ms |`
      );
    }

    lines.push('');
    lines.push('## Detailed Scenario Executions');
    lines.push('');

    for (const r of report.results) {
      lines.push(`### Scenario: ${r.scenarioTitle} (\`${r.scenarioId}\`)`);
      lines.push(`- **Model:** \`${r.model}\``);
      lines.push(`- **Latency:** ${r.evaluation.latencyMs}ms`);
      lines.push(`- **Total Score:** ${r.evaluation.totalScore}/100`);
      lines.push(
        `- **Passed Hard Constraints:** ${r.evaluation.passedHardConstraints ? '✅ Yes' : '❌ NO'}`
      );
      lines.push(`- **Optimal Action Selected:** ${r.evaluation.isOptimal ? '✅ Yes' : '⚠️ No'}`);

      if (r.decision) {
        lines.push(`- **Selected Action:** \`${r.decision.selectedAction}\``);
        lines.push(`- **Confidence:** ${(r.decision.confidence * 100).toFixed(1)}%`);
        lines.push(`- **Risk Level:** \`${r.decision.riskLevel}\``);
        lines.push(`- **Reasoning:** ${r.decision.thoughtProcess}`);
        lines.push(`- **Contingency Plan:** ${r.decision.contingencyPlan}`);
      }

      lines.push('');
      lines.push('#### Evaluation Feedback:');
      for (const f of r.evaluation.feedback) {
        lines.push(`- ${f}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}
