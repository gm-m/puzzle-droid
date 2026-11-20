import { vi } from 'vitest';
import { PgnParser } from './pgn-parser';

describe('PgnParser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let parser: PgnParser;
  const parse = (pgn: string) => parser.parsePgnGames(pgn, 'item');

  beforeEach(() => {
    parser = new PgnParser();
  });

  it('should build positions, uci moves and comments in a single pass', () => {
    const games = parse(
      [
        '[Event "Uno"]',
        '[White "A"]',
        '[Black "B"]',
        '[Result "1-0"]',
        '',
        '{Apertura} 1. e4 e5 {Simmetrico} 2. Nf3 (2. f4 exf4) Nc6 1-0',
        '',
        '[Event "Due"]',
        '[SetUp "1"]',
        '[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]',
        '',
        '1. Ra8# 1-0',
      ].join('\n'),
    );

    expect(games.length).toBe(2);
    const [first, second] = games;
    expect(first.event).toBe('Uno');
    expect(first.uciMoves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    expect(first.positions.map((position) => position.ply)).toEqual([0, 1, 2, 3, 4]);
    expect(first.positions[0].comment).toBe('Apertura');
    expect(first.positions[2].comment).toBe('Simmetrico');
    expect(first.positions[2].label).toBe('1... e5');
    expect(first.positions[4].fen).toBe('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');

    expect(second.initialFen).toBe('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    expect(second.uciMoves).toEqual(['a1a8']);
    expect(second.positions[1].san).toBe('Ra8#');
  });

  it('should defer move parsing until positions are accessed and estimate the ply count', () => {
    const loadSpy = vi.spyOn(parser, 'loadPgnWithFallback');
    const [game] = parse('[Event "Lazy"]\n\n1. e4 {ok} e5 (1... c5 2. Nf3) 2. Nf3 $1 Nc6 3. O-O-O?? 1-0');

    expect(game.event).toBe('Lazy');
    expect(game.plyCount).toBe(5);
    expect(loadSpy).not.toHaveBeenCalled();

    void game.positions;
    void game.uciMoves;
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('should keep only the initial position for unparseable movetext', () => {
    const [game] = parse('[Event "Rotto"]\n\n1. e5 e4 *');

    expect(game.uciMoves).toEqual([]);
    expect(game.positions.length).toBe(1);
  });
});
