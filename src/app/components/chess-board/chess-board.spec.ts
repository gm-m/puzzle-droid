import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Key } from 'chessground/types';

import { ChessBoardComponent, type BoardMove } from './chess-board';

describe('ChessBoardComponent', () => {
  let fixture: ComponentFixture<ChessBoardComponent>;
  let component: ChessBoardComponent;
  let moves: BoardMove[];

  const playOnBoard = (from: Key, to: Key) => {
    const api = (component as unknown as { boardApi: { move(from: Key, to: Key): void } }).boardApi;
    api.move(from, to);
    (component as unknown as { onBoardMove(from: Key, to: Key): void }).onBoardMove(from, to);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChessBoardComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ChessBoardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fen', '8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    moves = [];
    component.moved.subscribe((move) => moves.push(move));
    fixture.detectChanges();
  });

  it('should emit plain moves directly', () => {
    playOnBoard('e1', 'd1');

    expect(moves).toEqual([{ from: 'e1', to: 'd1' }]);
  });

  it('should ask for the promotion piece and emit the chosen one', () => {
    playOnBoard('e7', 'e8');

    expect(moves).toEqual([]);
    const choices = fixture.nativeElement.querySelectorAll('.promotion-choice') as NodeListOf<HTMLButtonElement>;
    expect(Array.from(choices).map((choice) => choice.getAttribute('aria-label'))).toEqual(['Donna', 'Torre', 'Alfiere', 'Cavallo']);

    choices[3].click();
    fixture.detectChanges();

    expect(moves).toEqual([{ from: 'e7', to: 'e8', promotion: 'n' }]);
    expect(fixture.nativeElement.querySelector('.promotion-overlay')).toBeNull();
  });

  it('should drop the move when the promotion is cancelled', () => {
    playOnBoard('e7', 'e8');
    (fixture.nativeElement.querySelector('.promotion-backdrop') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(moves).toEqual([]);
    expect(fixture.nativeElement.querySelector('.promotion-overlay')).toBeNull();
  });

  it('should promote to a queen without asking when auto-promotion is on', () => {
    fixture.componentRef.setInput('autoPromoteToQueen', true);
    fixture.detectChanges();

    playOnBoard('e7', 'e8');

    expect(moves).toEqual([{ from: 'e7', to: 'e8', promotion: 'q' }]);
  });
});
