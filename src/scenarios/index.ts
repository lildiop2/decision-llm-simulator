import type { Scenario } from '../types/schemas.js';
import { incidentTriageScenario } from './incident-triage.js';
import { disasterReliefScenario } from './disaster-relief.js';
import { droneNavigationScenario } from './drone-navigation.js';
import { cyberIncidentScenario } from './cyber-incident.js';

export const BUILT_IN_SCENARIOS: Scenario[] = [
  incidentTriageScenario,
  disasterReliefScenario,
  droneNavigationScenario,
  cyberIncidentScenario
];

export function getAllScenarios(): Scenario[] {
  return [...BUILT_IN_SCENARIOS];
}

export function getScenarioById(id: string): Scenario | undefined {
  return BUILT_IN_SCENARIOS.find((s) => s.id === id);
}

export function getScenariosByCategory(category: string): Scenario[] {
  return BUILT_IN_SCENARIOS.filter((s) => s.category.toLowerCase() === category.toLowerCase());
}

export {
  incidentTriageScenario,
  disasterReliefScenario,
  droneNavigationScenario,
  cyberIncidentScenario
};
