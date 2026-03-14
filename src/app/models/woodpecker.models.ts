export type TacticalTheme = 'Scacco' | 'Cattura' | 'Promozione' | 'Arrocco' | 'Manovra';

export type WoodpeckerPuzzleCycleStatus = 'unseen' | 'solved' | 'slow' | 'failed';

export interface WoodpeckerPuzzleStatusSummary {
  puzzleIndex: number;
  status: WoodpeckerPuzzleCycleStatus;
  attempts: number;
  wrongAttempts: number;
  skippedAttempts: number;
  averageSolveTimeSeconds: number;
  lastElapsedSeconds: number;
  dueAt: number;
  lastAttemptAt: number;
}

export interface WoodpeckerStatusCounts {
  unseen: number;
  solved: number;
  slow: number;
  failed: number;
}

export interface WoodpeckerRoundPuzzleMetric {
  puzzleIndex: number;
  attempts: number;
  wrongAttempts: number;
  skippedAttempts: number;
  totalSolveTimeMs: number;
  averageSolveTimeMs: number;
  lastElapsedMs: number;
  dueAt: number;
  lastAttemptAt: number;
  status: WoodpeckerPuzzleCycleStatus;
}

export interface WoodpeckerCycleDelta {
  accuracyPercent: number;
  totalSolveTimeMs: number;
  wrongAttempts: number;
  skippedAttempts: number;
}

export interface HardSetPuzzleSummary {
  puzzleIndex: number;
  status: WoodpeckerPuzzleCycleStatus;
  wrongAttempts: number;
  skippedAttempts: number;
  averageSolveTimeSeconds: number;
  dueAt: number;
  lastAttemptAt: number;
  reasons: string[];
}

export interface WoodpeckerPuzzleStats {
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  skippedAttempts: number;
  totalSolveTimeMs: number;
  averageSolveTimeMs: number;
  currentStreak: number;
  bestStreak: number;
  ease: number;
  intervalDays: number;
  dueAt: number;
  lastAttemptAt: number;
  lastElapsedMs: number;
  lastOutcome: 'solved' | 'failed' | 'none';
}

export interface WoodpeckerSession {
  cycle: number;
  targetDays: number;
  cycleStartedAt: number;
  solvedIndexes: number[];
  completed: boolean;
  gameCount: number;
  failedQueue: number[];
  puzzleStatsByIndex: Record<string, WoodpeckerPuzzleStats>;
}

export interface WoodpeckerCycleSnapshot {
  cycle: number;
  targetDays: number;
  startedAt: number;
  completedAt: number | null;
  solvedCount: number;
  gameCount: number;
  attempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  skippedAttempts: number;
  totalSolveTimeMs: number;
  averageSolveTimeMs: number;
  accuracyPercent: number;
  progressPercent: number;
  remainingDays: number;
  hardSetCount: number;
  statusCounts: WoodpeckerStatusCounts;
  slowestPuzzles: WoodpeckerPuzzleStatusSummary[];
  hardestPuzzles: WoodpeckerPuzzleStatusSummary[];
  deltaFromPrevious: WoodpeckerCycleDelta | null;
  puzzleMetrics: Record<string, WoodpeckerRoundPuzzleMetric>;
  deadlineRisk: 'basso' | 'medio' | 'alto';
}

export interface WoodpeckerAttemptLog {
  at: number;
  pgnId: string;
  pgnName: string;
  puzzleIndex: number;
  correct: boolean;
  elapsedMs: number;
  cycle: number;
  targetDays: number;
  theme: TacticalTheme;
  skipped: boolean;
}

export interface WoodpeckerPuzzlePerformance {
  puzzleIndex: number;
  theme: TacticalTheme;
  correctAttempts: number;
  wrongAttempts: number;
  skippedAttempts: number;
  totalSolveTimeMs: number;
  averageSolveTimeMs: number;
  lastElapsedMs: number;
  lastAttemptAt: number;
}

export interface WoodpeckerPgnAnalytics {
  pgnId: string;
  pgnName: string;
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  skippedAttempts: number;
  totalSolveTimeMs: number;
  currentStreak: number;
  bestStreak: number;
  lastAttemptAt: number;
  themeErrors: Record<TacticalTheme, number>;
  attempts: WoodpeckerAttemptLog[];
  cycleSnapshots: Record<string, WoodpeckerCycleSnapshot>;
  puzzlePerformance: Record<string, WoodpeckerPuzzlePerformance>;
}

export interface ImprovementPoint {
  label: string;
  accuracy: number;
  attempts: number;
}

export interface FailedPuzzleSummary {
  puzzleIndex: number;
  wrongAttempts: number;
  skippedAttempts: number;
  averageSolveTimeSeconds: number;
  lastAttemptAt: number;
}

export interface WoodpeckerDashboardData {
  pgnId: string;
  pgnName: string;
  currentCycle: number;
  targetDays: number;
  accuracyPercent: number;
  currentStreak: number;
  averageSolveTimeSeconds: number;
  deadlineRisk: 'basso' | 'medio' | 'alto';
  cycleTimeline: WoodpeckerCycleSnapshot[];
  failedPuzzles: FailedPuzzleSummary[];
  hardSetQueue: HardSetPuzzleSummary[];
  currentCyclePuzzles: WoodpeckerPuzzleStatusSummary[];
  currentCycleStatusCounts: WoodpeckerStatusCounts;
  hasResumeSession: boolean;
  resumePuzzleIndex: number | null;
  pgnImprovement: ImprovementPoint[];
  globalImprovement: ImprovementPoint[];
}

export interface PuzzleDroidBackupBundle {
  version: 1;
  exportedAt: number;
  settings: unknown;
  libraryItems: unknown;
  woodpeckerSessions: unknown;
  woodpeckerAnalytics: Record<string, WoodpeckerPgnAnalytics>;
}
