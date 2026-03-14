import { Injectable } from '@angular/core';
import {
  type FailedPuzzleSummary,
  type HardSetPuzzleSummary,
  type ImprovementPoint,
  type PuzzleDroidBackupBundle,
  type TacticalTheme,
  type WoodpeckerAttemptLog,
  type WoodpeckerCycleDelta,
  type WoodpeckerCycleSnapshot,
  type WoodpeckerDashboardData,
  type WoodpeckerPuzzleCycleStatus,
  type WoodpeckerPgnAnalytics,
  type WoodpeckerPuzzlePerformance,
  type WoodpeckerPuzzleStatusSummary,
  type WoodpeckerRoundPuzzleMetric,
  type WoodpeckerSession,
  type WoodpeckerStatusCounts,
} from '../models/woodpecker.models';

const SETTINGS_STORAGE_KEY = 'puzzle-droid-settings-v1';
const LIBRARY_STORAGE_KEY = 'puzzle-droid-library-items-v1';
const WOODPECKER_STORAGE_KEY = 'puzzle-droid-woodpecker-sessions-v1';
const WOODPECKER_ANALYTICS_STORAGE_KEY = 'puzzle-droid-woodpecker-analytics-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const WOODPECKER_SLOW_SOLVE_MS = 45_000;
const HARD_SET_STALE_DAYS = 7;

export interface RecordAttemptInput {
  pgnId: string;
  pgnName: string;
  puzzleIndex: number;
  correct: boolean;
  elapsedMs: number;
  cycle: number;
  targetDays: number;
  theme: TacticalTheme;
  session: WoodpeckerSession | null;
  skipped: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class WoodpeckerAnalyticsService {
  private analyticsByPgnId: Record<string, WoodpeckerPgnAnalytics> = this.loadAnalytics();

  recordAttempt(input: RecordAttemptInput): void {
    const now = Date.now();
    const entry = this.ensureEntry(input.pgnId, input.pgnName);
    const elapsedMs = Math.max(0, Math.trunc(input.elapsedMs));

    const attempt: WoodpeckerAttemptLog = {
      at: now,
      pgnId: input.pgnId,
      pgnName: input.pgnName,
      puzzleIndex: Math.max(0, Math.trunc(input.puzzleIndex)),
      correct: input.correct,
      elapsedMs,
      cycle: Math.max(1, Math.trunc(input.cycle)),
      targetDays: Math.max(1, Math.trunc(input.targetDays)),
      theme: input.theme,
      skipped: input.skipped === true,
    };

    entry.pgnName = input.pgnName;
    entry.totalAttempts += 1;
    entry.lastAttemptAt = now;
    entry.totalSolveTimeMs += elapsedMs;

    if (attempt.correct) {
      entry.correctAttempts += 1;
      entry.currentStreak += 1;
      entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
    } else if (attempt.skipped) {
      entry.skippedAttempts += 1;
      entry.currentStreak = 0;
    } else {
      entry.wrongAttempts += 1;
      entry.currentStreak = 0;
      entry.themeErrors[input.theme] += 1;
    }

    entry.attempts = [...entry.attempts.slice(-399), attempt];

    const puzzleKey = String(attempt.puzzleIndex);
    const puzzle = entry.puzzlePerformance[puzzleKey] ?? this.createPuzzlePerformance(attempt.puzzleIndex, attempt.theme);
    const nextPuzzle: WoodpeckerPuzzlePerformance = {
      ...puzzle,
      theme: attempt.theme,
      lastAttemptAt: now,
      lastElapsedMs: elapsedMs,
      totalSolveTimeMs: puzzle.totalSolveTimeMs + elapsedMs,
      correctAttempts: puzzle.correctAttempts + (attempt.correct ? 1 : 0),
      wrongAttempts: puzzle.wrongAttempts + (attempt.correct || attempt.skipped ? 0 : 1),
      skippedAttempts: puzzle.skippedAttempts + (attempt.skipped ? 1 : 0),
      averageSolveTimeMs: 0,
    };
    const puzzleAttempts = nextPuzzle.correctAttempts + nextPuzzle.wrongAttempts + nextPuzzle.skippedAttempts;
    nextPuzzle.averageSolveTimeMs = puzzleAttempts > 0 ? Math.round(nextPuzzle.totalSolveTimeMs / puzzleAttempts) : 0;
    entry.puzzlePerformance[puzzleKey] = nextPuzzle;

    const cycleKey = String(attempt.cycle);
    const previousCycle = entry.cycleSnapshots[cycleKey] ?? this.createCycleSnapshot(attempt.cycle, attempt.targetDays, now);
    const previousCycleForDelta = entry.cycleSnapshots[String(attempt.cycle - 1)] ?? null;
    entry.cycleSnapshots[cycleKey] = this.updateCycleSnapshot(previousCycle, previousCycleForDelta, attempt, input.session, now);

    this.analyticsByPgnId = {
      ...this.analyticsByPgnId,
      [input.pgnId]: entry,
    };

    this.persistAnalytics();
  }

  getDashboardData(pgnId: string): WoodpeckerDashboardData | null {
    const entry = this.analyticsByPgnId[pgnId];
    if (!entry) {
      return null;
    }

    const accuracyPercent = entry.totalAttempts > 0 ? Math.round((entry.correctAttempts / entry.totalAttempts) * 100) : 0;
    const averageSolveTimeMs = entry.totalAttempts > 0 ? Math.round(entry.totalSolveTimeMs / entry.totalAttempts) : 0;
    const cycleTimeline = Object.values(entry.cycleSnapshots).sort((a, b) => a.cycle - b.cycle);
    const activeCycle = cycleTimeline.at(-1);
    const session = this.findSessionByPgnId(pgnId);
    const currentCyclePuzzles = this.buildCurrentCyclePuzzles(session);
    const failedPuzzles = this.buildCurrentCycleFailedPuzzles(currentCyclePuzzles);
    const currentCycleStatusCounts = this.countStatuses(currentCyclePuzzles);
    const hardSetQueue = this.buildHardSetQueue(session, currentCyclePuzzles);
    const resumePuzzleIndex = this.computeResumePuzzleIndex(entry, session);
    const hasResumeSession = Boolean(session && !session.completed && session.gameCount > 0 && resumePuzzleIndex !== null);

    return {
      pgnId: entry.pgnId,
      pgnName: entry.pgnName,
      currentCycle: activeCycle?.cycle ?? 1,
      targetDays: activeCycle?.targetDays ?? 1,
      accuracyPercent,
      currentStreak: entry.currentStreak,
      averageSolveTimeSeconds: Number((averageSolveTimeMs / 1000).toFixed(1)),
      deadlineRisk: activeCycle?.deadlineRisk ?? 'basso',
      cycleTimeline,
      failedPuzzles,
      hardSetQueue,
      currentCyclePuzzles,
      currentCycleStatusCounts,
      hasResumeSession,
      resumePuzzleIndex,
      pgnImprovement: this.buildImprovement(entry.attempts),
      globalImprovement: this.buildImprovement(Object.values(this.analyticsByPgnId).flatMap((item) => item.attempts)),
    };
  }

  getAvailablePgns(): Array<{ pgnId: string; pgnName: string }> {
    return Object.values(this.analyticsByPgnId)
      .map((entry) => ({ pgnId: entry.pgnId, pgnName: entry.pgnName }))
      .sort((a, b) => a.pgnName.localeCompare(b.pgnName));
  }

  exportBackupBundle(): string {
    const bundle: PuzzleDroidBackupBundle = {
      version: 1,
      exportedAt: Date.now(),
      settings: this.readJson(SETTINGS_STORAGE_KEY),
      libraryItems: this.readJson(LIBRARY_STORAGE_KEY),
      woodpeckerSessions: this.readJson(WOODPECKER_STORAGE_KEY),
      woodpeckerAnalytics: this.analyticsByPgnId,
    };

    return JSON.stringify(bundle, null, 2);
  }

  importBackupBundle(rawText: string): { ok: boolean; message: string } {
    try {
      const parsed = JSON.parse(rawText) as Partial<PuzzleDroidBackupBundle>;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, message: 'Formato backup non valido.' };
      }

      if ('settings' in parsed) {
        this.writeJson(SETTINGS_STORAGE_KEY, parsed.settings ?? null);
      }
      if ('libraryItems' in parsed) {
        this.writeJson(LIBRARY_STORAGE_KEY, parsed.libraryItems ?? []);
      }
      if ('woodpeckerSessions' in parsed) {
        this.writeJson(WOODPECKER_STORAGE_KEY, parsed.woodpeckerSessions ?? {});
      }
      if ('woodpeckerAnalytics' in parsed && parsed.woodpeckerAnalytics && typeof parsed.woodpeckerAnalytics === 'object') {
        this.analyticsByPgnId = parsed.woodpeckerAnalytics as Record<string, WoodpeckerPgnAnalytics>;
        this.persistAnalytics();
      }

      return { ok: true, message: 'Backup importato. Ricarica la pagina per applicare tutti i dati.' };
    } catch {
      return { ok: false, message: 'Impossibile importare il backup: JSON non valido.' };
    }
  }

  private ensureEntry(pgnId: string, pgnName: string): WoodpeckerPgnAnalytics {
    return (
      this.analyticsByPgnId[pgnId] ?? {
        pgnId,
        pgnName,
        totalAttempts: 0,
        correctAttempts: 0,
        wrongAttempts: 0,
        skippedAttempts: 0,
        totalSolveTimeMs: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastAttemptAt: 0,
        themeErrors: {
          Scacco: 0,
          Cattura: 0,
          Promozione: 0,
          Arrocco: 0,
          Manovra: 0,
        },
        attempts: [],
        cycleSnapshots: {},
        puzzlePerformance: {},
      }
    );
  }

  private createPuzzlePerformance(puzzleIndex: number, theme: TacticalTheme): WoodpeckerPuzzlePerformance {
    return {
      puzzleIndex,
      theme,
      correctAttempts: 0,
      wrongAttempts: 0,
      skippedAttempts: 0,
      totalSolveTimeMs: 0,
      averageSolveTimeMs: 0,
      lastElapsedMs: 0,
      lastAttemptAt: 0,
    };
  }

  private createCycleSnapshot(cycle: number, targetDays: number, startedAt: number): WoodpeckerCycleSnapshot {
    return {
      cycle,
      targetDays,
      startedAt,
      completedAt: null,
      solvedCount: 0,
      gameCount: 0,
      attempts: 0,
      correctAttempts: 0,
      wrongAttempts: 0,
      skippedAttempts: 0,
      totalSolveTimeMs: 0,
      averageSolveTimeMs: 0,
      accuracyPercent: 0,
      progressPercent: 0,
      remainingDays: targetDays,
      hardSetCount: 0,
      statusCounts: {
        unseen: 0,
        solved: 0,
        slow: 0,
        failed: 0,
      },
      slowestPuzzles: [],
      hardestPuzzles: [],
      deltaFromPrevious: null,
      puzzleMetrics: {},
      deadlineRisk: 'basso',
    };
  }

  private updateCycleSnapshot(
    previous: WoodpeckerCycleSnapshot,
    previousCycle: WoodpeckerCycleSnapshot | null,
    attempt: WoodpeckerAttemptLog,
    session: WoodpeckerSession | null,
    now: number,
  ): WoodpeckerCycleSnapshot {
    const attempts = previous.attempts + 1;
    const correctAttempts = previous.correctAttempts + (attempt.correct ? 1 : 0);
    const wrongAttempts = previous.wrongAttempts + (attempt.correct || attempt.skipped ? 0 : 1);
    const skippedAttempts = previous.skippedAttempts + (attempt.skipped ? 1 : 0);
    const totalSolveTimeMs = previous.totalSolveTimeMs + attempt.elapsedMs;
    const solvedCount = session?.solvedIndexes.length ?? previous.solvedCount;
    const gameCount = session?.gameCount ?? previous.gameCount;
    const progressPercent = gameCount > 0 ? Math.round((solvedCount / gameCount) * 100) : previous.progressPercent;
    const puzzleMetrics = this.buildPuzzleMetrics(session, gameCount);
    const puzzleSummaries = this.toPuzzleSummaries(puzzleMetrics);
    const statusCounts = this.countStatuses(puzzleSummaries);
    const hardSetCount = session?.failedQueue.length ?? previous.hardSetCount;
    const accuracyPercent = attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : 0;

    const cycleStartedAt = session?.cycleStartedAt ?? previous.startedAt;
    const elapsedDays = Math.floor(Math.max(0, now - cycleStartedAt) / DAY_MS) + 1;
    const remainingDays = Math.max(0, (session?.targetDays ?? previous.targetDays) - elapsedDays);

    return {
      ...previous,
      targetDays: session?.targetDays ?? previous.targetDays,
      startedAt: cycleStartedAt,
      completedAt: session?.completed ? now : previous.completedAt,
      solvedCount,
      gameCount,
      attempts,
      correctAttempts,
      wrongAttempts,
      skippedAttempts,
      totalSolveTimeMs,
      averageSolveTimeMs: attempts > 0 ? Math.round(totalSolveTimeMs / attempts) : 0,
      accuracyPercent,
      progressPercent,
      remainingDays,
      hardSetCount,
      statusCounts,
      slowestPuzzles: [...puzzleSummaries]
        .filter((puzzle) => puzzle.attempts > 0)
        .sort((a, b) => b.lastElapsedSeconds - a.lastElapsedSeconds || b.averageSolveTimeSeconds - a.averageSolveTimeSeconds)
        .slice(0, 5),
      hardestPuzzles: [...puzzleSummaries]
        .filter((puzzle) => puzzle.wrongAttempts > 0 || puzzle.skippedAttempts > 0)
        .sort(
          (a, b) =>
            b.wrongAttempts - a.wrongAttempts ||
            b.skippedAttempts - a.skippedAttempts ||
            b.lastAttemptAt - a.lastAttemptAt,
        )
        .slice(0, 5),
      deltaFromPrevious: previousCycle
        ? this.buildCycleDelta(previousCycle, {
            accuracyPercent,
            totalSolveTimeMs,
            wrongAttempts,
            skippedAttempts,
          })
        : null,
      puzzleMetrics,
      deadlineRisk: this.computeDeadlineRisk(progressPercent, remainingDays, session?.targetDays ?? previous.targetDays),
    };
  }

  private buildCycleDelta(
    previousCycle: WoodpeckerCycleSnapshot,
    current: Pick<WoodpeckerCycleDelta, 'accuracyPercent' | 'totalSolveTimeMs' | 'wrongAttempts' | 'skippedAttempts'>,
  ): WoodpeckerCycleDelta {
    return {
      accuracyPercent: current.accuracyPercent - previousCycle.accuracyPercent,
      totalSolveTimeMs: current.totalSolveTimeMs - previousCycle.totalSolveTimeMs,
      wrongAttempts: current.wrongAttempts - previousCycle.wrongAttempts,
      skippedAttempts: current.skippedAttempts - previousCycle.skippedAttempts,
    };
  }

  private computeDeadlineRisk(progressPercent: number, remainingDays: number, targetDays: number): 'basso' | 'medio' | 'alto' {
    if (remainingDays <= 1 || (progressPercent < 50 && remainingDays <= Math.max(1, Math.ceil(targetDays * 0.2)))) {
      return 'alto';
    }

    if (remainingDays <= 3 || progressPercent < 70) {
      return 'medio';
    }

    return 'basso';
  }

  private buildImprovement(attempts: WoodpeckerAttemptLog[]): ImprovementPoint[] {
    const grouped = new Map<string, { correct: number; total: number }>();
    for (const attempt of attempts) {
      const day = new Date(attempt.at).toISOString().slice(0, 10);
      const current = grouped.get(day) ?? { correct: 0, total: 0 };
      current.total += 1;
      if (attempt.correct) {
        current.correct += 1;
      }
      grouped.set(day, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([label, value]) => ({
        label,
        attempts: value.total,
        accuracy: value.total > 0 ? Math.round((value.correct / value.total) * 100) : 0,
      }));
  }

  private buildCurrentCycleFailedPuzzles(currentCyclePuzzles: WoodpeckerPuzzleStatusSummary[]): FailedPuzzleSummary[] {
    return currentCyclePuzzles
      .filter(
        (puzzle) =>
          puzzle.status !== 'unseen' &&
          (puzzle.wrongAttempts > 0 || puzzle.skippedAttempts > 0),
      )
      .sort((a, b) => b.wrongAttempts - a.wrongAttempts || b.skippedAttempts - a.skippedAttempts || b.lastAttemptAt - a.lastAttemptAt)
      .map((puzzle) => ({
        puzzleIndex: puzzle.puzzleIndex,
        wrongAttempts: puzzle.wrongAttempts,
        skippedAttempts: puzzle.skippedAttempts,
        averageSolveTimeSeconds: puzzle.averageSolveTimeSeconds,
        lastAttemptAt: puzzle.lastAttemptAt,
      }));
  }

  private buildCurrentCyclePuzzles(session: WoodpeckerSession | null): WoodpeckerPuzzleStatusSummary[] {
    if (!session || session.gameCount <= 0) {
      return [];
    }

    const puzzleMetrics = this.buildPuzzleMetrics(session, session.gameCount);
    return this.toPuzzleSummaries(puzzleMetrics);
  }

  private buildPuzzleMetrics(session: WoodpeckerSession | null, gameCount: number): Record<string, WoodpeckerRoundPuzzleMetric> {
    if (!session || gameCount <= 0) {
      return {};
    }

    const solvedSet = new Set(session.solvedIndexes);
    const failedSet = new Set(session.failedQueue);
    const metrics: Record<string, WoodpeckerRoundPuzzleMetric> = {};

    for (let index = 0; index < gameCount; index += 1) {
      const stats = this.getSessionPuzzleStats(session, index);
      metrics[String(index)] = {
        puzzleIndex: index,
        attempts: stats.totalAttempts,
        wrongAttempts: stats.wrongAttempts,
        skippedAttempts: stats.skippedAttempts,
        totalSolveTimeMs: stats.totalSolveTimeMs,
        averageSolveTimeMs: stats.averageSolveTimeMs,
        lastElapsedMs: stats.lastElapsedMs,
        dueAt: stats.dueAt,
        lastAttemptAt: stats.lastAttemptAt,
        status: this.resolvePuzzleStatus(index, stats, session.cycleStartedAt, solvedSet, failedSet),
      };
    }

    return metrics;
  }

  private toPuzzleSummaries(puzzleMetrics: Record<string, WoodpeckerRoundPuzzleMetric>): WoodpeckerPuzzleStatusSummary[] {
    return Object.values(puzzleMetrics)
      .sort((a, b) => a.puzzleIndex - b.puzzleIndex)
      .map((metric) => ({
        puzzleIndex: metric.puzzleIndex,
        status: metric.status,
        attempts: metric.attempts,
        wrongAttempts: metric.wrongAttempts,
        skippedAttempts: metric.skippedAttempts,
        averageSolveTimeSeconds: Number((metric.averageSolveTimeMs / 1000).toFixed(1)),
        lastElapsedSeconds: Number((metric.lastElapsedMs / 1000).toFixed(1)),
        dueAt: metric.dueAt,
        lastAttemptAt: metric.lastAttemptAt,
      }));
  }

  private buildHardSetQueue(
    session: WoodpeckerSession | null,
    currentCyclePuzzles: WoodpeckerPuzzleStatusSummary[],
  ): HardSetPuzzleSummary[] {
    if (!session || session.failedQueue.length === 0) {
      return [];
    }

    const now = Date.now();
    const byIndex = new Map(currentCyclePuzzles.map((puzzle) => [puzzle.puzzleIndex, puzzle]));

    return session.failedQueue
      .map((puzzleIndex) => {
        const summary = byIndex.get(puzzleIndex);
        const stats = this.getSessionPuzzleStats(session, puzzleIndex);
        const reasons: string[] = [];
        if (stats.wrongAttempts > 1) {
          reasons.push('sbagliato più volte');
        }
        if (stats.lastElapsedMs >= WOODPECKER_SLOW_SOLVE_MS) {
          reasons.push('risolto lentamente');
        }
        if (stats.lastAttemptAt > 0 && now - stats.lastAttemptAt >= HARD_SET_STALE_DAYS * DAY_MS) {
          reasons.push('torna dopo molti giorni');
        }
        if (stats.skippedAttempts > 0) {
          reasons.push('saltato / arreso');
        }
        if (reasons.length === 0) {
          reasons.push('in coda SRS');
        }

        return {
          puzzleIndex,
          status: summary?.status ?? 'failed',
          wrongAttempts: stats.wrongAttempts,
          skippedAttempts: stats.skippedAttempts,
          averageSolveTimeSeconds: Number((stats.averageSolveTimeMs / 1000).toFixed(1)),
          dueAt: stats.dueAt,
          lastAttemptAt: stats.lastAttemptAt,
          reasons,
        } satisfies HardSetPuzzleSummary;
      })
      .sort((a, b) => a.dueAt - b.dueAt || b.wrongAttempts - a.wrongAttempts || b.lastAttemptAt - a.lastAttemptAt);
  }

  private countStatuses(puzzles: WoodpeckerPuzzleStatusSummary[]): WoodpeckerStatusCounts {
    return puzzles.reduce<WoodpeckerStatusCounts>(
      (acc, puzzle) => {
        acc[puzzle.status] += 1;
        return acc;
      },
      {
        unseen: 0,
        solved: 0,
        slow: 0,
        failed: 0,
      },
    );
  }

  private resolvePuzzleStatus(
    puzzleIndex: number,
    stats: WoodpeckerSession['puzzleStatsByIndex'][string],
    cycleStartedAt: number,
    solvedSet: Set<number>,
    failedSet: Set<number>,
  ): WoodpeckerPuzzleCycleStatus {
    const attemptedInCurrentCycle = stats.lastAttemptAt >= cycleStartedAt && stats.lastAttemptAt > 0;
    const hasRecordedFailure = stats.wrongAttempts > 0 || stats.skippedAttempts > 0;

    if (attemptedInCurrentCycle && stats.lastOutcome === 'solved') {
      return stats.lastElapsedMs >= WOODPECKER_SLOW_SOLVE_MS ? 'slow' : 'solved';
    }

    if (failedSet.has(puzzleIndex)) {
      return 'failed';
    }

    if (attemptedInCurrentCycle && (stats.lastOutcome === 'failed' || hasRecordedFailure)) {
      return 'failed';
    }

    if (solvedSet.has(puzzleIndex)) {
      return stats.lastElapsedMs >= WOODPECKER_SLOW_SOLVE_MS ? 'slow' : 'solved';
    }

    return 'unseen';
  }

  private getSessionPuzzleStats(session: WoodpeckerSession, puzzleIndex: number): WoodpeckerSession['puzzleStatsByIndex'][string] {
    const raw = session.puzzleStatsByIndex[String(puzzleIndex)] ?? null;
    return {
      totalAttempts: Math.max(0, Math.trunc(Number(raw?.totalAttempts ?? 0))),
      correctAttempts: Math.max(0, Math.trunc(Number(raw?.correctAttempts ?? 0))),
      wrongAttempts: Math.max(0, Math.trunc(Number(raw?.wrongAttempts ?? 0))),
      skippedAttempts: Math.max(0, Math.trunc(Number(raw?.skippedAttempts ?? 0))),
      totalSolveTimeMs: Math.max(0, Math.trunc(Number(raw?.totalSolveTimeMs ?? 0))),
      averageSolveTimeMs: Math.max(0, Math.trunc(Number(raw?.averageSolveTimeMs ?? 0))),
      currentStreak: Math.max(0, Math.trunc(Number(raw?.currentStreak ?? 0))),
      bestStreak: Math.max(0, Math.trunc(Number(raw?.bestStreak ?? 0))),
      ease: Number(raw?.ease ?? 2.1),
      intervalDays: Math.max(1, Math.trunc(Number(raw?.intervalDays ?? 1))),
      dueAt: Number.isFinite(Number(raw?.dueAt)) ? Number(raw?.dueAt) : 0,
      lastAttemptAt: Number.isFinite(Number(raw?.lastAttemptAt)) ? Number(raw?.lastAttemptAt) : 0,
      lastElapsedMs: Math.max(0, Math.trunc(Number(raw?.lastElapsedMs ?? 0))),
      lastOutcome: raw?.lastOutcome === 'solved' || raw?.lastOutcome === 'failed' ? raw.lastOutcome : 'none',
    };
  }

  private computeResumePuzzleIndex(entry: WoodpeckerPgnAnalytics, session: WoodpeckerSession | null): number | null {
    if (!session || session.gameCount <= 0) {
      return null;
    }

    const recentCorrectAttempt = [...entry.attempts].reverse().find((attempt) => attempt.correct === true);
    if (recentCorrectAttempt) {
      return this.wrapPuzzleIndex(recentCorrectAttempt.puzzleIndex + 1, session.gameCount);
    }

    if (session.solvedIndexes.length > 0) {
      const highestSolved = Math.max(...session.solvedIndexes);
      return this.wrapPuzzleIndex(highestSolved + 1, session.gameCount);
    }

    return 0;
  }

  private wrapPuzzleIndex(index: number, gameCount: number): number {
    if (gameCount <= 0) {
      return 0;
    }

    const normalized = Math.trunc(Number(index));
    const mod = normalized % gameCount;
    return mod >= 0 ? mod : mod + gameCount;
  }

  private findSessionByPgnId(pgnId: string): WoodpeckerSession | null {
    const rawSessions = this.readJson(WOODPECKER_STORAGE_KEY);
    if (!rawSessions || typeof rawSessions !== 'object') {
      return null;
    }

    const sessions = rawSessions as Record<string, unknown>;
    const direct = this.normalizeSession(sessions[pgnId]);
    if (direct) {
      return direct;
    }

    const rawLibraryItems = this.readJson(LIBRARY_STORAGE_KEY);
    if (!Array.isArray(rawLibraryItems)) {
      return null;
    }

    const item = rawLibraryItems.find((entry) => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }

      return (entry as { id?: unknown }).id === pgnId;
    }) as { name?: unknown; pgn?: unknown } | undefined;

    if (!item || typeof item.name !== 'string' || typeof item.pgn !== 'string') {
      return null;
    }

    const hash = this.hashText(item.pgn);
    const legacyKey = Object.keys(sessions).find((key) => key.startsWith(`${item.name}|`) && key.endsWith(`|${hash}`));
    if (!legacyKey) {
      return null;
    }

    return this.normalizeSession(sessions[legacyKey]);
  }

  private normalizeSession(value: unknown): WoodpeckerSession | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<WoodpeckerSession>;
    const gameCount = Math.max(0, Math.trunc(Number(candidate.gameCount ?? 0)));
    if (gameCount <= 0) {
      return null;
    }

    const solvedIndexes = Array.isArray(candidate.solvedIndexes)
      ? candidate.solvedIndexes
          .map((entry) => Math.trunc(Number(entry)))
          .filter((entry) => Number.isFinite(entry) && entry >= 0 && entry < gameCount)
      : [];

    return {
      cycle: Math.max(1, Math.trunc(Number(candidate.cycle ?? 1))),
      targetDays: Math.max(1, Math.trunc(Number(candidate.targetDays ?? 1))),
      cycleStartedAt: Number.isFinite(Number(candidate.cycleStartedAt)) ? Number(candidate.cycleStartedAt) : Date.now(),
      solvedIndexes: [...new Set(solvedIndexes)].sort((a, b) => a - b),
      completed: candidate.completed === true,
      gameCount,
      failedQueue: Array.isArray(candidate.failedQueue)
        ? candidate.failedQueue
            .map((entry) => Math.trunc(Number(entry)))
            .filter((entry) => Number.isFinite(entry) && entry >= 0 && entry < gameCount)
        : [],
      puzzleStatsByIndex: this.normalizeSessionPuzzleStats(candidate.puzzleStatsByIndex),
    };
  }

  private normalizeSessionPuzzleStats(value: unknown): WoodpeckerSession['puzzleStatsByIndex'] {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const entries = Object.entries(value as Record<string, unknown>).map(([key, raw]) => {
      const candidate = raw as Partial<WoodpeckerSession['puzzleStatsByIndex'][string]> | null;
      return [
        key,
        {
          totalAttempts: Math.max(0, Math.trunc(Number(candidate?.totalAttempts ?? 0))),
          correctAttempts: Math.max(0, Math.trunc(Number(candidate?.correctAttempts ?? 0))),
          wrongAttempts: Math.max(0, Math.trunc(Number(candidate?.wrongAttempts ?? 0))),
          skippedAttempts: Math.max(0, Math.trunc(Number(candidate?.skippedAttempts ?? 0))),
          totalSolveTimeMs: Math.max(0, Math.trunc(Number(candidate?.totalSolveTimeMs ?? 0))),
          averageSolveTimeMs: Math.max(0, Math.trunc(Number(candidate?.averageSolveTimeMs ?? 0))),
          currentStreak: Math.max(0, Math.trunc(Number(candidate?.currentStreak ?? 0))),
          bestStreak: Math.max(0, Math.trunc(Number(candidate?.bestStreak ?? 0))),
          ease: Number(candidate?.ease ?? 2.1),
          intervalDays: Math.max(1, Math.trunc(Number(candidate?.intervalDays ?? 1))),
          dueAt: Number.isFinite(Number(candidate?.dueAt)) ? Number(candidate?.dueAt) : 0,
          lastAttemptAt: Number.isFinite(Number(candidate?.lastAttemptAt)) ? Number(candidate?.lastAttemptAt) : 0,
          lastElapsedMs: Math.max(0, Math.trunc(Number(candidate?.lastElapsedMs ?? 0))),
          lastOutcome:
            candidate?.lastOutcome === 'solved' || candidate?.lastOutcome === 'failed' ? candidate.lastOutcome : 'none',
        },
      ] as const;
    });

    return Object.fromEntries(entries);
  }

  private hashText(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
  }

  private loadAnalytics(): Record<string, WoodpeckerPgnAnalytics> {
    const value = this.readJson(WOODPECKER_ANALYTICS_STORAGE_KEY);
    if (!value || typeof value !== 'object') {
      return {};
    }

    return value as Record<string, WoodpeckerPgnAnalytics>;
  }

  private persistAnalytics(): void {
    this.writeJson(WOODPECKER_ANALYTICS_STORAGE_KEY, this.analyticsByPgnId);
  }

  private readJson(storageKey: string): unknown {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private writeJson(storageKey: string, value: unknown): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignore storage errors.
    }
  }
}
