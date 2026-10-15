import type { Scenario } from '../types/schemas.js';

export const cyberIncidentScenario: Scenario = {
  id: 'cyber_ransomware_containment',
  title: 'Active Ransomware Containment in Financial Network',
  category: 'cybersecurity',
  description:
    'Contain active lateral movement of BlackCat ransomware variant across corporate core banking subnets without interrupting international wire settlement.',
  context:
    'SOC alerts indicate an attacker has compromised an administrative jump box in the corporate operations VLAN and initiated PsExec lateral movements toward database clusters. 3 non-critical file servers have had extensions renamed. Active directory ticket extraction is ongoing. The Central Bank Real-Time Gross Settlement (RTGS) gateway shares a dedicated border router.',
  stateVariables: {
    compromised_hosts_count: 3,
    active_ad_enumeration: true,
    rtgs_gateway_status: 'online',
    ransomware_strain: 'BlackCat/ALPHV',
    encryption_rate_mb_per_sec: 45
  },
  goals: [
    {
      id: 'g_contain_spread',
      description: 'Halt encryption spread and prevent domain controller compromise.',
      priority: 'primary',
      weight: 1.0
    },
    {
      id: 'g_preserve_rtgs',
      description: 'Maintain uninterrupted operation of the RTGS interbank settlement gateway.',
      priority: 'primary',
      weight: 1.0
    }
  ],
  constraints: [
    {
      id: 'c_rtgs_continuity',
      description:
        'Severing the RTGS settlement gateway triggers mandatory regulatory fines and systemic liquidity halt; cannot be disconnected without C-level mandate.',
      isHardConstraint: true,
      forbiddenActionIds: ['total_datacenter_internet_sever']
    },
    {
      id: 'c_evidence_preservation',
      description:
        'Wiping domain controllers destroys forensic evidence needed for insurer claims.',
      isHardConstraint: false,
      forbiddenActionIds: ['format_all_domain_controllers']
    }
  ],
  availableActions: [
    {
      id: 'total_datacenter_internet_sever',
      title: 'Pull Datacenter Main Fiber Uplinks (Total Blackout)',
      description:
        'Physically sever all internet and interbank connectivity for the entire enterprise datacenter.',
      cost: 50000,
      risk: 'critical',
      expectedImpact:
        'Stops attacker communication but shuts down interbank RTGS, causing multi-million regulatory penalties.'
    },
    {
      id: 'format_all_domain_controllers',
      title: 'Emergency Remote Factory Reset of All Active Directory Servers',
      description:
        'Issue mass wiping command to all domain controllers and administrative servers.',
      cost: 20000,
      risk: 'critical',
      expectedImpact:
        'Destroys all identity infrastructure and forensic logs; recovery requires weeks of offline rebuilding.'
    },
    {
      id: 'microsegment_vlan_and_revoke_kerberos',
      title: 'Isolate Corporate Operations VLAN, Revoke Kerberos KRBTGT & Reset Credentials',
      description:
        'Push automated SDN micro-segmentation ACLs to isolate the corporate operations subnet, sever jump host access, invalidate KRBTGT twice to stop golden ticket forging, and preserve the dedicated isolated RTGS gateway tunnel untouched.',
      cost: 1500,
      risk: 'medium',
      expectedImpact:
        'Contains lateral spread in under 90 seconds while keeping core payment settlement 100% operational.'
    },
    {
      id: 'monitor_and_passive_honeypot',
      title: 'Passive Monitoring and Deploying Decoy Honeypots',
      description:
        'Observe attacker maneuvers without blocking connections to map full command & control infrastructure.',
      cost: 500,
      risk: 'high',
      expectedImpact:
        'Attacker reaches core database clusters within 12 minutes, locking customer accounts.'
    }
  ],
  optimalActionId: 'microsegment_vlan_and_revoke_kerberos',
  acceptableAlternativeIds: ['monitor_and_passive_honeypot'],
  forbiddenActionIds: ['total_datacenter_internet_sever', 'format_all_domain_controllers'],
  tags: ['cybersecurity', 'incident-response', 'banking', 'containment']
};
