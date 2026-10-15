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

    // Salvar JSON
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    // Gerar e salvar Markdown
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

    lines.push(`# 🧠 Relatório de Benchmark - Simulador de Decisão LLM`);
    lines.push(`**Gerado em:** ${report.generatedAt}`);
    lines.push(`**Total de Simulações:** ${report.totalRuns}`);
    lines.push(`**Modelos Testados:** ${report.modelsTested.join(', ')}`);
    lines.push('');
    lines.push('## Resumo de Desempenho por Modelo');
    lines.push('');
    lines.push(
      '| Modelo | Execuções | Schema Válido % | Restrições Cumpridas % | Ação Ótima % | Score Médio | Latência Média |'
    );
    lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

    for (const [model, s] of Object.entries(report.modelSummaries)) {
      lines.push(
        `| **${model}** | ${s.runsCount} | ${s.schemaPassRate}% | ${s.hardConstraintPassRate}% | ${s.optimalActionRate}% | **${s.averageTotalScore}/100** | ${s.averageLatencyMs}ms |`
      );
    }

    lines.push('');
    lines.push('## Execuções Detalhadas dos Cenários');
    lines.push('');

    for (const r of report.results) {
      lines.push(`### Cenário: ${r.scenarioTitle} (\`${r.scenarioId}\`)`);
      lines.push(`- **Modelo:** \`${r.model}\``);
      lines.push(`- **Latência:** ${r.evaluation.latencyMs}ms`);
      lines.push(`- **Score Total:** ${r.evaluation.totalScore}/100`);
      lines.push(
        `- **Respeitou Restrições Rígidas:** ${r.evaluation.passedHardConstraints ? '✅ Sim' : '❌ NÃO'}`
      );
      lines.push(`- **Ação Ótima Selecionada:** ${r.evaluation.isOptimal ? '✅ Sim' : '⚠️ Não'}`);

      if (r.decision) {
        lines.push(`- **Ação Escolhida:** \`${r.decision.selectedAction}\``);
        lines.push(`- **Confiança:** ${(r.decision.confidence * 100).toFixed(1)}%`);
        lines.push(`- **Nível de Risco:** \`${r.decision.riskLevel}\``);
        lines.push(`- **Linha de Raciocínio:** ${r.decision.thoughtProcess}`);
        lines.push(`- **Plano de Contingência:** ${r.decision.contingencyPlan || 'Nenhum'}`);
      }

      lines.push('');
      lines.push('#### Feedbacks da Avaliação:');
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
