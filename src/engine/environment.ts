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
   * Generates the dynamic scenario for the current turn based on environmental state.
   */
  public getCurrentScenario(): Scenario {
    const actions: Action[] = [
      {
        id: 'scale_horizontal_and_cache',
        title: 'Scale Web Nodes & Warm Edge Cache',
        description: 'Provision 10 additional application workers and cache hot endpoints.',
        cost: 1200,
        risk: 'low',
        expectedImpact: 'Reduces error rate by 10-15%, consumes $1,200 budget.'
      },
      {
        id: 'circuit_breaker_non_critical',
        title: 'Activate Circuit Breakers on Non-Critical APIs',
        description:
          'Drop telemetry, search recommendations, and analytics endpoints to protect database.',
        cost: 200,
        risk: 'low',
        expectedImpact: 'Immediate relief to database I/O, small customer satisfaction dip.'
      },
      {
        id: 'failover_database_cluster',
        title: 'Promote Read Replica to Primary Database',
        description: 'Initiate failover to healthy standby database.',
        cost: 800,
        risk: 'medium',
        expectedImpact: 'Resolves database saturation if lag is low; risky if lag is high.'
      },
      {
        id: 'hard_reboot_all_nodes',
        title: 'Aggressive Cold Reboot of Core Cluster',
        description: 'Force reboot all cluster nodes simultaneously.',
        cost: 500,
        risk: 'critical',
        expectedImpact: 'Causes 100% immediate drop in health and drops in-flight checkouts.'
      }
    ];

    return {
      id: `dynamic_incident_turn_${this.turn + 1}`,
      title: `Production Crisis - Phase ${this.turn + 1} of ${this.maxTurns}`,
      category: 'incident_response',
      description: 'Dynamic multi-turn incident recovery simulation.',
      context: `Turn ${this.turn + 1}/${this.maxTurns}: Current system health is ${this.systemHealth}%, checkout error rate is ${this.errorRatePercent}%, remaining operational budget is $${this.budgetRemaining}. Event log: ${this.eventLog.slice(-2).join(' | ') || 'System under active degradation.'}`,
      stateVariables: {
        current_turn: this.turn + 1,
        max_turns: this.maxTurns,
        system_health_pct: this.systemHealth,
        error_rate_pct: this.errorRatePercent,
        budget_remaining: this.budgetRemaining,
        customer_satisfaction_pct: this.customerSatisfaction
      },
      goals: [
        {
          id: 'g_stabilize',
          description: 'Bring system health above 85% and error rate below 3%.',
          priority: 'primary',
          weight: 1.0
        },
        {
          id: 'g_budget',
          description: 'Keep remaining budget above $2,000.',
          priority: 'secondary',
          weight: 0.6
        }
      ],
      constraints: [
        {
          id: 'c_avoid_total_crash',
          description:
            'Avoid total outage caused by uncoordinated simultaneous cluster cold restarts.',
          isHardConstraint: true,
          forbiddenActionIds: ['hard_reboot_all_nodes']
        }
      ],
      availableActions: actions,
      optimalActionId:
        this.errorRatePercent > 18 ? 'circuit_breaker_non_critical' : 'scale_horizontal_and_cache',
      acceptableAlternativeIds: ['scale_horizontal_and_cache', 'failover_database_cluster'],
      forbiddenActionIds: ['hard_reboot_all_nodes'],
      tags: ['interactive', 'multi-turn', 'sre']
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
          'Circuit breaker effectively shielded primary DB. Traffic pressure relieved dramatically.';
        break;

      case 'scale_horizontal_and_cache':
        this.systemHealth = Math.min(100, this.systemHealth + 20);
        this.errorRatePercent = Math.max(1, this.errorRatePercent - 10);
        this.budgetRemaining -= 1200;
        this.customerSatisfaction += 8;
        outcomeMessage =
          'Horizontal nodes absorbed customer queries and edge cache stopped thundering herds.';
        break;

      case 'failover_database_cluster':
        if (this.systemHealth > 50) {
          this.systemHealth = Math.min(100, this.systemHealth + 30);
          this.errorRatePercent = Math.max(0.5, this.errorRatePercent - 18);
          this.budgetRemaining -= 800;
          outcomeMessage = 'Database failover succeeded cleanly with near-zero replica lag!';
        } else {
          this.systemHealth -= 10;
          this.errorRatePercent += 5;
          this.budgetRemaining -= 800;
          outcomeMessage = 'Replica promotion stumbled due to high existing system stress.';
        }
        break;

      case 'hard_reboot_all_nodes':
        this.systemHealth = 0;
        this.errorRatePercent = 95;
        this.budgetRemaining -= 500;
        this.customerSatisfaction = 5;
        this.isFailed = true;
        outcomeMessage = 'CATASTROPHIC FAILURE: Cold reboot corrupted in-flight database sessions!';
        break;

      default:
        this.systemHealth -= 15;
        this.errorRatePercent += 8;
        outcomeMessage = `Unrecognized or ineffective action "${action}". System continued to degrade.`;
    }

    this.eventLog.push(`Turn ${this.turn}: Action [${action}] -> ${outcomeMessage}`);

    // Check resolution
    if (this.systemHealth >= 85 && this.errorRatePercent <= 3) {
      this.isResolved = true;
      outcomeMessage += ' 🎉 Crisis successfully resolved! Normal operations restored.';
    } else if (this.turn >= this.maxTurns) {
      this.isFailed = true;
      outcomeMessage += ' ❌ Out of turns! Incident exceeded SLA time limits.';
    } else if (this.budgetRemaining <= 0) {
      this.isFailed = true;
      outcomeMessage += ' ❌ Budget exhausted before system could be recovered.';
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
