import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { LiteLlmClient } from './client/litellm-client.js';
import { DecisionSimulator } from './engine/simulator.js';
import { ConsoleReporter } from './reporters/console-reporter.js';
import { FileReporter } from './reporters/file-reporter.js';
import { getAllScenarios, getScenarioById } from './scenarios/index.js';
import { IncidentManagementEnvironment } from './engine/environment.js';

export interface InteractiveCliContext {
  host: string;
  apiKey: string;
}

export async function runInteractiveCli(
  initialContext?: Partial<InteractiveCliContext>
): Promise<void> {
  const context: InteractiveCliContext = {
    host:
      initialContext?.host ||
      process.env.LITELLM_HOST ||
      process.env.LITELLM_BASE_URL ||
      'http://localhost:4000',
    apiKey: initialContext?.apiKey || process.env.LITELLM_API_KEY || ''
  };

  let client = new LiteLlmClient(context.host, context.apiKey);
  let simulator = new DecisionSimulator(client);

  ConsoleReporter.printHeader();
  console.log(
    chalk.green('✔ Modo Interativo Ativado! Bem-vindo ao simulador interativo de decisões.')
  );
  console.log(chalk.gray(`  Host LiteLLM Proxy atual: ${chalk.bold(context.host)}\n`));

  let keepRunning = true;

  while (keepRunning) {
    const { action } = await inquirer.prompt([
      {
        type: 'select',
        name: 'action',
        message: 'O que você deseja executar?',
        choices: [
          { name: '🚀 Executar Cenário Único (Single Run)', value: 'run' },
          { name: '📊 Matriz de Benchmark Comparativa', value: 'benchmark' },
          { name: '🚨 Ambiente Dinâmico Multi-Turno (Incident Management)', value: 'env' },
          { name: '🤖 Listar Modelos Disponíveis no LiteLLM Proxy', value: 'list-models' },
          { name: '📋 Listar Todos os Cenários Disponíveis', value: 'list-scenarios' },
          { name: '⚙️  Configurar Conexão do LiteLLM Proxy', value: 'config' },
          new inquirer.Separator(),
          { name: '❌ Sair do Simulador', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      console.log(chalk.yellow('\nEncerrando sessão interativa do simulador. Até logo!\n'));
      keepRunning = false;
      break;
    }

    if (action === 'list-scenarios') {
      const scenarios = getAllScenarios();
      console.log(
        chalk.bold.cyan(`\nEncontrados ${scenarios.length} cenários de decisão integrados:\n`)
      );
      for (const s of scenarios) {
        console.log(chalk.bold.yellow(`[${s.id}]`) + ' ' + chalk.white.bold(s.title));
        console.log(
          chalk.gray(
            `  Categoria: ${s.category.toUpperCase()} | Ações: ${s.availableActions.length} | Restrições: ${s.constraints?.length ?? 0}`
          )
        );
        console.log(chalk.gray(`  Descrição: ${s.description}\n`));
      }
      continue;
    }

    if (action === 'list-models') {
      const spinner = ora(`Consultando modelos no LiteLLM Proxy (${context.host})...`).start();
      try {
        const models = await client.listModels();
        spinner.succeed(`Encontrado(s) ${models.length} modelo(s) no LiteLLM Proxy:\n`);

        for (const m of models) {
          const supportsSystemOne = m.endpoints.includes('systemone');
          const badgeSysOne = supportsSystemOne ? chalk.bgMagenta.white.bold(' /systemone ') : '';
          const badgeDecision = chalk.bgBlue.white(' /decision ');

          console.log(`• ${chalk.yellow.bold(m.id)}  ${badgeDecision} ${badgeSysOne}`);
          if (m.owned_by) {
            console.log(chalk.gray(`  Owner: ${m.owned_by}`));
          }
          console.log(chalk.gray(`  Endpoints suportados: [${m.endpoints.join(', ')}]\n`));
        }
      } catch (err: unknown) {
        spinner.fail(
          `Não foi possível obter modelos do proxy: ${err instanceof Error ? err.message : String(err)}`
        );
        console.log(
          chalk.yellow(
            'Dica: certifique-se de que o LiteLLM Proxy está rodando na porta correta ou configure o host via opção ⚙️'
          )
        );
      }
      continue;
    }

    if (action === 'config') {
      const configAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'host',
          message: 'URL do LiteLLM Proxy:',
          default: context.host
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key do LiteLLM Proxy (opcional, deixe em branco para nenhuma):',
          default: context.apiKey
        }
      ]);

      context.host = configAnswers.host.trim();
      context.apiKey = configAnswers.apiKey.trim();
      client = new LiteLlmClient(context.host, context.apiKey);
      simulator = new DecisionSimulator(client);
      console.log(chalk.green(`✔ Configuração atualizada para: ${context.host}\n`));
      continue;
    }

    if (action === 'run') {
      const allScenarios = getAllScenarios();
      const scenarioChoices = allScenarios.map((s) => ({
        name: `[${s.category.toUpperCase()}] ${s.title} (${chalk.gray(s.id)})`,
        value: s.id
      }));

      // Tenta obter modelos remotos para sugestão
      let modelChoices: Array<{ name: string; value: string }> = [];
      try {
        const remoteModels = await client.listModels();
        if (remoteModels.length > 0) {
          modelChoices = remoteModels.map((m) => ({
            name: `${m.id} (${m.endpoints.join(', ')})`,
            value: m.id
          }));
        }
      } catch {
        // Fallback para modelos conhecidos
      }

      if (modelChoices.length === 0) {
        modelChoices = [
          { name: 'decision-model (Padrão LiteLLM)', value: 'decision-model' },
          { name: 'gpt-4o-mini (Generativo via /decision)', value: 'gpt-4o-mini' },
          { name: 'gpt-4o (Generativo via /decision)', value: 'gpt-4o' },
          { name: 'claude-3-5-sonnet (Generativo via /decision)', value: 'claude-3-5-sonnet' },
          { name: 'tev1:0.8b (System One Probabilístico via /systemone)', value: 'tev1:0.8b' },
          { name: 'kev (System One Probabilístico via /systemone)', value: 'kev' }
        ];
      }

      modelChoices.push({ name: '✏️  Digitar outro modelo manualmente...', value: '__custom__' });

      const runAnswers = await inquirer.prompt([
        {
          type: 'select',
          name: 'scenarioId',
          message: 'Selecione o cenário operacional:',
          choices: scenarioChoices
        },
        {
          type: 'select',
          name: 'modelSelection',
          message: 'Selecione o modelo do LiteLLM Proxy:',
          choices: modelChoices
        },
        {
          type: 'input',
          name: 'customModel',
          message: 'Digite o identificador do modelo:',
          when: (answers) => answers.modelSelection === '__custom__',
          validate: (val) =>
            val && val.trim().length > 0 ? true : 'Identificador de modelo é obrigatório'
        },
        {
          type: 'select',
          name: 'endpoint',
          message: 'Qual endpoint do LiteLLM Proxy deve processar a decisão?',
          choices: [
            { name: 'Automático (Detectar com base nas capacidades do modelo)', value: 'auto' },
            {
              name: 'Forçar /decision (Modelos Generativos / Structured Output)',
              value: 'decision'
            },
            {
              name: 'Forçar /systemone (Modelos Nativo Probabilísticos System One)',
              value: 'systemone'
            }
          ],
          default: 'auto'
        },
        {
          type: 'input',
          name: 'temperature',
          message: 'Temperatura de amostragem (0.0 a 1.0):',
          default: '0.2',
          validate: (val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num >= 0 && num <= 1 ? true : 'Informe um número entre 0 e 1';
          }
        },
        {
          type: 'confirm',
          name: 'save',
          message: 'Deseja salvar o relatório de execução na pasta reports/?',
          default: true
        }
      ]);

      const targetModel =
        runAnswers.modelSelection === '__custom__'
          ? runAnswers.customModel.trim()
          : runAnswers.modelSelection;
      const targetScenario = getScenarioById(runAnswers.scenarioId)!;

      const spinner = ora(
        `Executando cenário "${targetScenario.title}" com o modelo "${targetModel}" via LiteLLM Proxy...`
      ).start();

      try {
        const result = await simulator.runScenario(targetScenario, {
          model: targetModel,
          endpoint: runAnswers.endpoint,
          temperature: parseFloat(runAnswers.temperature),
          litellmHost: context.host,
          apiKey: context.apiKey
        });

        spinner.succeed(
          `Decisão concluída em ${result.evaluation.latencyMs}ms! Score: ${result.evaluation.totalScore}/100`
        );
        ConsoleReporter.printStepResult(result);

        if (runAnswers.save) {
          const fileReporter = new FileReporter();
          const savedPath = await fileReporter.saveSingleRunReport(result);
          console.log(chalk.green(`✔ Relatório salvo com sucesso em: ${chalk.bold(savedPath)}\n`));
        }
      } catch (err: unknown) {
        spinner.fail(`Falha na simulação: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      continue;
    }

    if (action === 'benchmark') {
      const allScenarios = getAllScenarios();
      const benchmarkAnswers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedScenarios',
          message: 'Selecione os cenários para o benchmark:',
          choices: allScenarios.map((s) => ({
            name: `${s.title} (${s.id})`,
            value: s.id,
            checked: true
          })),
          validate: (ans) => (ans.length > 0 ? true : 'Selecione pelo menos um cenário')
        },
        {
          type: 'input',
          name: 'modelsList',
          message: 'Modelos para comparar (separados por vírgula):',
          default: 'decision-model,tev1:0.8b',
          validate: (ans) => (ans.trim().length > 0 ? true : 'Informe pelo menos um modelo')
        },
        {
          type: 'select',
          name: 'endpoint',
          message: 'Roteamento de endpoint:',
          choices: [
            { name: 'Automático por modelo (/decision e /systemone)', value: 'auto' },
            { name: 'Forçar /decision para todos', value: 'decision' },
            { name: 'Forçar /systemone para todos', value: 'systemone' }
          ],
          default: 'auto'
        },
        {
          type: 'input',
          name: 'temperature',
          message: 'Temperatura:',
          default: '0.1'
        }
      ]);

      const selectedIds = benchmarkAnswers.selectedScenarios as string[];
      const scenariosToRun = allScenarios.filter((s) => selectedIds.includes(s.id));
      const modelsToRun = benchmarkAnswers.modelsList
        .split(',')
        .map((m: string) => m.trim())
        .filter(Boolean);

      console.log(
        chalk.cyan(
          `\nIniciando benchmark para ${modelsToRun.length} modelo(s) em ${scenariosToRun.length} cenário(s)...\n`
        )
      );

      const spinner = ora('Executando matriz de benchmark via LiteLLM Proxy...').start();
      try {
        const report = await simulator.runBenchmark(scenariosToRun, modelsToRun, {
          litellmHost: context.host,
          apiKey: context.apiKey,
          endpoint: benchmarkAnswers.endpoint,
          temperature: parseFloat(benchmarkAnswers.temperature)
        });

        spinner.succeed('Matriz de benchmark concluída!');
        ConsoleReporter.printBenchmarkReport(report);

        const fileReporter = new FileReporter();
        const { jsonPath, mdPath } = await fileReporter.saveBenchmarkReport(report);
        console.log(chalk.green(`\n✔ Relatórios salvos:`));
        console.log(`  • Markdown: ${chalk.bold(mdPath)}`);
        console.log(`  • JSON:     ${chalk.bold(jsonPath)}\n`);
      } catch (err: unknown) {
        spinner.fail(`Falha no benchmark: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      continue;
    }

    if (action === 'env') {
      const envAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'model',
          message: 'Modelo a utilizar na simulação do ambiente:',
          default: 'decision-model'
        },
        {
          type: 'select',
          name: 'endpoint',
          message: 'Endpoint a utilizar:',
          choices: [
            { name: 'Automático', value: 'auto' },
            { name: 'Forçar /decision', value: 'decision' },
            { name: 'Forçar /systemone', value: 'systemone' }
          ],
          default: 'auto'
        },
        {
          type: 'input',
          name: 'temperature',
          message: 'Temperatura:',
          default: '0.2'
        }
      ]);

      console.log(
        chalk.bold.yellow(
          '\n🚨 INICIANDO SIMULAÇÃO DE AMBIENTE MULTI-TURNO (RESPOSTA A INCIDENTES)'
        )
      );
      console.log(
        chalk.gray(
          'O modelo deve estabilizar a infraestrutura durante até 4 turnos consecutivos avaliando telemetria dinâmica.\n'
        )
      );

      const env = new IncidentManagementEnvironment(4);
      const spinner = ora('Executando turnos do ambiente via LiteLLM Proxy...').start();

      try {
        spinner.stop();
        await simulator.runEnvironmentSimulation(
          env,
          {
            model: envAnswers.model.trim(),
            endpoint: envAnswers.endpoint,
            temperature: parseFloat(envAnswers.temperature),
            litellmHost: context.host,
            apiKey: context.apiKey
          },
          (turnResult) => {
            ConsoleReporter.printEnvironmentTurn(turnResult);
          }
        );
        console.log('');
      } catch (err: unknown) {
        spinner.fail(
          `Falha na simulação do ambiente: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
      continue;
    }
  }
}
