import { NgClass } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface BoardMove {
  from: Key;
  to: Key;
  promotion?: PromotionPiece;
}

interface PendingPromotion {
  from: Key;
  to: Key;
  color: 'white' | 'black';
}

const PROMOTION_CHOICES: { piece: PromotionPiece; role: string; label: string }[] = [
  { piece: 'q', role: 'queen', label: 'Donna' },
  { piece: 'r', role: 'rook', label: 'Torre' },
  { piece: 'b', role: 'bishop', label: 'Alfiere' },
  { piece: 'n', role: 'knight', label: 'Cavallo' },
];

@Component({
  selector: 'app-chess-board',
  imports: [NgClass],
  templateUrl: './chess-board.html',
  styleUrl: './chess-board.scss',
})
export class ChessBoardComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) fen = '';
  @Input() turnColor: 'white' | 'black' = 'white';
  @Input() legalDests: Map<Key, Key[]> = new Map();
  @Input() orientation: 'white' | 'black' = 'white';
  @Input() bestMoveArrow: { from: Key; to: Key } | null = null;
  @Input() puzzleHintSquare: Key | null = null;
  @Input() showCoordinates = true;
  @Input() boardTheme: 'brown' | 'green' | 'blue' | 'grey' = 'brown';
  @Input() pieceSet: 'cburnett' | 'merida' | 'alpha' | 'kosal' = 'cburnett';
  @Input() is3d = false;
  @Input() highlightLastMove = true;
  @Input() hidePieces = false;
  @Input() lastMove: [Key, Key] | null = null;
  /** When true pawns reaching the last rank become queens without asking. */
  @Input() autoPromoteToQueen = false;

  @Output() moved = new EventEmitter<BoardMove>();

  @ViewChild('boardHost', { static: true })
  private readonly boardHost!: ElementRef<HTMLDivElement>;

  readonly promotionChoices = PROMOTION_CHOICES;
  readonly pendingPromotion = signal<PendingPromotion | null>(null);

  private boardApi?: Api;

  ngAfterViewInit(): void {
    this.boardApi = Chessground(this.boardHost.nativeElement, {
      ...this.boardConfig(),
      addPieceZIndex: this.is3d,
    });

    // Chessground caches the board rect and only refreshes it on scroll/resize. Content above the
    // board (puzzle messages, Woodpecker status) can shift it without either, so taps would hit the
    // wrong square: drop the cache right before chessground handles each press (capture phase).
    const clearBounds = () => this.boardApi?.state.dom.bounds.clear();
    for (const type of ['touchstart', 'mousedown']) {
      this.boardHost.nativeElement.addEventListener(type, clearBounds, { capture: true, passive: true });
    }
  }

  boardAriaLabel(): string {
    const orientationLabel = this.orientation === 'white' ? 'bianco in basso' : 'nero in basso';
    const turnLabel = this.turnColor === 'white' ? 'Bianco' : 'Nero';
    const visibilityLabel = this.hidePieces ? ' Pezzi nascosti per la modalità memoria visiva.' : '';
    return `Scacchiera, ${orientationLabel}. Al tratto: ${turnLabel}.${visibilityLabel}`;
  }

  boardPositionDescription(): string {
    return `Posizione corrente in formato FEN: ${this.fen}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.boardApi) {
      return;
    }

    if (
      changes['fen'] ||
      changes['turnColor'] ||
      changes['legalDests'] ||
      changes['orientation'] ||
      changes['bestMoveArrow'] ||
      changes['puzzleHintSquare'] ||
      changes['showCoordinates'] ||
      changes['is3d'] ||
      changes['highlightLastMove'] ||
      changes['lastMove']
    ) {
      this.pendingPromotion.set(null);
      this.syncBoard();
    }
  }

  choosePromotion(piece: PromotionPiece): void {
    const pending = this.pendingPromotion();
    if (!pending) {
      return;
    }

    this.pendingPromotion.set(null);
    this.moved.emit({ from: pending.from, to: pending.to, promotion: piece });
  }

  cancelPromotion(): void {
    if (!this.pendingPromotion()) {
      return;
    }

    this.pendingPromotion.set(null);
    this.syncBoard();
  }

  private onBoardMove(from: Key, to: Key): void {
    const piece = this.boardApi?.state.pieces.get(to);
    const reachesLastRank = to[1] === '8' || to[1] === '1';
    if (piece?.role !== 'pawn' || !reachesLastRank) {
      this.moved.emit({ from, to });
      return;
    }

    if (this.autoPromoteToQueen) {
      this.moved.emit({ from, to, promotion: 'q' });
      return;
    }

    this.pendingPromotion.set({ from, to, color: piece.color });
  }

  private syncBoard(): void {
    this.boardApi?.set({ ...this.boardConfig(), addPieceZIndex: this.is3d });
  }

  private boardConfig() {
    return {
      fen: this.fen,
      orientation: this.orientation,
      turnColor: this.turnColor,
      lastMove: this.lastMove ?? undefined,
      coordinates: this.showCoordinates,
      highlight: {
        lastMove: this.highlightLastMove,
        check: true,
      },
      drawable: {
        autoShapes: this.boardShapes(),
      },
      movable: {
        color: 'both' as const,
        free: false,
        dests: this.legalDests,
        events: {
          after: (from: Key, to: Key) => this.onBoardMove(from, to),
        },
      },
    };
  }

  private boardShapes() {
    return [
      ...(this.puzzleHintSquare ? [{ orig: this.puzzleHintSquare, brush: 'yellow' as const }] : []),
      ...(this.bestMoveArrow
        ? [{ orig: this.bestMoveArrow.from, dest: this.bestMoveArrow.to, brush: 'green' as const }]
        : []),
    ];
  }
}
