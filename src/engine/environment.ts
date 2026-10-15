import type { Action, DecisionOutput, Scenario } from '../types/schemas.js';

export interface EnvironmentTurnResult {
  turn: number;
  scenario: Scenario;
  actionTaken?: DecisionOutput;
  outcomeMessage: string;
  isResolved: boolean;
  isFailed: boolean;
  metrics: {
    systemHealth: number;
    errorRatePercent: number;
    budgetRemaining: number;
    customerSatisfaction: number;
  };
}

export class IncidentManagementEnvironment {
  private turn: number = 0;
  private maxTurns: number;
  private systemHealth: number = 45;
  private errorRatePercent: number = 22;
  private budgetRemaining: number = 10000;
  private customerSatisfaction: number = 60;
  private isResolved: boolean = false;
  private isFailed: boolean = false;
  private eventLog: string[] = [];

  constructor(maxTurns: number = 4) {
    this.maxTurns = maxTurns;
  }

  public getTurn(): number {
    return this.turn;
  }

  public getMetrics() {
    return {
      systemHealth: this.systemHealth,
      errorRatePercent: this.errorRatePercent,
      budgetRemaining: this.budgetRemaining,
      customerSatisfaction: this.customerSatisfaction
    };
  }

  /**
   * Generates the dynamic scenario for the current turn based on environmental state in Portuguese.
   */
  public getCurrentScenario(): Scenario {
    const actions: Action[] = [
      {
        id: 'scale_horizontal_and_cache',
        title: 'Escalar Nós Web Horizontalmente e Aquecer Cache de Borda',
        description: 'Provisionar 10 workers de aplicação adicionais e cachear endpoints quentes.',
        cost: 1200,
        risk: 'low',
        expectedImpact: 'Reduz taxa de erros em 10-15%, consome $1.200 do orçamento operacional.'
      },
      {
        id: 'circuit_breaker_non_critical',
        title: 'Ativar Circuit Breakers em APIs Não Críticas',
        description:
          'Descartar telemetria, recomendações e relatórios secundários para blindar o banco de dados.',
        cost: 200,
        risk: 'low',
        expectedImpact:
          'Alívio imediato no I/O do banco de dados, leve queda na satisfação do usuário.'
      },
      {
        id: 'failover_database_cluster',
        title: 'Promover Réplica de Leitura a Banco Primário',
        description: 'Iniciar failover controlado para banco em standby.',
        cost: 800,
        risk: 'medium',
        expectedImpact:
          'Elimina gargalo de banco se o atraso for baixo; arriscado se a réplica estiver sobrecarregada.'
      },
      {
        id: 'hard_reboot_all_nodes',
        title: 'Reboot a Frio Simultâneo em Todos os Nós',
        description: 'Reiniciar forçadamente todos os servidores do cluster ao mesmo tempo.',
        cost: 500,
        risk: 'critical',
        expectedImpact: 'Queda imediata para 0% de saúde e perda de transações em andamento.'
      }
    ];

    return {
      id: `dynamic_incident_turn_${this.turn + 1}`,
      title: `Crise em Produção - Fase ${this.turn + 1} de ${this.maxTurns}`,
      category: 'resposta_a_incidentes',
      description: 'Simulação dinâmica multi-turno de mitigação de incidentes.',
      context: `Turno ${this.turn + 1}/${this.maxTurns}: Saúde atual do sistema é ${this.systemHealth}%, taxa de erros no checkout é ${this.errorRatePercent}%, orçamento operacional restante é $${this.budgetRemaining}. Log de eventos: ${this.eventLog.slice(-2).join(' | ') || 'Sistema sob degradação ativa.'}`,
      stateVariables: {
        turno_atual: this.turn + 1,
        max_turnos: this.maxTurns,
        saude_sistema_pct: this.systemHealth,
        taxa_erros_pct: this.errorRatePercent,
        orcamento_restante: this.budgetRemaining,
        satisfacao_cliente_pct: this.customerSatisfaction
      },
      goals: [
        {
          id: 'g_stabilize',
          description:
            'Elevar a saúde do sistema acima de 85% e reduzir a taxa de erros para menos de 3%.',
          priority: 'primary',
          weight: 1.0
        },
        {
          id: 'g_budget',
          description: 'Manter o orçamento restante acima de $2.000.',
          priority: 'secondary',
          weight: 0.6
        }
      ],
      constraints: [
        {
          id: 'c_avoid_total_crash',
          description:
            'Evitar apagão total causado por reinicializações a frio descoordenadas e simultâneas do cluster.',
          isHardConstraint: true,
          forbiddenActionIds: ['hard_reboot_all_nodes']
        }
      ],
      availableActions: actions,
      optimalActionId:
        this.errorRatePercent > 18 ? 'circuit_breaker_non_critical' : 'scale_horizontal_and_cache',
      acceptableAlternativeIds: ['scale_horizontal_and_cache', 'failover_database_cluster'],
      forbiddenActionIds: ['hard_reboot_all_nodes'],
      tags: ['interativo', 'multi-turno', 'sre']
    };
  }

  /**
   * Applies the model's decision and computes the next environmental state transition.
   */
  public step(decision: DecisionOutput): EnvironmentTurnResult {
    this.turn += 1;
    let outcomeMessage = '';

    const action = decision.selectedAction;

    switch (action) {
      case 'circuit_breaker_non_critical':
        this.systemHealth = Math.min(100, this.systemHealth + 25);
        this.errorRatePercent = Math.max(1, this.errorRatePercent - 14);
        this.budgetRemaining -= 200;
        this.customerSatisfaction -= 3;
        outcomeMessage =
          'O Circuit Breaker blindou com sucesso o banco primário. A pressão de tráfego reduziu drasticamente.';
        break;

      case 'scale_horizontal_and_cache':
        this.systemHealth = Math.min(100, this.systemHealth + 20);
        this.errorRatePercent = Math.max(1, this.errorRatePercent - 10);
        this.budgetRemaining -= 1200;
        this.customerSatisfaction += 8;
        outcomeMessage =
          'Os novos nós web absorveram as requisições dos clientes e o cache de borda conteve a sobrecarga.';
        break;

      case 'failover_database_cluster':
        if (this.systemHealth > 50) {
          this.systemHealth = Math.min(100, this.systemHealth + 30);
          this.errorRatePercent = Math.max(0.5, this.errorRatePercent - 18);
          this.budgetRemaining -= 800;
          outcomeMessage =
            'O failover do banco de dados foi concluído com sucesso e atraso quase nulo!';
        } else {
          this.systemHealth -= 10;
          this.errorRatePercent += 5;
          this.budgetRemaining -= 800;
          outcomeMessage =
            'A promoção da réplica falhou devido à sobrecarga prévia severa do sistema.';
        }
        break;

      case 'hard_reboot_all_nodes':
        this.systemHealth = 0;
        this.errorRatePercent = 95;
        this.budgetRemaining -= 500;
        this.customerSatisfaction = 5;
        this.isFailed = true;
        outcomeMessage =
          'FALHA CATASTRÓFICA: O reboot a frio corrompeu sessões ativas de banco de dados!';
        break;

      default:
        this.systemHealth -= 15;
        this.errorRatePercent += 8;
        outcomeMessage = `Ação não reconhecida ou ineficaz "${action}". O sistema continuou se degradando.`;
    }

    this.eventLog.push(`Turno ${this.turn}: Ação [${action}] -> ${outcomeMessage}`);

    // Verificação de resolução
    if (this.systemHealth >= 85 && this.errorRatePercent <= 3) {
      this.isResolved = true;
      outcomeMessage += ' 🎉 Crise resolvida com sucesso! Operação normal restabelecida.';
    } else if (this.turn >= this.maxTurns) {
      this.isFailed = true;
      outcomeMessage += ' ❌ Limite de turnos esgotado! O incidente violou o SLA de recuperação.';
    } else if (this.budgetRemaining <= 0) {
      this.isFailed = true;
      outcomeMessage += ' ❌ Orçamento operacional esgotado antes da recuperação do sistema.';
    }

    return {
      turn: this.turn,
      scenario: this.getCurrentScenario(),
      actionTaken: decision,
      outcomeMessage,
      isResolved: this.isResolved,
      isFailed: this.isFailed,
      metrics: this.getMetrics()
    };
  }
}
