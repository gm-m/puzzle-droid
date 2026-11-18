import { Injectable, signal } from '@angular/core';
import { RUSH_MODES, type RushBest, type RushMode, type RushPrefs, type RushRunSummary } from '../models/puzzle-rush.models';

const STORAGE_KEY = 'puzzle-droid-puzzle-rush-v1';
const HISTORY_LIMIT = 50;

interface RushStore {
  prefs: RushPrefs;
  best: Record<string, RushBest>;
  history: RushRunSummary[];
}

const DEFAULT_PREFS: RushPrefs = { collectionId: null, mode: 'blitz3', opponentMovesFirst: false };

/** Personal bests (per collection and mode), recent runs and setup preferences for Puzzle Rush. */
@Injectable({ providedIn: 'root' })
export class PuzzleRushRecordsService {
  private readonly store = signal<RushStore>(readStore());

  readonly prefs = () => this.store().prefs;

  updatePrefs(partial: Partial<RushPrefs>): void {
    this.write({ ...this.store(), prefs: { ...this.store().prefs, ...partial } });
  }

  best(collectionId: string, mode: RushMode): RushBest | null {
    return this.store().best[recordKey(collectionId, mode)] ?? null;
  }

  history(collectionId?: string): RushRunSummary[] {
    const history = this.store().history;
    return collectionId ? history.filter((run) => run.collectionId === collectionId) : history;
  }

  /** Saves a finished run and tells whether it beat the previous best. */
  recordRun(run: RushRunSummary): { isNewBest: boolean; previousBest: RushBest | null } {
    const key = recordKey(run.collectionId, run.mode);
    const current = this.store();
    const previousBest = current.best[key] ?? null;
    const isNewBest = run.score > 0 && run.score > (previousBest?.score ?? 0);

    this.write({
      ...current,
      best: isNewBest ? { ...current.best, [key]: { score: run.score, at: run.at } } : current.best,
      history: [run, ...current.history].slice(0, HISTORY_LIMIT),
    });
    return { isNewBest, previousBest };
  }

  private write(next: RushStore): void {
    this.store.set(next);
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence errors (private mode / quota): records stay in memory.
    }
  }
}

function recordKey(collectionId: string, mode: RushMode): string {
  return `${collectionId}|${mode}`;
}

function isMode(value: unknown): value is RushMode {
  return typeof value === 'string' && value in RUSH_MODES;
}

function readStore(): RushStore {
  const empty: RushStore = { prefs: { ...DEFAULT_PREFS }, best: {}, history: [] };
  if (typeof localStorage === 'undefined') return empty;

  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<RushStore> | null;
    if (!raw || typeof raw !== 'object') return empty;

    const prefs = (raw.prefs ?? {}) as Partial<RushPrefs>;
    const best = Object.fromEntries(
      Object.entries(raw.best ?? {}).filter(
        ([, entry]) => entry && Number.isFinite(entry.score) && Number.isFinite(entry.at),
      ),
    );
    const history = (Array.isArray(raw.history) ? raw.history : []).filter(
      (run): run is RushRunSummary => Boolean(run) && typeof run.collectionId === 'string' && isMode(run.mode),
    );

    return {
      prefs: {
        collectionId: typeof prefs.collectionId === 'string' ? prefs.collectionId : null,
        mode: isMode(prefs.mode) ? prefs.mode : DEFAULT_PREFS.mode,
        opponentMovesFirst: prefs.opponentMovesFirst === true,
      },
      best,
      history: history.slice(0, HISTORY_LIMIT),
    };
  } catch {
    return empty;
  }
}
