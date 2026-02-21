import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';

const STOCKFISH_WORKER_URL = '/stockfish/stockfish-17.1-lite-single-03e3232.js';

type StockfishEngine = {
  onmessage: ((event: MessageEvent<string> | string) => void) | null;
  postMessage: (message: string) => void;
  terminate?: () => void;
};

@Component({
  selector: 'app-test',
  imports: [],
  templateUrl: './test.html',
  styleUrl: './test.scss',
})
export class Test implements AfterViewInit, OnDestroy {
  @ViewChild('boardHost', { static: true })
  private readonly boardHost!: ElementRef<HTMLDivElement>;

  readonly currentFen = signal('');
  readonly bestMove = signal('-');
  readonly evaluation = signal('-');
  readonly isAnalyzing = signal(false);

  private readonly chess = new Chess();
  private boardApi?: Api;
  private engine?: StockfishEngine;

  ngAfterViewInit(): void {
    this.currentFen.set(this.chess.fen());
    this.initBoard();
    this.initEngine();
    this.analyzePosition();
  }

  ngOnDestroy(): void {
    this.engine?.postMessage('stop');
    this.engine?.terminate?.();
  }

  resetBoard(): void {
    this.chess.reset();
    this.syncBoard();
    this.analyzePosition();
  }

  analyzePosition(): void {
    if (!this.engine) {
      this.evaluation.set('Engine non disponibile');
      return;
    }

    this.isAnalyzing.set(true);
    this.bestMove.set('-');
    this.evaluation.set('-');

    this.engine.postMessage('stop');
    this.engine.postMessage(`position fen ${this.chess.fen()}`);
    this.engine.postMessage('go depth 12');
  }

  private initBoard(): void {
    this.boardApi = Chessground(this.boardHost.nativeElement, {
      fen: this.chess.fen(),
      orientation: 'white',
      movable: {
        color: 'both',
        free: false,
        dests: this.getLegalDestinations(),
        events: {
          after: (from, to) => this.onMove(from, to),
        },
      },
    });
  }

  private initEngine(): void {
    try {
      this.engine = new Worker(STOCKFISH_WORKER_URL) as unknown as StockfishEngine;
    } catch {
      this.evaluation.set('Engine non disponibile');
      return;
    }

    this.engine.onmessage = (event) => {
      const message = typeof event === 'string' ? event : event.data;
      this.handleEngineMessage(message);
    };

    this.engine.postMessage('uci');
    this.engine.postMessage('isready');
  }

  private onMove(from: Key, to: Key): void {
    const move = this.chess.move({ from, to, promotion: 'q' });

    if (!move) {
      this.syncBoard();
      return;
    }

    this.syncBoard();
    this.analyzePosition();
  }

  private syncBoard(): void {
    this.currentFen.set(this.chess.fen());

    this.boardApi?.set({
      fen: this.chess.fen(),
      turnColor: this.chess.turn() === 'w' ? 'white' : 'black',
      movable: {
        color: 'both',
        free: false,
        dests: this.getLegalDestinations(),
      },
    });
  }

  private getLegalDestinations(): Map<Key, Key[]> {
    const destinations = new Map<Key, Key[]>();

    for (const move of this.chess.moves({ verbose: true })) {
      const from = move.from as Key;
      const to = move.to as Key;

      const fromMoves = destinations.get(from);
      if (fromMoves) {
        fromMoves.push(to);
      } else {
        destinations.set(from, [to]);
      }
    }

    return destinations;
  }

  private handleEngineMessage(message: string): void {
    if (message.startsWith('info')) {
      const cpMatch = message.match(/score cp (-?\d+)/);
      if (cpMatch) {
        this.evaluation.set((Number(cpMatch[1]) / 100).toFixed(2));
      }

      const mateMatch = message.match(/score mate (-?\d+)/);
      if (mateMatch) {
        this.evaluation.set(`M${mateMatch[1]}`);
      }
    }

    if (message.startsWith('bestmove')) {
      const move = message.split(' ')[1] ?? '-';
      this.bestMove.set(move);
      this.isAnalyzing.set(false);
    }
  }
}
