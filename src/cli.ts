#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { LiteLlmClient } from './client/litellm-client.js';
import { DecisionSimulator } from './engine/simulator.js';
import { ConsoleReporter } from './reporters/console-reporter.js';
import { FileReporter } from './reporters/file-reporter.js';
import { getAllScenarios, getScenarioById } from './scenarios/index.js';
import { IncidentManagementEnvironment } from './engine/environment.js';
import { runInteractiveCli } from './interactive.js';

dotenv.config();

const DEFAULT_LITELLM_HOST =
  process.env.LITELLM_HOST || process.env.LITELLM_BASE_URL || 'http://localhost:4000';

const DEFAULT_LITELLM_KEY = process.env.LITELLM_API_KEY || '';

const DEFAULT_MODEL = process.env.LITELLM_MODEL || 'decision-model';

const program = new Command();

program
  .name('decision-sim')
  .description('Simulador e Avaliador de Modelos de Decisão usando LiteLLM Proxy, TypeScript e Zod')
  .version('2.0.0')
  .option('-i, --interactive', 'Executar em modo wizard interativo com Inquirer');

// 1. Comando: interactive / wizard
program
  .command('interactive')
  .alias('wizard')
  .description('Iniciar o assistente interativo guiado (Inquirer + Chalk) do simulador')
  .option('-H, --host <url>', 'URL do LiteLLM Proxy', DEFAULT_LITELLM_HOST)
  .option('-k, --key <token>', 'API Key do LiteLLM Proxy', DEFAULT_LITELLM_KEY)
  .action(async (options) => {
    await runInteractiveCli({ host: options.host, apiKey: options.key });
  });

// 2. Comando: list-models
program
  .command('list-models')
  .description(
    'Listar todos os modelos disponíveis no LiteLLM Proxy e seus endpoints (/decision, /systemone)'
  )
  .option('-H, --host <url>', 'URL do LiteLLM Proxy', DEFAULT_LITELLM_HOST)
  .option('-k, --key <token>', 'API Key do LiteLLM Proxy', DEFAULT_LITELLM_KEY)
  .action(async (options) => {
    ConsoleReporter.printHeader();
    const client = new LiteLlmClient(options.host, options.key);

    const spinner = ora(`Verificando conexão com o LiteLLM Proxy em ${options.host}...`).start();
    const isHealthy = await client.isHealthy();

    if (!isHealthy) {
      spinner.fail(
        chalk.red(
          `Não foi possível conectar ao LiteLLM Proxy em ${options.host}. O serviço está ativo?`
        )
      );
      process.exit(1);
    }

    spinner.text = 'Buscando catálogo de modelos no LiteLLM Proxy...';
    try {
      const models = await client.listModels();
      spinner.succeed(`Encontrado(s) ${models.length} modelo(s) no LiteLLM Proxy:\n`);

      for (const m of models) {
        const supportsSystemOne = m.endpoints.includes('systemone');
        const badgeDecision = chalk.bgBlue.white.bold(' /decision ');
        const badgeSysOne = supportsSystemOne
          ? chalk.bgMagenta.white.bold(' /systemone ')
          : chalk.gray(' [apenas /decision] ');

        console.log(`• ${chalk.yellow.bold(m.id)}  ${badgeDecision} ${badgeSysOne}`);
        if (m.owned_by) {
          console.log(chalk.gray(`  Provedor / Dono: ${m.owned_by}`));
        }
        console.log(
          chalk.gray(`  Capacidades mapeadas: [${m.capabilities?.join(', ') || 'decision'}]\n`)
        );
      }
    } catch (err: unknown) {
      spinner.fail(`Erro ao listar modelos: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// 3. Comando: list-scenarios
program
  .command('list-scenarios')
  .description('Listar todos os cenários operacionais de decisão integrados')
  .action(() => {
    ConsoleReporter.printHeader();
    const scenarios = getAllScenarios();

    console.log(
      chalk.bold.cyan(`Encontrados ${scenarios.length} cenários operacionais de decisão:\n`)
    );

    for (const s of scenarios) {
      console.log(chalk.bold.yellow(`[${s.id}]`) + ' ' + chalk.white.bold(s.title));
      console.log(
        chalk.gray(
          `Categoria: ${s.category.toUpperCase()} | Ações: ${s.availableActions.length} | Restrições: ${s.constraints?.length ?? 0}`
        )
      );
      console.log(chalk.gray(`Descrição: ${s.description}`));
      console.log(chalk.gray(`Tags: ${(s.tags ?? []).join(', ')}\n`));
    }
  });

// 4. Comando: run
program
  .command('run [scenarioId] [model]')
  .description('Executar simulação de decisão para um cenário específico via LiteLLM Proxy')
  .option('-m, --model <name>', 'Modelo no LiteLLM Proxy a utilizar', DEFAULT_MODEL)
  .option('-H, --host <url>', 'URL do LiteLLM Proxy', DEFAULT_LITELLM_HOST)
  .option('-k, --key <token>', 'API Key do LiteLLM Proxy', DEFAULT_LITELLM_KEY)
  .option(
    '-e, --endpoint <type>',
    'Endpoint do LiteLLM Proxy a utilizar ("auto", "decision", "systemone")',
    'auto'
  )
  .option('-t, --temperature <number>', 'Temperatura de amostragem', '0.2')
  .option('-s, --save', 'Salvar relatório de execução no diretório reports/', false)
  .option('-i, --interactive', 'Executar via wizard interativo', false)
  .action(async (scenarioId, modelArg, options) => {
    if (options.interactive) {
      await runInteractiveCli({ host: options.host, apiKey: options.key });
      return;
    }

    ConsoleReporter.printHeader();

    const targetId = scenarioId || 'incident_database_failover';
    const targetModel = modelArg || options.model || DEFAULT_MODEL;
    const scenario = getScenarioById(targetId);

    if (!scenario) {
      console.error(
        chalk.red(
          `Erro: Cenário "${targetId}" não encontrado. Execute "decision-sim list-scenarios" para consultar cenários válidos.`
        )
      );
      process.exit(1);
    }

    const client = new LiteLlmClient(options.host, options.key);
    const simulator = new DecisionSimulator(client);

    const spinner = ora(
      `Executando cenário "${scenario.title}" com o modelo "${targetModel}" via LiteLLM Proxy...`
    ).start();

    try {
      const result = await simulator.runScenario(scenario, {
        model: targetModel,
        endpoint: options.endpoint,
        temperature: parseFloat(options.temperature),
        litellmHost: options.host,
        apiKey: options.key
      });

      spinner.succeed(`Avaliação de decisão concluída em ${result.evaluation.latencyMs}ms!`);

      ConsoleReporter.printStepResult(result);

      if (options.save) {
        const fileReporter = new FileReporter();
        const savedPath = await fileReporter.saveSingleRunReport(result);
        console.log(chalk.green(`✔ Relatório salvo em: ${savedPath}`));
      }
    } catch (err: unknown) {
      spinner.fail(`Falha na simulação: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// 5. Comando: benchmark
program
  .command('benchmark [models] [scenarios]')
  .description('Executar matriz comparativa de benchmark entre múltiplos modelos e cenários')
  .option(
    '-m, --models <names>',
    'Lista de modelos separados por vírgula',
    'decision-model,tev1:0.8b'
  )
  .option('-H, --host <url>', 'URL do LiteLLM Proxy', DEFAULT_LITELLM_HOST)
  .option('-k, --key <token>', 'API Key do LiteLLM Proxy', DEFAULT_LITELLM_KEY)
  .option('-e, --endpoint <type>', 'Endpoint a forçar ("auto", "decision", "systemone")', 'auto')
  .option('-t, --temperature <number>', 'Temperatura de amostragem', '0.1')
  .option('-s, --scenarios <ids>', 'IDs dos cenários separados por vírgula (ou "all")', 'all')
  .action(async (modelsArg, scenariosArg, options) => {
    ConsoleReporter.printHeader();

    const rawModels = modelsArg || options.models || 'decision-model,tev1:0.8b';
    const rawScenarios = scenariosArg || options.scenarios || 'all';

    const modelsList = rawModels.split(',').map((m: string) => m.trim());
    let scenariosToRun = getAllScenarios();

    if (rawScenarios !== 'all') {
      const requestedIds = rawScenarios.split(',').map((id: string) => id.trim());
      scenariosToRun = scenariosToRun.filter((s) => requestedIds.includes(s.id));
    }

    console.log(
      chalk.cyan(
        `Iniciando benchmark para ${modelsList.length} modelo(s) em ${scenariosToRun.length} cenário(s) via LiteLLM Proxy...\n`
      )
    );

    const client = new LiteLlmClient(options.host, options.key);
    const simulator = new DecisionSimulator(client);
    const spinner = ora('Executando matriz de benchmark no LiteLLM Proxy...').start();

    try {
      const report = await simulator.runBenchmark(scenariosToRun, modelsList, {
        litellmHost: options.host,
        apiKey: options.key,
        endpoint: options.endpoint,
        temperature: parseFloat(options.temperature)
      });

      spinner.succeed('Execução da matriz de benchmark finalizada com sucesso!');
      ConsoleReporter.printBenchmarkReport(report);

      const fileReporter = new FileReporter();
      const { jsonPath, mdPath } = await fileReporter.saveBenchmarkReport(report);
      console.log(chalk.green(`\n✔ Relatórios salvos:`));
      console.log(`  • Markdown: ${chalk.bold(mdPath)}`);
      console.log(`  • JSON:     ${chalk.bold(jsonPath)}`);
    } catch (err: unknown) {
      spinner.fail(`Falha no benchmark: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// 6. Comando: env
program
  .command('env')
  .description('Executar simulação interativa de ambiente multi-turno (Resposta a Incidentes)')
  .option('-m, --model <name>', 'Modelo no LiteLLM Proxy a utilizar', DEFAULT_MODEL)
  .option('-H, --host <url>', 'URL do LiteLLM Proxy', DEFAULT_LITELLM_HOST)
  .option('-k, --key <token>', 'API Key do LiteLLM Proxy', DEFAULT_LITELLM_KEY)
  .option('-e, --endpoint <type>', 'Endpoint a forçar ("auto", "decision", "systemone")', 'auto')
  .option('-t, --temperature <number>', 'Temperatura de amostragem', '0.2')
  .action(async (options) => {
    ConsoleReporter.printHeader();
    console.log(
      chalk.bold.yellow('🚨 INICIANDO SIMULAÇÃO DE AMBIENTE MULTI-TURNO DE RESPOSTA A INCIDENTES')
    );
    console.log(
      chalk.gray(
        'O modelo deve analisar a telemetria em tempo real e estabilizar o sistema ao longo de até 4 turnos.\n'
      )
    );

    const client = new LiteLlmClient(options.host, options.key);
    const simulator = new DecisionSimulator(client);
    const env = new IncidentManagementEnvironment(4);

    const spinner = ora('Inicializando simulação de ambiente via LiteLLM Proxy...').start();

    try {
      spinner.stop();
      await simulator.runEnvironmentSimulation(
        env,
        {
          model: options.model,
          endpoint: options.endpoint,
          temperature: parseFloat(options.temperature),
          litellmHost: options.host,
          apiKey: options.key
        },
        (turnResult) => {
          ConsoleReporter.printEnvironmentTurn(turnResult);
        }
      );
    } catch (err: unknown) {
      spinner.fail(
        `Falha na simulação de ambiente: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

// Se nenhum argumento for passado, executa o modo interativo guiado (Inquirer)
if (process.argv.length <= 2) {
  runInteractiveCli().catch((err: unknown) => {
    console.error(
      chalk.red(
        `Erro no assistente interativo: ${err instanceof Error ? err.message : String(err)}`
      )
    );
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
