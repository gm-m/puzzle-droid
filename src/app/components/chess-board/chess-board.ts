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
} from '@angular/core';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';

export interface BoardMove {
  from: Key;
  to: Key;
}

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

  @Output() moved = new EventEmitter<BoardMove>();

  @ViewChild('boardHost', { static: true })
  private readonly boardHost!: ElementRef<HTMLDivElement>;

  private boardApi?: Api;

  ngAfterViewInit(): void {
    this.boardApi = Chessground(this.boardHost.nativeElement, {
      fen: this.fen,
      orientation: this.orientation,
      turnColor: this.turnColor,
      addPieceZIndex: this.is3d,
      coordinates: this.showCoordinates,
      highlight: {
        lastMove: this.highlightLastMove,
        check: true
      },
      drawable: {
        autoShapes: this.boardShapes(),
      },
      movable: {
        color: 'both',
        free: false,
        dests: this.legalDests,
        events: {
          after: (from, to) => this.moved.emit({ from, to }),
        },
      },
    });
  }

  boardAriaLabel(): string {
    const orientationLabel = this.orientation === 'white' ? 'bianco in basso' : 'nero in basso';
    const turnLabel = this.turnColor === 'white' ? 'Bianco' : 'Nero';
    return `Scacchiera, ${orientationLabel}. Al tratto: ${turnLabel}.`;
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
      changes['highlightLastMove']
    ) {
      this.boardApi.set({
        fen: this.fen,
        orientation: this.orientation,
        turnColor: this.turnColor,
        addPieceZIndex: this.is3d,
        coordinates: this.showCoordinates,
        highlight: {
          lastMove: this.highlightLastMove,
          check: true
        },
        drawable: {
          autoShapes: this.boardShapes(),
        },
        movable: {
          color: 'both',
          free: false,
          dests: this.legalDests,
          events: {
            after: (from, to) => this.moved.emit({ from, to }),
          },
        },
      });
    }
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
