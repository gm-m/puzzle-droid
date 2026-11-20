import { vi } from 'vitest';
import { PuzzleRushRecordsService } from './puzzle-rush-records.service';
import type { RushRunSummary } from '../models/puzzle-rush.models';

describe('PuzzleRushRecordsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let stored: Record<string, string>;
  const run = (score: number, overrides: Partial<RushRunSummary> = {}): RushRunSummary => ({
    collectionId: 'pgn-1',
    collectionName: 'Puzzle',
    mode: 'blitz3',
    score,
    mistakes: 3,
    durationMs: 60_000,
    at: 1_000 + score,
    ...overrides,
  });

  beforeEach(() => {
    stored = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => stored[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      stored[key] = value;
    });
  });

  it('should track the best score per collection and mode', () => {
    const service = new PuzzleRushRecordsService();

    expect(service.recordRun(run(5))).toEqual({ isNewBest: true, previousBest: null });
    expect(service.recordRun(run(3)).isNewBest).toBe(false);
    expect(service.recordRun(run(8))).toEqual({ isNewBest: true, previousBest: { score: 5, at: 1_005 } });
    service.recordRun(run(2, { mode: 'survival' }));

    expect(service.best('pgn-1', 'blitz3')?.score).toBe(8);
    expect(service.best('pgn-1', 'survival')?.score).toBe(2);
    expect(service.best('pgn-2', 'blitz3')).toBeNull();
    expect(service.history('pgn-1').map((entry) => entry.score)).toEqual([2, 8, 3, 5]);
  });

  it('should not record a zero score as a best', () => {
    const service = new PuzzleRushRecordsService();

    expect(service.recordRun(run(0)).isNewBest).toBe(false);
    expect(service.best('pgn-1', 'blitz3')).toBeNull();
  });

  it('should persist records and preferences across instances', () => {
    const first = new PuzzleRushRecordsService();
    first.recordRun(run(4));
    first.updatePrefs({ collectionId: 'pgn-1', mode: 'blitz5', opponentMovesFirst: true });

    const second = new PuzzleRushRecordsService();
    expect(second.best('pgn-1', 'blitz3')?.score).toBe(4);
    expect(second.prefs()).toEqual({ collectionId: 'pgn-1', mode: 'blitz5', opponentMovesFirst: true });
  });

  it('should ignore corrupted storage', () => {
    stored['puzzle-droid-puzzle-rush-v1'] = '{"prefs":{"mode":"nope"},"best":{"x":{"score":"a"}},"history":[1]}';
    const service = new PuzzleRushRecordsService();

    expect(service.prefs().mode).toBe('blitz3');
    expect(service.best('x', 'blitz3')).toBeNull();
    expect(service.history()).toEqual([]);
  });
});
