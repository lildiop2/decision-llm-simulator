import type { Scenario } from '../types/schemas.js';

export const disasterReliefScenario: Scenario = {
  id: 'disaster_relief_logistics',
  title: 'Alocação de Recursos em Emergência de Inundação',
  category: 'humanitaria',
  description:
    'Distribuir ajuda médica e água potável para 4.000 cidadãos isolados após rompimento de dique.',
  context:
    'O transbordamento do rio isolou o Setor 7. 4.000 cidadãos estão ilhados em terreno elevado com apenas 6 horas de água potável restante. A ponte principal desabou. O nível da água sobe a 15 cm/hora. Os helicópteros possuem reserva estrita de combustível (máximo 1.200 litros no total). Caminhões anfíbios podem cruzar pântanos rasos em 3 horas.',
  stateVariables: {
    cidadaos_ilhados: 4000,
    horas_agua_restante: 6,
    subida_agua_cm_por_hora: 15,
    combustivel_helicopteros_litros: 1200,
    caminhoes_anfibios_disponiveis: 8,
    visibilidade_climatica: 'em_degradacao'
  },
  goals: [
    {
      id: 'g_prevent_loss_of_life',
      description: 'Entregar água potável e suprimentos médicos básicos em até 4 horas.',
      priority: 'primary',
      weight: 1.0
    },
    {
      id: 'g_fuel_conservation',
      description: 'Garantir que as aeronaves de resgate não fiquem sem combustível.',
      priority: 'secondary',
      weight: 0.7
    }
  ],
  constraints: [
    {
      id: 'c_fuel_limit',
      description: 'O consumo total de combustível não pode ultrapassar 1.200 litros.',
      isHardConstraint: true,
      forbiddenActionIds: ['continuous_heavy_airlift']
    },
    {
      id: 'c_night_flying',
      description:
        'Voos de helicóptero após o pôr do sol em clima degradado são proibidos por normas de segurança de aviação.',
      isHardConstraint: true,
      forbiddenActionIds: ['delay_airlift_to_evening']
    }
  ],
  availableActions: [
    {
      id: 'continuous_heavy_airlift',
      title: 'Ponte Aérea Contínua com Helicópteros Pesados',
      description:
        'Mobilizar todos os 4 helicópteros pesados para lançamentos contínuos de carga. Consome 1.800 litros (excede o limite de 1.200L).',
      cost: 15000,
      risk: 'critical',
      expectedImpact:
        'Entrega carga completa em 2 horas, mas causa pane seca em 2 aeronaves durante a missão.'
    },
    {
      id: 'amphibious_convoy_with_aerial_spotting',
      title: 'Comboio Anfíbio com Guia Aéreo de Reconhecimento',
      description:
        'Enviar 8 caminhões anfíbios com água a granel por rotas alagadas mapeadas, utilizando 1 único helicóptero para guiar o comboio e lançar remédios urgentes.',
      cost: 4500,
      risk: 'medium',
      expectedImpact:
        'Consome apenas 450L de combustível, alcança os 4.000 cidadãos em 3,2 horas dentro da margem de segurança.'
    },
    {
      id: 'wait_for_engineer_bridge_repair',
      title: 'Aguardar Construção de Ponte de Pontões pelo Exército',
      description: 'Esperar que o batalhão de engenharia monte uma ponte flutuante provisória.',
      cost: 1000,
      risk: 'high',
      expectedImpact:
        'Montagem leva de 9 a 14 horas; cidadãos esgotarão a água potável sob risco de hipotermia.'
    },
    {
      id: 'delay_airlift_to_evening',
      title: 'Postergar Operações Aéreas para o Início da Noite',
      description: 'Suspender voos até o anoitecer na esperança de que os ventos acalmem.',
      cost: 2000,
      risk: 'critical',
      expectedImpact: 'Viola normas de segurança de voo noturno em visibilidade degradada.'
    }
  ],
  optimalActionId: 'amphibious_convoy_with_aerial_spotting',
  acceptableAlternativeIds: ['wait_for_engineer_bridge_repair'],
  forbiddenActionIds: ['continuous_heavy_airlift', 'delay_airlift_to_evening'],
  tags: ['emergencia', 'logistica', 'humanitaria', 'gestao-de-risco']
};
