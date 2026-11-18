import { PuzzleRushRun, buildRushPuzzles, orderRushPuzzles, type RushPuzzle } from './puzzle-rush-run';
import { PgnParser } from '../../utils/pgn-parser';

const puzzle = (gameIndex: number, initialFen: string, moves: string[]): RushPuzzle => ({
  gameIndex,
  title: `Puzzle ${gameIndex + 1}`,
  initialFen,
  plyCount: moves.length,
  moves: () => moves,
});

// Back-rank mate: both Ra8# and Rc8# win.
const backRank = puzzle(0, '6k1/5ppp/8/8/8/8/5PPP/R1R3K1 w - - 0 1', ['a1a8']);
// Rxd5 Ke7 Rd7+: two user moves around one opponent reply.
const twoMoves = puzzle(1, '4k3/8/8/3q4/8/8/3R4/3RK3 w - - 0 1', ['d2d5', 'e8e7', 'd5d7']);

describe('PuzzleRushRun', () => {
  let clock: number;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000;
  });

  it('should score a correct solution and accept alternative checkmates', () => {
    const run = new PuzzleRushRun([backRank, { ...backRank, gameIndex: 5 }], { opponentMovesFirst: false, maxStrikes: 3 }, now);

    expect(run.nextPuzzle()).toBeTrue();
    expect(run.playerColor).toBe('white');
    clock += 4_000;
    expect(run.playMove({ from: 'a1', to: 'a8' }).kind).toBe('solved');

    expect(run.nextPuzzle()).toBeTrue();
    expect(run.playMove({ from: 'c1', to: 'c8' }).kind).toBe('solved');

    expect(run.score).toBe(2);
    expect(run.results.map((result) => [result.gameIndex, result.solved, result.elapsedMs])).toEqual([
      [0, true, 4_000],
      [5, true, 0],
    ]);
    expect(run.nextPuzzle()).toBeFalse();
  });

  it('should play the opponent replies and solve multi-move lines', () => {
    const run = new PuzzleRushRun([twoMoves], { opponentMovesFirst: false, maxStrikes: 3 }, now);
    run.nextPuzzle();

    expect(run.playMove({ from: 'd2', to: 'd5' }).kind).toBe('correct');
    expect(run.isOpponentToMove).toBeTrue();
    expect(run.playMove({ from: 'd1', to: 'd2' }).kind).toBe('ignored');
    expect(run.playOpponentMove().kind).toBe('correct');
    expect(run.isOpponentToMove).toBeFalse();
    expect(run.playMove({ from: 'd5', to: 'd7' }).kind).toBe('solved');
    expect(run.score).toBe(1);
  });

  it('should let the opponent move first for Lichess-style puzzles', () => {
    const lichessStyle = puzzle(2, '4k3/8/8/3q4/8/8/3R4/3RK3 b - - 0 1', ['d5d2', 'd1d2']);
    const run = new PuzzleRushRun([lichessStyle], { opponentMovesFirst: true, maxStrikes: 3 }, now);
    run.nextPuzzle();

    expect(run.playerColor).toBe('white');
    expect(run.isOpponentToMove).toBeTrue();
    expect(run.playOpponentMove().kind).toBe('correct');
    expect(run.playMove({ from: 'd1', to: 'd2' }).kind).toBe('solved');
  });

  it('should end the puzzle with a strike on a wrong move and stop after the last strike', () => {
    const run = new PuzzleRushRun([twoMoves, twoMoves, twoMoves], { opponentMovesFirst: false, maxStrikes: 2 }, now);

    run.nextPuzzle();
    const outcome = run.playMove({ from: 'd2', to: 'd4' });
    expect(outcome).toEqual({ kind: 'failed', expectedSan: 'Rxd5' });
    expect(run.playMove({ from: 'd2', to: 'd5' }).kind).toBe('ignored');
    expect(run.results[0]).toEqual(jasmine.objectContaining({ solved: false, expectedSan: 'Rxd5' }));

    run.nextPuzzle();
    run.playMove({ from: 'e1', to: 'f1' });
    expect(run.isOutOfStrikes).toBeTrue();
    expect(run.nextPuzzle()).toBeFalse();
  });

  it('should skip puzzles whose line is too short for the chosen format', () => {
    const run = new PuzzleRushRun([backRank, twoMoves], { opponentMovesFirst: true, maxStrikes: 3 }, now);

    expect(run.nextPuzzle()).toBeTrue();
    expect(run.current?.gameIndex).toBe(1);
  });
});

describe('Rush puzzle selection', () => {
  it('should keep only games starting from a FEN position', () => {
    const games = new PgnParser().parsePgnGames(
      [
        '[Event "Partita"]',
        '',
        '1. e4 e5 *',
        '',
        '[Event "Matto"]',
        '[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]',
        '',
        '1. Ra8# 1-0',
      ].join('\n'),
      'item',
    );

    const puzzles = buildRushPuzzles(games);
    expect(puzzles.map((entry) => [entry.gameIndex, entry.title])).toEqual([[1, 'Matto']]);
    expect(puzzles[0].moves()).toEqual(['a1a8']);
  });

  it('should order puzzles from the shortest solution to the longest', () => {
    const long = puzzle(0, backRank.initialFen, ['a', 'b', 'c', 'd', 'e']);
    const short = puzzle(1, backRank.initialFen, ['a']);
    const medium = puzzle(2, backRank.initialFen, ['a', 'b', 'c']);

    expect(orderRushPuzzles([long, short, medium], () => 0.5).map((entry) => entry.gameIndex)).toEqual([1, 2, 0]);
  });
});
