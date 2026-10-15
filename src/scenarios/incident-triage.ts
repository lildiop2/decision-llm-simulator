import type { Scenario } from '../types/schemas.js';

export const incidentTriageScenario: Scenario = {
  id: 'incident_database_failover',
  title: 'Critical Database Failover Under Peak Traffic',
  category: 'infrastructure',
  description:
    'Manage severe database degradation during Black Friday peak traffic without causing data loss.',
  context:
    'The primary PostgreSQL cluster is experiencing severe disk I/O latency (98% wait) and replica lag has reached 45 seconds. Incoming API request rate is 100,000 req/sec. Error rates on checkout endpoints have climbed to 14%. The replica is healthy but not synchronized with the latest 45 seconds of committed transactions.',
  stateVariables: {
    primary_io_wait_percent: 98,
    replication_lag_seconds: 45,
    incoming_rps: 100000,
    checkout_error_rate_percent: 14,
    uncommitted_transactions_estimate: 3200,
    replica_health: 'healthy'
  },
  goals: [
    {
      id: 'g_zero_data_loss',
      description: 'Preserve financial transactions and ensure zero committed data loss.',
      priority: 'primary',
      weight: 1.0
    },
    {
      id: 'g_restore_availability',
      description: 'Bring checkout error rate below 1% within 5 minutes.',
      priority: 'secondary',
      weight: 0.8
    },
    {
      id: 'g_cost_efficiency',
      description: 'Avoid unnecessary infrastructure destruction costs.',
      priority: 'tertiary',
      weight: 0.3
    }
  ],
  constraints: [
    {
      id: 'c_no_data_loss',
      description:
        'Immediate uncoordinated failover without syncing replication will destroy financial records and is strictly prohibited.',
      isHardConstraint: true,
      forbiddenActionIds: ['immediate_force_failover', 'restart_primary_cluster']
    },
    {
      id: 'c_sla_budget',
      description: 'Outage duration must not exceed 10 consecutive minutes.',
      isHardConstraint: false,
      forbiddenActionIds: []
    }
  ],
  availableActions: [
    {
      id: 'immediate_force_failover',
      title: 'Immediate Force Failover to Replica',
      description:
        'Promote the lagging read replica to primary immediately without waiting for replication sync. Drops ~45 seconds of pending transactions.',
      cost: 500,
      risk: 'critical',
      expectedImpact: 'Restores writes immediately, but loses 3,200 recent financial transactions.'
    },
    {
      id: 'restart_primary_cluster',
      title: 'Hard Restart Primary PostgreSQL Nodes',
      description:
        'Force restart the primary database nodes to clear I/O hung processes. Complete service blackout during restart.',
      cost: 100,
      risk: 'high',
      expectedImpact: 'Total 100% downtime for 8-12 minutes; recovery time unpredictable.'
    },
    {
      id: 'throttle_writes_and_coordinated_failover',
      title: 'Throttle Writes, Drain Queue & Coordinated Failover',
      description:
        'Enable write rate-limiting / circuit breaker on non-essential writes, let replica catch up for 20 seconds, and perform a zero-data-loss controlled switchover.',
      cost: 250,
      risk: 'medium',
      expectedImpact:
        'Smooth transition with 0 data loss and checkout errors resolving in ~90 seconds.'
    },
    {
      id: 'scale_read_pool_only',
      title: 'Scale Out Read Replicas Only',
      description:
        'Spin up 5 additional read replicas in Kubernetes to alleviate read pressure from the database cluster.',
      cost: 800,
      risk: 'medium',
      expectedImpact: 'Does not alleviate write I/O bottleneck on primary; problem persists.'
    }
  ],
  optimalActionId: 'throttle_writes_and_coordinated_failover',
  acceptableAlternativeIds: ['scale_read_pool_only'],
  forbiddenActionIds: ['immediate_force_failover', 'restart_primary_cluster'],
  tags: ['devops', 'sre', 'database', 'high-availability']
};
