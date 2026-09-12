/** Frozen AutoMedic Mission Control `/state` contract (v1). Do not change after T+9 without both tracks agreeing. */

export type MissionStatus =
  | "WATCHING"
  | "SCANNING"
  | "HEALING"
  | "HEALED"
  | "ERROR";

export type WorkflowHealth = "healthy" | "unhealthy" | "unknown";

export type ExecutionStatus = "success" | "error" | "running" | "unknown";

export type FailureType =
  | "FIELD_MAPPING"
  | "AUTH_EXPIRED"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "API_ERROR"
  | "SEMANTIC_MISMATCH"
  | "SILENT_DRIFT"
  | "UNKNOWN";

export type IncidentStatus =
  | "detected"
  | "diagnosing"
  | "diagnosed"
  | "gate_passed"
  | "gate_refused"
  | "patching"
  | "patched"
  | "re_running"
  | "verified"
  | "repair_failed"
  | "escalated"
  | "suppressed";

export type TimelineStep =
  | "DETECTED"
  | "DIAGNOSING"
  | "DIAGNOSED"
  | "GATE"
  | "PATCHING"
  | "PATCHED"
  | "RE_RUNNING"
  | "VERIFIED"
  | "ESCALATED"
  | "SUPPRESSED";

export type TimelineStepStatus =
  | "pending"
  | "active"
  | "done"
  | "failed"
  | "skipped";

export interface WatchedWorkflow {
  id: string;
  name: string;
  tag: "automedic:watch" | string;
  health: WorkflowHealth;
  lastExecutionId: string | null;
  lastExecutionStatus: ExecutionStatus | null;
  lastExecutionAt: string | null;
}

/** Live snapshot of the watched victim workflow (from n8n API). */
export interface PatientGraphNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  role?: "auth" | "map" | "trigger" | "gate" | "normal" | string;
}

export interface PatientGraphEdge {
  from: string;
  to: string;
}

export interface PatientGraph {
  workflowId: string;
  workflowName: string;
  nodes: PatientGraphNode[];
  edges: PatientGraphEdge[];
  openInN8nUrl?: string;
}

export interface Stats {
  autoHealedCount: number;
  mttrSeconds: number | null;
  humanTouches: number;
  watchedCount: number;
  openIncidents: number;
}

export interface Diagnosis {
  failureType: FailureType;
  confidence: number;
  autoRepairSafe: boolean;
  reason: string;
  sourceField: string | null;
  targetField: string | null;
  observedFields: string[];
  failedNodeName: string;
}

export interface Gate {
  passed: boolean;
  threshold: number;
  summary: string;
}

export interface Patch {
  nodeName: string;
  oldMapping: string;
  newMapping: string;
  before: string;
  after: string;
  replacementCount: number;
  workflowVersionBefore: number | null;
  workflowVersionAfter: number | null;
  snapshotId: string | null;
}

export interface Verify {
  newExecutionId: string | null;
  status: ExecutionStatus | null;
  durationMs: number | null;
}

export interface TimelineEvent {
  step: TimelineStep;
  status: TimelineStepStatus;
  message: string | null;
  at: string | null;
  durationMs: number | null;
}

export interface RemapSuggestion {
  mappedField: string;
  expectedField?: string;
  replacementField: string;
  kind?: string;
}

export interface Incident {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  failedNode: string;
  errorMessage: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  diagnosis: Diagnosis | null;
  gate: Gate | null;
  patch: Patch | null;
  verify: Verify | null;
  timeline: TimelineEvent[];
  /** Level 3 / HITL proposals — human must approve before patch. */
  suggestions?: RemapSuggestion[];
}

/** Response body for GET /automedic/state */
export interface AutomedicState {
  version: 1;
  generatedAt: string;
  status: MissionStatus;
  lastScanAt: string | null;
  watchedWorkflows: WatchedWorkflow[];
  stats: Stats;
  /** Newest / most relevant first. Reset state keeps the seeded AUTH_EXPIRED incident. */
  incidents: Incident[];
  /** Incident the UI should focus (timeline/diagnosis/diff). */
  activeIncidentId: string | null;
  /** Live Revenue Ops graph from n8n (optional; null if fetch failed). */
  patientGraph?: PatientGraph | null;
}
