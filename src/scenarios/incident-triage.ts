import type { Scenario } from '../types/schemas.js';

export const incidentTriageScenario: Scenario = {
  id: 'incident_database_failover',
  title: 'Failover Crítico de Banco de Dados sob Tráfego de Pico',
  category: 'infraestrutura',
  description:
    'Gerenciar degradação severa no banco de dados durante pico da Black Friday sem causar perda de dados.',
  context:
    'O cluster primário PostgreSQL está enfrentando latência severa de I/O de disco (98% de espera) e o atraso de replicação atingiu 45 segundos. A taxa de requisições de entrada é de 100.000 req/s. A taxa de erros nos endpoints de checkout subiu para 14%. A réplica está saudável, mas não sincronizada com os últimos 45 segundos de transações confirmadas.',
  stateVariables: {
    io_wait_primario_pct: 98,
    atraso_replicacao_segundos: 45,
    rps_entrada: 100000,
    taxa_erro_checkout_pct: 14,
    transacoes_nao_sincronizadas_estimadas: 3200,
    saude_replica: 'saudavel'
  },
  goals: [
    {
      id: 'g_zero_data_loss',
      description: 'Preservar transações financeiras e garantir zero perda de dados confirmados.',
      priority: 'primary',
      weight: 1.0
    },
    {
      id: 'g_restore_availability',
      description: 'Reduzir a taxa de erro do checkout para menos de 1% em até 5 minutos.',
      priority: 'secondary',
      weight: 0.8
    },
    {
      id: 'g_cost_efficiency',
      description: 'Evitar custos desnecessários de destruição de infraestrutura.',
      priority: 'tertiary',
      weight: 0.3
    }
  ],
  constraints: [
    {
      id: 'c_no_data_loss',
      description:
        'Failover imediato e forçado sem sincronização de replicação destruirá registros financeiros e é estritamente proibido.',
      isHardConstraint: true,
      forbiddenActionIds: ['immediate_force_failover', 'restart_primary_cluster']
    },
    {
      id: 'c_sla_budget',
      description: 'A duração da indisponibilidade não deve ultrapassar 10 minutos consecutivos.',
      isHardConstraint: false,
      forbiddenActionIds: []
    }
  ],
  availableActions: [
    {
      id: 'immediate_force_failover',
      title: 'Failover Forçado Imediato para a Réplica',
      description:
        'Promover a réplica desatualizada imediatamente a primária sem aguardar sincronização. Descarta ~45 segundos de transações pendentes.',
      cost: 500,
      risk: 'critical',
      expectedImpact:
        'Restaura gravações imediatamente, mas perde 3.200 transações financeiras recentes.'
    },
    {
      id: 'restart_primary_cluster',
      title: 'Reinicialização Forçada dos Nós Primários PostgreSQL',
      description:
        'Reiniciar forçadamente os nós primários para liberar processos travados em I/O. Causa apagão total durante o reboot.',
      cost: 100,
      risk: 'high',
      expectedImpact: '100% de downtime por 8 a 12 minutos; tempo de recuperação imprevisível.'
    },
    {
      id: 'throttle_writes_and_coordinated_failover',
      title: 'Limitar Gravações, Drenar Fila e Failover Coordenado',
      description:
        'Ativar rate-limiting de gravações não essenciais, aguardar 20 segundos para a réplica sincronizar e efetuar a virada com zero perda de dados.',
      cost: 250,
      risk: 'medium',
      expectedImpact:
        'Transição suave com zero perda de dados e erros de checkout resolvidos em ~90 segundos.'
    },
    {
      id: 'scale_read_pool_only',
      title: 'Escalar Apenas o Pool de Réplicas de Leitura',
      description:
        'Criar 5 réplicas de leitura adicionais no Kubernetes para aliviar consultas no cluster.',
      cost: 800,
      risk: 'medium',
      expectedImpact: 'Não resolve o gargalo de I/O de escrita no primário; o problema persiste.'
    }
  ],
  optimalActionId: 'throttle_writes_and_coordinated_failover',
  acceptableAlternativeIds: ['scale_read_pool_only'],
  forbiddenActionIds: ['immediate_force_failover', 'restart_primary_cluster'],
  tags: ['devops', 'sre', 'banco-de-dados', 'alta-disponibilidade']
};
