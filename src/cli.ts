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
  .description('High-Stakes Decision-Making LLM Simulator using TypeScript, Zod, and Ollama')
  .version('1.0.0');

// 1. Command: list-models
program
  .command('list-models')
  .description('List all locally available Ollama models and their capabilities')
  .option(
    '-H, --host <url>',
    'Ollama host URL',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .action(async (options) => {
    ConsoleReporter.printHeader();
    const client = new OllamaClient(options.host);

    const spinner = ora('Checking Ollama connection...').start();
    const isHealthy = await client.isHealthy();

    if (!isHealthy) {
      spinner.fail(chalk.red(`Unable to connect to Ollama at ${options.host}. Is Ollama running?`));
      process.exit(1);
    }

    spinner.text = 'Fetching models...';
    try {
      const models = await client.listModels();
      spinner.succeed(`Discovered ${models.length} model(s) on Ollama:\n`);

      for (const m of models) {
        const isDecisionSpecialized =
          m.capabilities?.includes('decision') || m.name.includes('tev1');
        const badge = isDecisionSpecialized
          ? chalk.bgMagenta.white.bold(' 🧠 DECISION MODEL ')
          : chalk.bgBlue.white(' GENERAL LLM ');

        const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`• ${chalk.yellow.bold(m.name)}  ${badge}`);
        console.log(
          chalk.gray(
            `  Size: ${sizeGb} GB | Family: ${m.details?.family || 'N/A'} | Params: ${
              m.details?.parameter_size || 'N/A'
            } | Quant: ${m.details?.quantization_level || 'N/A'}`
          )
        );
        if (m.capabilities && m.capabilities.length > 0) {
          console.log(chalk.gray(`  Capabilities: [${m.capabilities.join(', ')}]`));
        }
        console.log('');
      }
    } catch (err: unknown) {
      spinner.fail(`Error listing models: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

// 2. Command: list-scenarios
program
  .command('list-scenarios')
  .description('List all available high-stakes decision scenarios')
  .action(() => {
    ConsoleReporter.printHeader();
    const scenarios = getAllScenarios();

    console.log(chalk.bold.cyan(`Found ${scenarios.length} built-in decision scenarios:\n`));

    for (const s of scenarios) {
      console.log(chalk.bold.yellow(`[${s.id}]`) + ' ' + chalk.white.bold(s.title));
      console.log(
        chalk.gray(
          `Category: ${s.category.toUpperCase()} | Actions: ${s.availableActions.length} | Constraints: ${s.constraints?.length ?? 0}`
        )
      );
      console.log(chalk.gray(`Description: ${s.description}`));
      console.log(chalk.gray(`Tags: ${(s.tags ?? []).join(', ')}\n`));
    }
  });

// 3. Command: run
program
  .command('run [scenarioId]')
  .description('Run a decision simulation for a specific scenario')
  .option('-m, --model <name>', 'Ollama model to use', process.env.OLLAMA_MODEL || 'tev1:0.8b')
  .option(
    '-H, --host <url>',
    'Ollama host URL',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .option('-t, --temperature <number>', 'Sampling temperature', '0.2')
  .option('-s, --save', 'Save execution report to reports/ directory', false)
  .action(async (scenarioId, options) => {
    ConsoleReporter.printHeader();

    const targetId = scenarioId || 'incident_database_failover';
    const scenario = getScenarioById(targetId);

    if (!scenario) {
      console.error(
        chalk.red(
          `Error: Scenario "${targetId}" not found. Run "decision-sim list-scenarios" to see available scenarios.`
        )
      );
      process.exit(1);
    }

    const client = new OllamaClient(options.host);
    const simulator = new DecisionSimulator(client);

    const spinner = ora(
      `Executing scenario "${scenario.title}" with model "${options.model}"...`
    ).start();

    try {
      const result = await simulator.runScenario(scenario, {
        model: options.model,
        temperature: parseFloat(options.temperature),
        ollamaHost: options.host
      });

      spinner.succeed(`Decision evaluation completed in ${result.evaluation.latencyMs}ms!`);

      ConsoleReporter.printStepResult(result);

      if (options.save) {
        const fileReporter = new FileReporter();
        const savedPath = await fileReporter.saveSingleRunReport(result);
        console.log(chalk.green(`✔ Saved report to: ${savedPath}`));
      }
    } catch (err: unknown) {
      spinner.fail(`Simulation failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// 4. Command: benchmark
program
  .command('benchmark')
  .description('Run a comparative benchmark matrix across multiple models and scenarios')
  .option(
    '-m, --models <names>',
    'Comma-separated list of Ollama models to benchmark',
    'tev1:0.8b,llama3.2:latest'
  )
  .option(
    '-H, --host <url>',
    'Ollama host URL',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .option('-t, --temperature <number>', 'Sampling temperature', '0.1')
  .option('-s, --scenarios <ids>', 'Comma-separated scenario IDs (or "all")', 'all')
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
        `Starting benchmark for ${modelsList.length} model(s) across ${scenariosToRun.length} scenario(s)...\n`
      )
    );

    const client = new OllamaClient(options.host);
    const simulator = new DecisionSimulator(client);
    const spinner = ora('Running benchmark matrix...').start();

    try {
      const report = await simulator.runBenchmark(scenariosToRun, modelsList, {
        ollamaHost: options.host,
        temperature: parseFloat(options.temperature)
      });

      spinner.succeed('Benchmark matrix execution complete!');
      ConsoleReporter.printBenchmarkReport(report);

      const fileReporter = new FileReporter();
      const { jsonPath, mdPath } = await fileReporter.saveBenchmarkReport(report);
      console.log(chalk.green(`\n✔ Reports saved:`));
      console.log(`  • Markdown: ${chalk.bold(mdPath)}`);
      console.log(`  • JSON:     ${chalk.bold(jsonPath)}`);
    } catch (err: unknown) {
      spinner.fail(`Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// 5. Command: env
program
  .command('env')
  .description('Run a multi-turn interactive environment simulation (Incident Response)')
  .option('-m, --model <name>', 'Ollama model to use', process.env.OLLAMA_MODEL || 'tev1:0.8b')
  .option(
    '-H, --host <url>',
    'Ollama host URL',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  )
  .option('-t, --temperature <number>', 'Sampling temperature', '0.2')
  .action(async (options) => {
    ConsoleReporter.printHeader();
    console.log(
      chalk.bold.yellow('🚨 STARTING MULTI-TURN INCIDENT RESPONSE ENVIRONMENT SIMULATION')
    );
    console.log(
      chalk.gray(
        'The model must navigate dynamic telemetry changes and stabilize the system over 4 turns.\n'
      )
    );

    const client = new OllamaClient(options.host);
    const simulator = new DecisionSimulator(client);
    const env = new IncidentManagementEnvironment(4);

    const spinner = ora('Initializing environment simulation...').start();

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
        `Environment simulation failed: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
