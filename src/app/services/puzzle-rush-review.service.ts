import { Injectable, signal } from '@angular/core';
import type { RushSummary } from '../models/puzzle-rush.models';

/** Keeps the finished run and its selected puzzle available while visiting Analysis. */
@Injectable({ providedIn: 'root' })
export class PuzzleRushReviewService {
  readonly summary = signal<RushSummary | null>(null);
  readonly selection = signal<{ index: number; onlyMistakes: boolean } | null>(null);
  analysis: { fen: string; pgn: string | null } | null = null;

  clear(): void {
    this.summary.set(null);
    this.selection.set(null);
    this.analysis = null;
  }
}
