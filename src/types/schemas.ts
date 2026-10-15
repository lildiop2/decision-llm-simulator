import { z } from 'zod';

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ActionSchema = z.object({
  id: z.string().min(1, 'ID da ação é obrigatório'),
  title: z.string().min(1, 'Título da ação é obrigatório'),
  description: z.string().min(1, 'Descrição da ação é obrigatória'),
  cost: z.number().nonnegative().optional(),
  risk: RiskLevelSchema,
  expectedImpact: z.string().optional(),
  requiredParameters: z.array(z.string()).optional()
});
export type Action = z.infer<typeof ActionSchema>;

export const ConstraintSchema = z.object({
  id: z.string().min(1, 'ID da restrição é obrigatório'),
  description: z.string().min(1, 'Descrição da restrição é obrigatória'),
  isHardConstraint: z.boolean().optional(),
  forbiddenActionIds: z.array(z.string()).optional()
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const GoalPrioritySchema = z.enum(['primary', 'secondary', 'tertiary']);
export type GoalPriority = z.infer<typeof GoalPrioritySchema>;

export const GoalSchema = z.object({
  id: z.string().min(1, 'ID do objetivo é obrigatório'),
  description: z.string().min(1, 'Descrição do objetivo é obrigatória'),
  priority: GoalPrioritySchema,
  weight: z.number().min(0).max(1).optional()
});
export type Goal = z.infer<typeof GoalSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1, 'ID do cenário é obrigatório'),
  title: z.string().min(1, 'Título do cenário é obrigatório'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  context: z.string().min(1, 'Contexto operacional é obrigatório'),
  stateVariables: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  goals: z.array(GoalSchema).min(1, 'Pelo menos um objetivo é obrigatório'),
  constraints: z.array(ConstraintSchema).optional(),
  availableActions: z.array(ActionSchema).min(2, 'Pelo menos duas ações devem estar disponíveis'),
  optimalActionId: z.string().min(1, 'ID da ação ótima é obrigatório'),
  acceptableAlternativeIds: z.array(z.string()).optional(),
  forbiddenActionIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const RejectedAlternativeSchema = z.object({
  actionId: z.string().min(1, 'ID da ação rejeitada é obrigatório'),
  reason: z.string().min(1, 'Motivo da rejeição é obrigatório')
});
export type RejectedAlternative = z.infer<typeof RejectedAlternativeSchema>;

export const DecisionOutputSchema = z.object({
  thoughtProcess: z
    .string()
    .min(10, 'O processo de raciocínio deve conter no mínimo 10 caracteres'),
  selectedAction: z.string().min(1, 'O ID da ação selecionada não pode ser vazio'),
  actionParameters: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema,
  riskRationale: z.string().min(5, 'A justificativa de risco deve ter no mínimo 5 caracteres'),
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
