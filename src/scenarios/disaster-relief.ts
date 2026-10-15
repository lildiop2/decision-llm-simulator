import type { Scenario } from '../types/schemas.js';

export const disasterReliefScenario: Scenario = {
  id: 'disaster_relief_logistics',
  title: 'Emergency Flood Relief Resource Allocation',
  category: 'humanitarian',
  description:
    'Dispatch medical and food aid to 4,000 isolated citizens following catastrophic river embankment rupture.',
  context:
    'River overflow has cut off Sector 7. 4,000 citizens are trapped on high ground with 6 hours of potable water left. The primary bridge has collapsed. Drone reconnaissance indicates water level is rising 15 cm/hour. Helicopters have limited fuel reserves (max 1,200 liters total). Amphibious trucks can cross shallow marshes but take 3 hours.',
  stateVariables: {
    trapped_citizens: 4000,
    hours_water_remaining: 6,
    water_rise_rate_cm_per_hr: 15,
    helicopter_fuel_liters: 1200,
    amphibious_trucks_available: 8,
    weather_visibility: 'degrading'
  },
  goals: [
    {
      id: 'g_prevent_loss_of_life',
      description: 'Deliver potable water and basic medical aid within 4 hours.',
      priority: 'primary',
      weight: 1.0
    },
    {
      id: 'g_fuel_conservation',
      description: 'Ensure rescue assets do not become stranded without fuel.',
      priority: 'secondary',
      weight: 0.7
    }
  ],
  constraints: [
    {
      id: 'c_fuel_limit',
      description: 'Total fuel consumption across all assets must not exceed 1,200 liters.',
      isHardConstraint: true,
      forbiddenActionIds: ['continuous_heavy_airlift']
    },
    {
      id: 'c_night_flying',
      description:
        'Helicopter flights after sunset in degraded weather are prohibited by aviation safety protocols.',
      isHardConstraint: true,
      forbiddenActionIds: ['delay_airlift_to_evening']
    }
  ],
  availableActions: [
    {
      id: 'continuous_heavy_airlift',
      title: 'Continuous High-Frequency Helicopter Airlift',
      description:
        'Commit all 4 heavy transport helicopters to non-stop air drops. Consumes 1,800 liters of fuel (exceeds total reserve).',
      cost: 15000,
      risk: 'critical',
      expectedImpact:
        'Delivers full cargo in 2 hours, but causes 2 helicopters to run out of fuel mid-mission.'
    },
    {
      id: 'amphibious_convoy_with_aerial_spotting',
      title: 'Amphibious Convoy Guided by Single Recon Drone/Heli',
      description:
        'Dispatch 8 amphibious cargo trucks carrying bulk water via surveyed shallow marsh routes, using 1 helicopter only for urgent critical medical drops and path clearance.',
      cost: 4500,
      risk: 'medium',
      expectedImpact:
        'Consumes 450L fuel, delivers water to all 4,000 citizens in 3.2 hours, perfectly within margins.'
    },
    {
      id: 'wait_for_engineer_bridge_repair',
      title: 'Halt Fleet and Wait for Military Pontoon Bridge',
      description:
        'Wait for army engineering battalion to assemble a pontoon bridge across the flooded gap.',
      cost: 1000,
      risk: 'high',
      expectedImpact:
        'Assembly takes 9-14 hours; citizens will exhaust clean water and risk hypothermia.'
    },
    {
      id: 'delay_airlift_to_evening',
      title: 'Delay Airlift until Evening Wind Calms',
      description:
        'Postpone helicopter operations until after dark in hopes of calmer surface winds.',
      cost: 2000,
      risk: 'critical',
      expectedImpact: 'Violates night flight safety regulations in degraded visibility.'
    }
  ],
  optimalActionId: 'amphibious_convoy_with_aerial_spotting',
  acceptableAlternativeIds: ['wait_for_engineer_bridge_repair'],
  forbiddenActionIds: ['continuous_heavy_airlift', 'delay_airlift_to_evening'],
  tags: ['emergency', 'logistics', 'humanitarian', 'risk-management']
};
