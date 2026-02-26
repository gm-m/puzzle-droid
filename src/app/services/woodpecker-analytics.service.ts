import { Injectable } from '@angular/core';
import {
  type FailedPuzzleSummary,
  type ImprovementPoint,
  type PuzzleDroidBackupBundle,
  type TacticalTheme,
  type WoodpeckerAttemptLog,
  type WoodpeckerCycleSnapshot,
  type WoodpeckerDashboardData,
  type WoodpeckerPgnAnalytics,
  type WoodpeckerPuzzlePerformance,
  type WoodpeckerSession,
} from '../models/woodpecker.models';

const SETTINGS_STORAGE_KEY = 'puzzle-droid-settings-v1';
const LIBRARY_STORAGE_KEY = 'puzzle-droid-library-items-v1';
const WOODPECKER_STORAGE_KEY = 'puzzle-droid-woodpecker-sessions-v1';
const WOODPECKER_ANALYTICS_STORAGE_KEY = 'puzzle-droid-woodpecker-analytics-v1';
const DAY_MS = 24 * 60 * 60 * 1000;

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
    };

    entry.pgnName = input.pgnName;
    entry.totalAttempts += 1;
    entry.lastAttemptAt = now;
    entry.totalSolveTimeMs += elapsedMs;

    if (attempt.correct) {
      entry.correctAttempts += 1;
      entry.currentStreak += 1;
      entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
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
      wrongAttempts: puzzle.wrongAttempts + (attempt.correct ? 0 : 1),
      averageSolveTimeMs: 0,
    };
    const puzzleAttempts = nextPuzzle.correctAttempts + nextPuzzle.wrongAttempts;
    nextPuzzle.averageSolveTimeMs = puzzleAttempts > 0 ? Math.round(nextPuzzle.totalSolveTimeMs / puzzleAttempts) : 0;
    entry.puzzlePerformance[puzzleKey] = nextPuzzle;

    const cycleKey = String(attempt.cycle);
    const previousCycle = entry.cycleSnapshots[cycleKey] ?? this.createCycleSnapshot(attempt.cycle, attempt.targetDays, now);
    entry.cycleSnapshots[cycleKey] = this.updateCycleSnapshot(previousCycle, attempt, input.session, now);

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
    const failedPuzzles = this.buildFailedPuzzles(entry.puzzlePerformance);
    const session = this.findSessionByPgnId(pgnId);
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
      totalSolveTimeMs: 0,
      averageSolveTimeMs: 0,
      progressPercent: 0,
      remainingDays: targetDays,
      deadlineRisk: 'basso',
    };
  }

  private updateCycleSnapshot(
    previous: WoodpeckerCycleSnapshot,
    attempt: WoodpeckerAttemptLog,
    session: WoodpeckerSession | null,
    now: number,
  ): WoodpeckerCycleSnapshot {
    const attempts = previous.attempts + 1;
    const correctAttempts = previous.correctAttempts + (attempt.correct ? 1 : 0);
    const wrongAttempts = previous.wrongAttempts + (attempt.correct ? 0 : 1);
    const totalSolveTimeMs = previous.totalSolveTimeMs + attempt.elapsedMs;
    const solvedCount = session?.solvedIndexes.length ?? previous.solvedCount;
    const gameCount = session?.gameCount ?? previous.gameCount;
    const progressPercent = gameCount > 0 ? Math.round((solvedCount / gameCount) * 100) : previous.progressPercent;

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
      totalSolveTimeMs,
      averageSolveTimeMs: attempts > 0 ? Math.round(totalSolveTimeMs / attempts) : 0,
      progressPercent,
      remainingDays,
      deadlineRisk: this.computeDeadlineRisk(progressPercent, remainingDays, session?.targetDays ?? previous.targetDays),
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

  private buildFailedPuzzles(puzzlePerformance: Record<string, WoodpeckerPuzzlePerformance>): FailedPuzzleSummary[] {
    return Object.values(puzzlePerformance)
      .filter((puzzle) => puzzle.wrongAttempts > 0)
      .sort((a, b) => b.wrongAttempts - a.wrongAttempts || b.lastAttemptAt - a.lastAttemptAt)
      .map((puzzle) => ({
        puzzleIndex: puzzle.puzzleIndex,
        wrongAttempts: puzzle.wrongAttempts,
        averageSolveTimeSeconds: Number((puzzle.averageSolveTimeMs / 1000).toFixed(1)),
        lastAttemptAt: puzzle.lastAttemptAt,
      }));
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
      puzzleStatsByIndex:
        candidate.puzzleStatsByIndex && typeof candidate.puzzleStatsByIndex === 'object'
          ? (candidate.puzzleStatsByIndex as WoodpeckerSession['puzzleStatsByIndex'])
          : {},
    };
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
