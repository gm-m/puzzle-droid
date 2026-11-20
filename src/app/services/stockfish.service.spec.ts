import { vi, type Mock } from 'vitest';
import { StockfishService } from './stockfish.service';

describe('StockfishService', () => {
  const blackToMoveFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  let service: StockfishService;
  let posted: string[];
  let listener: Mock;
  const receive = (message: string) =>
    (service as unknown as { handleEngineMessage(message: string): void }).handleEngineMessage(message);

  beforeEach(() => {
    service = new StockfishService();
    posted = [];
    listener = vi.fn().mockName('listener');
    service.setListener(listener);
    (service as unknown as { engine: Pick<Worker, 'postMessage'> }).engine = {
      postMessage: (message: string) => posted.push(message),
    };
  });

  it('should score only the requested moves without notifying the listener', async () => {
    const result = service.evaluateMoves(blackToMoveFen, ['e7e5', 'c7c5'], 12);
    receive('readyok');

    expect(posted).toContain('setoption name MultiPV value 2');
    expect(posted).toContain('go depth 12 searchmoves e7e5 c7c5');

    receive('info depth 12 multipv 1 score cp 20 pv c7c5 g1f3');
    receive('info depth 12 multipv 2 score mate 3 pv e7e5 d1h5');
    receive('bestmove c7c5');

    const lines = await result;
    expect(listener).not.toHaveBeenCalled();
    expect(lines?.map((line) => line.pv[0])).toEqual(['c7c5', 'e7e5']);
    expect(lines?.map((line) => line.score)).toEqual([
      { type: 'cp', value: -20 },
      { type: 'mate', value: -3 },
    ]);
  });

  it('should resolve a probe with null when a regular analysis supersedes it', async () => {
    const result = service.evaluateMoves(blackToMoveFen, ['e7e5'], 12);
    service.analyze(blackToMoveFen, { depth: 10, multiPv: 1, skillLevel: 20 });

    expect(await result).toBeNull();
  });

  it('should resolve a running probe with null when stopped', async () => {
    const result = service.evaluateMoves(blackToMoveFen, ['e7e5'], 12);
    receive('readyok');
    service.stop();

    expect(await result).toBeNull();
  });
});
