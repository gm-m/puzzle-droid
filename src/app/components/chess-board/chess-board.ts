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
  imports: [],
  templateUrl: './chess-board.html',
  styleUrl: './chess-board.scss',
})
export class ChessBoardComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) fen = '';
  @Input() turnColor: 'white' | 'black' = 'white';
  @Input() legalDests: Map<Key, Key[]> = new Map();
  @Input() orientation: 'white' | 'black' = 'white';
  @Input() bestMoveArrow: { from: Key; to: Key } | null = null;
  @Input() showCoordinates = true;

  @Output() moved = new EventEmitter<BoardMove>();

  @ViewChild('boardHost', { static: true })
  private readonly boardHost!: ElementRef<HTMLDivElement>;

  private boardApi?: Api;

  ngAfterViewInit(): void {
    this.boardApi = Chessground(this.boardHost.nativeElement, {
      fen: this.fen,
      orientation: this.orientation,
      turnColor: this.turnColor,
      coordinates: this.showCoordinates,
      drawable: {
        autoShapes: this.bestMoveArrow
          ? [{ orig: this.bestMoveArrow.from, dest: this.bestMoveArrow.to, brush: 'green' as const }]
          : [],
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

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.boardApi) {
      return;
    }

    if (changes['fen'] || changes['turnColor'] || changes['legalDests'] || changes['orientation'] || changes['bestMoveArrow']) {
      this.boardApi.set({
        fen: this.fen,
        orientation: this.orientation,
        turnColor: this.turnColor,
        coordinates: this.showCoordinates,
        drawable: {
          autoShapes: this.bestMoveArrow
            ? [{ orig: this.bestMoveArrow.from, dest: this.bestMoveArrow.to, brush: 'green' as const }]
            : [],
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
}
