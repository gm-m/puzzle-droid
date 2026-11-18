export type RushMode = 'blitz3' | 'blitz5' | 'survival';

export interface RushModeConfig {
  label: string;
  description: string;
  /** `null` = no clock: the run only ends on strikes or when the puzzles run out. */
  durationMs: number | null;
  maxStrikes: number;
}

export const RUSH_MODES: Record<RushMode, RushModeConfig> = {
  blitz3: { label: '3 min', description: '3 minuti, 3 errori', durationMs: 3 * 60_000, maxStrikes: 3 },
  blitz5: { label: '5 min', description: '5 minuti, 3 errori', durationMs: 5 * 60_000, maxStrikes: 3 },
  survival: { label: 'Sopravvivenza', description: 'Senza tempo, 3 errori', durationMs: null, maxStrikes: 3 },
};

export const RUSH_MODE_ORDER: RushMode[] = ['blitz3', 'blitz5', 'survival'];

export interface RushPrefs {
  collectionId: string | null;
  mode: RushMode;
  /** Lichess-style puzzles: the first PGN move is the opponent's, then the user plays. */
  opponentMovesFirst: boolean;
}

export interface RushBest {
  score: number;
  at: number;
}

export interface RushRunSummary {
  collectionId: string;
  collectionName: string;
  mode: RushMode;
  score: number;
  mistakes: number;
  durationMs: number;
  at: number;
}

export interface RushPuzzleResult {
  gameIndex: number;
  title: string;
  solved: boolean;
  elapsedMs: number;
  /** SAN of the move the user should have played (failed puzzles only). */
  expectedSan?: string;
  review: {
    fen: string;
    moves: string[];
    playedSan?: string;
  };
}

export interface RushSummary {
  score: number;
  mistakes: number;
  durationMs: number;
  averageSolveMs: number;
  isNewBest: boolean;
  previousBest: RushBest | null;
  results: RushPuzzleResult[];
  endReason: 'time' | 'strikes' | 'exhausted' | 'stopped';
}
