#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { OllamaClient } from './client/ollama-client.js';
import { DecisionSimulator } from './engine/simulator.js';
import { ConsoleReporter } from './reporters/console-reporter.js';
import { FileReporter } from './reporters/file-reporter.js';
import { getAllScenarios, getScenarioById } from './scenarios/index.js';
import { IncidentManagementEnvironment } from './engine/environment.js';

dotenv.config();

const program = new Command();

program
  .name('decision-sim')
  .description('Simulador e Avaliador de Modelos de Decisão com TypeScript, Zod e Ollama')
  .version('1.0.0');

// 1. Comando: list-models
program
  .command('list-models')
  .description('Listar todos os modelos Ollama locais disponíveis e suas capacidades')
  .option(
    '-H, --host <url>',
    'URL do servidor Ollama',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .action(async (options) => {
    ConsoleReporter.printHeader();
    const client = new OllamaClient(options.host);

    const spinner = ora('Verificando conexão com o Ollama...').start();
    const isHealthy = await client.isHealthy();

    if (!isHealthy) {
      spinner.fail(
        chalk.red(`Não foi possível conectar ao Ollama em ${options.host}. O serviço está ativo?`)
      );
      process.exit(1);
    }

    spinner.text = 'Buscando modelos instalados...';
    try {
      const models = await client.listModels();
      spinner.succeed(`Encontrado(s) ${models.length} modelo(s) no Ollama:\n`);

      for (const m of models) {
        const isDecisionSpecialized =
          m.capabilities?.includes('decision') || m.name.includes('tev1');
        const badge = isDecisionSpecialized
          ? chalk.bgMagenta.white.bold(' 🧠 MODELO DE DECISÃO ')
          : chalk.bgBlue.white(' LLM GERAL ');

        const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`• ${chalk.yellow.bold(m.name)}  ${badge}`);
        console.log(
          chalk.gray(
            `  Tamanho: ${sizeGb} GB | Família: ${m.details?.family || 'N/A'} | Parâmetros: ${
              m.details?.parameter_size || 'N/A'
            } | Quantização: ${m.details?.quantization_level || 'N/A'}`
          )
        );
        if (m.capabilities && m.capabilities.length > 0) {
          console.log(chalk.gray(`  Capacidades: [${m.capabilities.join(', ')}]`));
        }
        console.log('');
      }
    } catch (err: unknown) {
      spinner.fail(`Erro ao listar modelos: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

// 2. Comando: list-scenarios
program
  .command('list-scenarios')
  .description('Listar todos os cenários operacionais de decisão disponíveis')
  .action(() => {
    ConsoleReporter.printHeader();
    const scenarios = getAllScenarios();

    console.log(
      chalk.bold.cyan(`Encontrados ${scenarios.length} cenários de decisão integrados:\n`)
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

// 3. Comando: run
program
  .command('run [scenarioId]')
  .description('Executar simulação de decisão para um cenário específico')
  .option('-m, --model <name>', 'Modelo Ollama a utilizar', process.env.OLLAMA_MODEL || 'tev1:0.8b')
  .option(
    '-H, --host <url>',
    'URL do servidor Ollama',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .option('-t, --temperature <number>', 'Temperatura de amostragem', '0.2')
  .option('-s, --save', 'Salvar relatório de execução no diretório reports/', false)
  .action(async (scenarioId, options) => {
    ConsoleReporter.printHeader();

    const targetId = scenarioId || 'incident_database_failover';
    const scenario = getScenarioById(targetId);

    if (!scenario) {
      console.error(
        chalk.red(
          `Erro: Cenário "${targetId}" não encontrado. Execute "decision-sim list-scenarios" para ver os cenários válidos.`
        )
      );
      process.exit(1);
    }

    const client = new OllamaClient(options.host);
    const simulator = new DecisionSimulator(client);

    const spinner = ora(
      `Executando cenário "${scenario.title}" com o modelo "${options.model}"...`
    ).start();

    try {
      const result = await simulator.runScenario(scenario, {
        model: options.model,
        temperature: parseFloat(options.temperature),
        ollamaHost: options.host
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

// 4. Comando: benchmark
program
  .command('benchmark')
  .description('Executar matriz comparativa de benchmark entre múltiplos modelos e cenários')
  .option(
    '-m, --models <names>',
    'Lista de modelos Ollama separados por vírgula',
    'tev1:0.8b,llama3.2:latest'
  )
  .option(
    '-H, --host <url>',
    'URL do servidor Ollama',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .option('-t, --temperature <number>', 'Temperatura de amostragem', '0.1')
  .option('-s, --scenarios <ids>', 'IDs dos cenários separados por vírgula (ou "all")', 'all')
  .action(async (options) => {
    ConsoleReporter.printHeader();

    const modelsList = options.models.split(',').map((m: string) => m.trim());
    let scenariosToRun = getAllScenarios();

    if (options.scenarios !== 'all') {
      const requestedIds = options.scenarios.split(',').map((id: string) => id.trim());
      scenariosToRun = scenariosToRun.filter((s) => requestedIds.includes(s.id));
    }

    console.log(
      chalk.cyan(
        `Iniciando benchmark para ${modelsList.length} modelo(s) em ${scenariosToRun.length} cenário(s)...\n`
      )
    );

    const client = new OllamaClient(options.host);
    const simulator = new DecisionSimulator(client);
    const spinner = ora('Executando matriz de benchmark...').start();

    try {
      const report = await simulator.runBenchmark(scenariosToRun, modelsList, {
        ollamaHost: options.host,
        temperature: parseFloat(options.temperature)
      });

      spinner.succeed('Execução da matriz de benchmark finalizada!');
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

// 5. Comando: env
program
  .command('env')
  .description('Executar simulação interativa de ambiente multi-turno (Resposta a Incidentes)')
  .option('-m, --model <name>', 'Modelo Ollama a utilizar', process.env.OLLAMA_MODEL || 'tev1:0.8b')
  .option(
    '-H, --host <url>',
    'URL do servidor Ollama',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .option('-t, --temperature <number>', 'Temperatura de amostragem', '0.2')
  .action(async (options) => {
    ConsoleReporter.printHeader();
    console.log(
      chalk.bold.yellow('🚨 INICIANDO SIMULAÇÃO DE AMBIENTE MULTI-TURNO DE RESPOSTA A INCIDENTES')
    );
    console.log(
      chalk.gray(
        'O modelo deve analisar a telemetria em tempo real e estabilizar o sistema ao longo de 4 turnos.\n'
      )
    );

    const client = new OllamaClient(options.host);
    const simulator = new DecisionSimulator(client);
    const env = new IncidentManagementEnvironment(4);

    const spinner = ora('Inicializando simulação de ambiente...').start();

    try {
      spinner.stop();
      await simulator.runEnvironmentSimulation(
        env,
        {
          model: options.model,
          temperature: parseFloat(options.temperature),
          ollamaHost: options.host
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

program.parse(process.argv);
