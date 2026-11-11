import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { WoodpeckerPuzzleStats, WoodpeckerSession } from '../models/woodpecker.models';
import { WoodpeckerAnalyticsService } from './woodpecker-analytics.service';

const stats = (overrides: Partial<WoodpeckerPuzzleStats>): WoodpeckerPuzzleStats => ({
  totalAttempts: 1,
  correctAttempts: 0,
  wrongAttempts: 0,
  skippedAttempts: 0,
  totalSolveTimeMs: 0,
  averageSolveTimeMs: 0,
  currentStreak: 0,
  bestStreak: 0,
  ease: 2.5,
  intervalDays: 1,
  dueAt: 0,
  lastAttemptAt: 2_000,
  lastElapsedMs: 5_000,
  lastOutcome: 'none',
  ...overrides,
});

describe('WoodpeckerAnalyticsService', () => {
  let service: WoodpeckerAnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(WoodpeckerAnalyticsService);
  });

  it('should return the current-cycle status of every puzzle', () => {
    const session: WoodpeckerSession = {
      cycle: 1,
      targetDays: 28,
      cycleStartedAt: 1_000,
      solvedIndexes: [0, 1],
      completed: false,
      gameCount: 4,
      failedQueue: [2],
      puzzleStatsByIndex: {
        '0': stats({ lastOutcome: 'solved', correctAttempts: 1 }),
        '1': stats({ lastOutcome: 'solved', correctAttempts: 1, lastElapsedMs: 60_000 }),
        '2': stats({ lastOutcome: 'failed', wrongAttempts: 1 }),
      },
    };

    expect(service.getPuzzleStatuses(session)).toEqual(['solved', 'slow', 'failed', 'unseen']);
    expect(service.getPuzzleStatuses(null)).toEqual([]);
  });
});
