import { ChangeDetectionStrategy, Component, Input, OnChanges, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { Key } from 'chessground/types';
import type { RushPuzzleResult } from '../../models/puzzle-rush.models';
import { PuzzleRushReviewService } from '../../services/puzzle-rush-review.service';
import { SettingsService } from '../../services/settings.service';
import { ChessBoardComponent, type BoardMove } from '../chess-board/chess-board';
import { AppIconComponent } from '../ui/app-icon/app-icon';
import { PuzzleRushRun } from './puzzle-rush-run';

interface ReviewPosition {
  fen: string;
  turn: 'white' | 'black';
  lastMove: [Key, Key] | null;
  san: string | null;
}

function positionOf(chess: Chess, move?: Move): ReviewPosition {
  return {
    fen: chess.fen(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    lastMove: move ? [move.from as Key, move.to as Key] : null,
    san: move?.san ?? null,
  };
}

@Component({
  selector: 'app-puzzle-rush-review',
  imports: [ChessBoardComponent, AppIconComponent],
  templateUrl: './puzzle-rush-review.html',
  styleUrl: './puzzle-rush-review.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleRushReviewComponent implements OnChanges {
  @Input({ required: true }) result!: RushPuzzleResult;

  private readonly router = inject(Router);
  private readonly review = inject(PuzzleRushReviewService);
  readonly board = viewChild(ChessBoardComponent);
  readonly settings = inject(SettingsService).settings;
  readonly position = signal(positionOf(new Chess()));
  readonly legalDests = signal<Map<Key, Key[]>>(new Map());
  readonly message = signal('');
  readonly solutionVisible = signal(false);
  readonly cursor = signal(0);
  orientation: 'white' | 'black' = 'white';
  private frames: ReviewPosition[] = [];
  private analysisPgn = '';
  private retry: PuzzleRushRun | null = null;

  get lastPly(): number {
    return this.frames.length - 1;
  }

  ngOnChanges(): void {
    const { fen, moves } = this.result.review;
    const chess = new Chess(fen);
    this.frames = [positionOf(chess)];
    for (const uci of moves) {
      try {
        const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        this.frames.push(positionOf(chess, move));
      } catch {
        break;
      }
    }
    this.analysisPgn = chess.pgn();
    this.orientation = this.frames[0].turn;
    this.restart();
  }

  restart(): void {
    const { fen, moves } = this.result.review;
    const retry = new PuzzleRushRun([{
      gameIndex: this.result.gameIndex,
      title: this.result.title,
      initialFen: fen,
      plyCount: moves.length,
      moves: () => moves,
    }], { opponentMovesFirst: false, maxStrikes: 1 });

    this.solutionVisible.set(false);
    this.cursor.set(0);
    this.retry = retry.nextPuzzle() ? retry : null;
    this.message.set(this.retry ? `Muove il ${this.orientation === 'white' ? 'Bianco' : 'Nero'}.` : 'Posizione pronta per l’analisi.');
    this.position.set(this.frames[0]);
    this.updateLegalMoves();
  }

  onMove(move: BoardMove): void {
    const retry = this.retry;
    if (!retry) {
      return;
    }

    let outcome = retry.playMove(move);
    if (outcome.kind === 'correct' && retry.isOpponentToMove) {
      outcome = retry.playOpponentMove();
    }
    this.position.set(positionOf(retry.chess, 'move' in outcome ? outcome.move : undefined));

    if (outcome.kind === 'solved' || outcome.kind === 'failed' || outcome.kind === 'skipped') {
      this.retry = null;
      this.message.set(
        outcome.kind === 'solved' ? 'Puzzle risolto!' :
          outcome.kind === 'failed' ? 'Mossa errata. Puoi riprovare o vedere la soluzione.' :
            'La continuazione disponibile termina qui.',
      );
    }
    this.updateLegalMoves();
  }

  showSolution(): void {
    this.retry = null;
    this.legalDests.set(new Map());
    this.solutionVisible.set(true);
    this.goToPly(Math.min(1, this.lastPly));
  }

  goToPly(ply: number): void {
    const frame = this.frames[ply];
    if (frame) {
      this.cursor.set(ply);
      this.position.set(frame);
    }
  }

  openAnalysis(): void {
    this.review.analysis = { fen: this.frames[0].fen, pgn: this.lastPly > 0 ? this.analysisPgn : null };
    void this.router.navigate(['/analysis'], { queryParams: { rushReview: 1 } });
  }

  private updateLegalMoves(): void {
    const destinations = new Map<Key, Key[]>();
    for (const move of this.retry?.chess.moves({ verbose: true }) ?? []) {
      const from = move.from as Key;
      const targets = destinations.get(from) ?? [];
      targets.push(move.to as Key);
      destinations.set(from, targets);
    }
    this.legalDests.set(destinations);
  }
}
