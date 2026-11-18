import { Chess } from 'chess.js';
import type { Move as ChessMove } from 'chess.js';
import type { PgnLibraryGame } from '../../models/library.models';
import type { RushPuzzleResult } from '../../models/puzzle-rush.models';
import { STARTING_FEN } from '../../utils/pgn-parser';

export interface RushPuzzle {
  gameIndex: number;
  title: string;
  initialFen: string;
  /** Estimated mainline length, used to order puzzles from short to long. */
  plyCount: number;
  /** Solution line in UCI, parsed lazily (only when the puzzle is reached). */
  moves: () => string[];
}

export interface RushMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export type RushMoveOutcome =
  | { kind: 'correct'; move: ChessMove }
  | { kind: 'solved'; move: ChessMove }
  | { kind: 'failed'; expectedSan: string }
  | { kind: 'skipped' }
  | { kind: 'ignored' };

export interface RushRunOptions {
  opponentMovesFirst: boolean;
  maxStrikes: number;
}

/** Puzzles usable in a rush: games that start from a custom FEN position. */
export function buildRushPuzzles(games: PgnLibraryGame[]): RushPuzzle[] {
  return games.flatMap((game, gameIndex) =>
    game.initialFen !== STARTING_FEN && (game.plyCount ?? 1) > 0
      ? [
          {
            gameIndex,
            title: game.event?.trim() || `Puzzle ${gameIndex + 1}`,
            initialFen: game.initialFen,
            plyCount: game.plyCount ?? 1,
            moves: () => game.uciMoves,
          },
        ]
      : [],
  );
}

/** Random order, then shortest solutions first so the run gets harder as it goes. */
export function orderRushPuzzles(puzzles: RushPuzzle[], random: () => number = Math.random): RushPuzzle[] {
  const shuffled = [...puzzles];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const length = (puzzle: RushPuzzle) => Math.ceil(puzzle.plyCount / 2);
  return shuffled.sort((left, right) => length(left) - length(right));
}

/**
 * State of a single Puzzle Rush run, independent from the UI and the clock. Every user move is
 * checked against the PGN line (any checkmate is accepted too); a wrong move costs a strike and
 * ends the puzzle, as in chess.com's Puzzle Rush.
 */
export class PuzzleRushRun {
  readonly chess = new Chess();
  readonly results: RushPuzzleResult[] = [];
  score = 0;
  strikes = 0;
  playerColor: 'white' | 'black' = 'white';

  private queueIndex = -1;
  private cursor = 0;
  private solution: string[] = [];
  private puzzleStartedAt = 0;

  constructor(
    private readonly puzzles: RushPuzzle[],
    private readonly options: RushRunOptions,
    private readonly now: () => number = Date.now,
  ) {}

  get current(): RushPuzzle | null {
    return this.puzzles[this.queueIndex] ?? null;
  }

  get puzzleNumber(): number {
    return this.results.length + 1;
  }

  get isOutOfStrikes(): boolean {
    return this.strikes >= this.options.maxStrikes;
  }

  /** True when the next move of the line belongs to the opponent (to be played automatically). */
  get isOpponentToMove(): boolean {
    return this.cursor < this.solution.length && this.sideToMove() !== this.playerColor;
  }

  /** Loads the next playable puzzle; false when there are none left or the strikes are over. */
  nextPuzzle(): boolean {
    if (this.isOutOfStrikes) {
      return false;
    }

    while (++this.queueIndex < this.puzzles.length) {
      const puzzle = this.puzzles[this.queueIndex];
      const solution = puzzle.moves();
      const minimumLength = this.options.opponentMovesFirst ? 2 : 1;
      if (solution.length < minimumLength) {
        continue;
      }

      try {
        this.chess.load(puzzle.initialFen);
      } catch {
        continue;
      }

      this.solution = solution;
      this.cursor = 0;
      const startingSide = this.sideToMove();
      this.playerColor = this.options.opponentMovesFirst ? (startingSide === 'white' ? 'black' : 'white') : startingSide;
      this.puzzleStartedAt = this.now();
      return true;
    }

    return false;
  }

  playOpponentMove(): RushMoveOutcome {
    if (!this.isOpponentToMove) {
      return { kind: 'ignored' };
    }

    const move = this.applyUci(this.solution[this.cursor]);
    if (!move) {
      // Broken PGN line: skip the puzzle without counting it either way.
      this.cursor = this.solution.length;
      return { kind: 'skipped' };
    }

    this.cursor += 1;
    return this.cursor >= this.solution.length ? this.solve(move) : { kind: 'correct', move };
  }

  playMove(input: RushMove): RushMoveOutcome {
    if (!this.current || this.isOpponentToMove || this.cursor >= this.solution.length) {
      return { kind: 'ignored' };
    }

    const probe = new Chess(this.chess.fen());
    let played: ChessMove;
    try {
      played = probe.move({ from: input.from, to: input.to, promotion: input.promotion });
    } catch {
      return { kind: 'ignored' };
    }

    const expectedUci = this.solution[this.cursor];
    const playedUci = `${played.from}${played.to}${played.promotion ?? ''}`;
    if (playedUci !== expectedUci && !probe.isCheckmate()) {
      return this.fail(expectedUci);
    }

    this.chess.move(played.san);
    this.cursor += 1;
    if (this.cursor >= this.solution.length || this.chess.isCheckmate()) {
      return this.solve(played);
    }

    return { kind: 'correct', move: played };
  }

  private solve(move: ChessMove): RushMoveOutcome {
    this.score += 1;
    this.results.push({ ...this.resultBase(), solved: true });
    return { kind: 'solved', move };
  }

  private fail(expectedUci: string): RushMoveOutcome {
    const expectedSan = this.sanOf(expectedUci);
    this.strikes += 1;
    this.results.push({ ...this.resultBase(), solved: false, expectedSan });
    this.cursor = this.solution.length;
    return { kind: 'failed', expectedSan };
  }

  private resultBase(): Omit<RushPuzzleResult, 'solved'> {
    const puzzle = this.current!;
    return {
      gameIndex: puzzle.gameIndex,
      title: puzzle.title,
      elapsedMs: Math.max(0, this.now() - this.puzzleStartedAt),
    };
  }

  private applyUci(uci: string): ChessMove | null {
    try {
      return this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    } catch {
      return null;
    }
  }

  private sanOf(uci: string): string {
    try {
      return new Chess(this.chess.fen()).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
    } catch {
      return uci;
    }
  }

  private sideToMove(): 'white' | 'black' {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }
}
