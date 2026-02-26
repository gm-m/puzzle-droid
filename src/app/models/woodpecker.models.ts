export type TacticalTheme = 'Scacco' | 'Cattura' | 'Promozione' | 'Arrocco' | 'Manovra';

export interface WoodpeckerPuzzleStats {
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  totalSolveTimeMs: number;
  averageSolveTimeMs: number;
  currentStreak: number;
  bestStreak: number;
  ease: number;
  intervalDays: number;
  dueAt: number;
  lastAttemptAt: number;
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
  totalSolveTimeMs: number;
  averageSolveTimeMs: number;
  progressPercent: number;
  remainingDays: number;
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
}

export interface WoodpeckerPuzzlePerformance {
  puzzleIndex: number;
  theme: TacticalTheme;
  correctAttempts: number;
  wrongAttempts: number;
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
