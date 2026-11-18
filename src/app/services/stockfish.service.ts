import { Injectable } from '@angular/core';
import type { EngineLine, StockfishEvent } from '../models/engine.models';

const STOCKFISH_WORKER_PATH = 'stockfish/stockfish-17.1-lite-single-03e3232.js';

interface AnalyzeOptions {
  depth: number;
  multiPv: number;
  skillLevel: number;
}

interface PendingAnalyze {
  fen: string;
  depth: number;
  multiPv: number;
  skillLevel: number;
  searchMoves?: string[];
  /** Set for one-shot probes: their result goes here instead of the listener. */
  resolve?: (lines: EngineLine[] | null) => void;
}

@Injectable({
  providedIn: 'root',
})
export class StockfishService {
  private engine?: Worker;
  private listener?: (event: StockfishEvent) => void;
  private readonly lines = new Map<number, EngineLine>();
  private whitePerspectiveFactor = 1;
  private pendingAnalyze: PendingAnalyze | null = null;
  private isSearchRunning = false;
  private activeProbe: ((lines: EngineLine[] | null) => void) | null = null;

  setListener(listener: (event: StockfishEvent) => void): void {
    this.listener = listener;
  }

  init(): void {
    if (this.engine) {
      return;
    }

    try {
      this.engine = new Worker(this.resolveWorkerUrl());
    } catch {
      this.listener?.({ type: 'error', message: 'Engine non disponibile' });
      return;
    }

    this.engine.onmessage = (event) => {
      const rawMessage = typeof event.data === 'string' ? event.data : String(event.data ?? '');
      this.handleEngineMessage(rawMessage);
    };

    this.engine.postMessage('uci');
    this.engine.postMessage('isready');
  }

  analyze(fen: string, options: AnalyzeOptions): boolean {
    if (!this.engine) {
      this.listener?.({ type: 'error', message: 'Engine non disponibile' });
      return false;
    }

    const depth = this.clamp(options.depth, 1, 30);
    const multiPv = this.clamp(options.multiPv, 1, 5);
    const skillLevel = this.clamp(options.skillLevel, 0, 20);
    this.cancelProbes();
    this.pendingAnalyze = { fen, depth, multiPv, skillLevel };
    this.isSearchRunning = false;

    this.lines.clear();
    this.listener?.({ type: 'line', lines: [] });

    this.engine.postMessage('stop');
    this.engine.postMessage('isready');

    return true;
  }

  /**
   * Scores the given UCI moves from `fen` (white's perspective, like the listener lines) without
   * notifying the listener. Resolves `null` if the engine is missing or the search is superseded.
   */
  evaluateMoves(fen: string, moves: string[], depth: number): Promise<EngineLine[] | null> {
    if (!this.engine || moves.length === 0) {
      return Promise.resolve(null);
    }

    this.cancelProbes();
    return new Promise((resolve) => {
      this.pendingAnalyze = {
        fen,
        depth: this.clamp(depth, 1, 30),
        multiPv: this.clamp(moves.length, 1, 5),
        skillLevel: 20,
        searchMoves: moves,
        resolve,
      };
      this.isSearchRunning = false;
      this.lines.clear();
      this.engine!.postMessage('stop');
      this.engine!.postMessage('isready');
    });
  }

  stop(): void {
    this.cancelProbes();
    this.pendingAnalyze = null;
    this.isSearchRunning = false;
    this.engine?.postMessage('stop');
    this.lines.clear();
    this.listener?.({ type: 'line', lines: [] });
  }

  destroy(): void {
    this.cancelProbes();
    this.pendingAnalyze = null;
    this.isSearchRunning = false;
    this.engine?.postMessage('stop');
    this.engine?.terminate();
    this.engine = undefined;
    this.lines.clear();
  }

  private handleEngineMessage(message: string): void {
    if (message.startsWith('readyok')) {
      this.startPendingAnalyze();
      return;
    }

    if (message.startsWith('bestmove')) {
      if (!this.isSearchRunning) {
        return;
      }

      this.isSearchRunning = false;
      if (this.activeProbe) {
        const resolve = this.activeProbe;
        this.activeProbe = null;
        resolve(this.sortedLines());
        return;
      }

      const bestMove = message.split(' ')[1] ?? '-';
      this.listener?.({ type: 'bestmove', bestMove });
      return;
    }

    if (!message.startsWith('info')) {
      return;
    }

    if (!this.isSearchRunning) {
      return;
    }

    const line = this.parseLine(message);
    if (!line) {
      return;
    }

    this.lines.set(line.multipv, line);
    if (!this.activeProbe) {
      this.listener?.({ type: 'line', lines: this.sortedLines() });
    }
  }

  private sortedLines(): EngineLine[] {
    return [...this.lines.values()].sort((a, b) => a.multipv - b.multipv);
  }

  private cancelProbes(): void {
    this.pendingAnalyze?.resolve?.(null);
    this.activeProbe?.(null);
    this.activeProbe = null;
  }

  private startPendingAnalyze(): void {
    if (!this.engine || !this.pendingAnalyze) {
      return;
    }

    const { fen, depth, multiPv, skillLevel, searchMoves, resolve } = this.pendingAnalyze;
    this.pendingAnalyze = null;
    this.whitePerspectiveFactor = this.getWhitePerspectiveFactor(fen);
    this.activeProbe = resolve ?? null;
    this.isSearchRunning = true;

    this.engine.postMessage(`setoption name MultiPV value ${multiPv}`);
    this.engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
    this.engine.postMessage(`position fen ${fen}`);
    this.engine.postMessage(`go depth ${depth}${searchMoves?.length ? ` searchmoves ${searchMoves.join(' ')}` : ''}`);
  }

  private parseLine(message: string): EngineLine | null {
    const depthMatch = message.match(/\bdepth (\d+)/);
    const multipvMatch = message.match(/\bmultipv (\d+)/);
    const cpMatch = message.match(/\bscore cp (-?\d+)/);
    const mateMatch = message.match(/\bscore mate (-?\d+)/);
    const pvMatch = message.match(/\spv (.+)$/);

    if (!depthMatch || !pvMatch || (!cpMatch && !mateMatch)) {
      return null;
    }

    const depth = Number(depthMatch[1]);
    const multipv = Number(multipvMatch?.[1] ?? 1);
    const pv = pvMatch[1].trim().split(/\s+/);

    if (cpMatch) {
      return {
        multipv,
        depth,
        score: {
          type: 'cp',
          value: Number(cpMatch[1]) * this.whitePerspectiveFactor,
        },
        pv,
      };
    }

    return {
      multipv,
      depth,
      score: {
        type: 'mate',
        value: Number(mateMatch![1]) * this.whitePerspectiveFactor,
      },
      pv,
    };
  }

  private getWhitePerspectiveFactor(fen: string): number {
    const sideToMove = fen.trim().split(/\s+/)[1];
    return sideToMove === 'b' ? -1 : 1;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.trunc(value)));
  }

  private resolveWorkerUrl(): string {
    if (typeof document === 'undefined') {
      return STOCKFISH_WORKER_PATH;
    }

    return new URL(STOCKFISH_WORKER_PATH, document.baseURI).toString();
  }
}
