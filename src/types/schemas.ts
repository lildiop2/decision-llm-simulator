import { z } from 'zod';

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ActionSchema = z.object({
  id: z.string().min(1, 'Action ID is required'),
  title: z.string().min(1, 'Action title is required'),
  description: z.string().min(1, 'Action description is required'),
  cost: z.number().nonnegative().optional(),
  risk: RiskLevelSchema,
  expectedImpact: z.string().optional(),
  requiredParameters: z.array(z.string()).optional()
});
export type Action = z.infer<typeof ActionSchema>;

export const ConstraintSchema = z.object({
  id: z.string().min(1, 'Constraint ID is required'),
  description: z.string().min(1, 'Constraint description is required'),
  isHardConstraint: z.boolean().optional(),
  forbiddenActionIds: z.array(z.string()).optional()
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const GoalPrioritySchema = z.enum(['primary', 'secondary', 'tertiary']);
export type GoalPriority = z.infer<typeof GoalPrioritySchema>;

export const GoalSchema = z.object({
  id: z.string().min(1, 'Goal ID is required'),
  description: z.string().min(1, 'Goal description is required'),
  priority: GoalPrioritySchema,
  weight: z.number().min(0).max(1).optional()
});
export type Goal = z.infer<typeof GoalSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1, 'Scenario ID is required'),
  title: z.string().min(1, 'Scenario title is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  context: z.string().min(1, 'Context narrative is required'),
  stateVariables: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  goals: z.array(GoalSchema).min(1, 'At least one goal is required'),
  constraints: z.array(ConstraintSchema).optional(),
  availableActions: z.array(ActionSchema).min(2, 'At least two actions must be available'),
  optimalActionId: z.string().min(1, 'Optimal action ID is required'),
  acceptableAlternativeIds: z.array(z.string()).optional(),
  forbiddenActionIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const RejectedAlternativeSchema = z.object({
  actionId: z.string().min(1, 'Rejected action ID is required'),
  reason: z.string().min(1, 'Rejection reason is required')
});
export type RejectedAlternative = z.infer<typeof RejectedAlternativeSchema>;

export const DecisionOutputSchema = z.object({
  thoughtProcess: z
    .string()
    .min(10, 'Thought process must contain at least 10 characters of reasoning'),
  selectedAction: z.string().min(1, 'Selected action ID cannot be empty'),
  actionParameters: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema,
  riskRationale: z.string().min(5, 'Risk rationale is required'),
  rejectedAlternatives: z.array(RejectedAlternativeSchema).optional(),
  contingencyPlan: z.string().optional()
});
export type DecisionOutput = z.infer<typeof DecisionOutputSchema>;

export const EvaluationResultSchema = z.object({
  validJson: z.boolean(),
  validSchema: z.boolean(),
  selectedActionValid: z.boolean(),
  passedHardConstraints: z.boolean(),
  constraintViolations: z.array(z.string()),
  isOptimal: z.boolean(),
  isAcceptable: z.boolean(),
  goalAlignmentScore: z.number().min(0).max(100),
  riskCalibrationScore: z.number().min(0).max(100),
  reasoningDepthScore: z.number().min(0).max(100),
  totalScore: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  latencyMs: z.number().nonnegative(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional()
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const SimulationStepResultSchema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  model: z.string(),
  timestamp: z.string(),
  decision: DecisionOutputSchema.optional(),
  evaluation: EvaluationResultSchema,
  rawOutput: z.string()
});
export type SimulationStepResult = z.infer<typeof SimulationStepResultSchema>;

export const BenchmarkReportSchema = z.object({
  suiteTitle: z.string(),
  generatedAt: z.string(),
  modelsTested: z.array(z.string()),
  totalRuns: z.number(),
  results: z.array(SimulationStepResultSchema),
  modelSummaries: z.record(
    z.object({
      runsCount: z.number(),
      schemaPassRate: z.number(),
      hardConstraintPassRate: z.number(),
      optimalActionRate: z.number(),
      averageTotalScore: z.number(),
      averageLatencyMs: z.number()
    })
  )
});
export type BenchmarkReport = z.infer<typeof BenchmarkReportSchema>;
