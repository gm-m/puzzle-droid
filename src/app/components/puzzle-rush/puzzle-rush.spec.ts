import { vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PuzzleRushComponent } from './puzzle-rush';
import { LibraryStorageService } from '../../services/library-storage.service';
import { PuzzleRushRecordsService } from '../../services/puzzle-rush-records.service';
import { PuzzleRushReviewService } from '../../services/puzzle-rush-review.service';
import { SettingsService } from '../../services/settings.service';
import { ShellLayoutService } from '../../services/shell-layout.service';
import { PuzzleRushReviewComponent } from './puzzle-rush-review';
import { By } from '@angular/platform-browser';

const PUZZLES_PGN = Array.from({ length: 4 }, (_, index) =>
  [`[Event "Matto ${index + 1}"]`, '[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]', '', '1. Ra8# 1-0'].join('\n'),
).join('\n\n');

describe('PuzzleRushComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let fixture: ComponentFixture<PuzzleRushComponent>;
  let component: PuzzleRushComponent;
  let records: PuzzleRushRecordsService;
  let shell: ShellLayoutService;

  beforeEach(async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

    await TestBed.configureTestingModule({
      imports: [PuzzleRushComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: LibraryStorageService,
          useValue: {
            loadAll: () =>
              Promise.resolve([
                { id: 'games', name: 'Partite', pgn: '[Event "A"]\n\n1. e4 e5 *', mode: 'view' },
                { id: 'mates', name: 'Matti', pgn: PUZZLES_PGN, mode: 'puzzle' },
              ]),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            settings: () => ({ boardTheme: 'brown', pieceSet: 'cburnett', is3d: false, showCoordinates: true, highlightLastMove: true }),
          },
        },
      ],
    }).compileComponents();

    records = TestBed.inject(PuzzleRushRecordsService);
    shell = TestBed.inject(ShellLayoutService);
    fixture = TestBed.createComponent(PuzzleRushComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    while (component.isLoading()) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const startRun = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    component.start();
    fixture.detectChanges();
  };

  it('should list only collections with FEN puzzles', () => {
    expect(component.playableCollections().map((collection) => collection.id)).toEqual(['mates']);
    expect(fixture.nativeElement.textContent).toContain('Matti');
    expect(fixture.nativeElement.textContent).not.toContain('Partite');
  });

  it('should score solved puzzles and record the run when the clock runs out', () => {
    startRun();
    expect(component.phase()).toBe('playing');
    expect(shell.tabBarVisible()).toBe(false);
    expect(component.remainingMs()).toBe(180_000);

    component.onBoardMove({ from: 'a1', to: 'a8' });
    expect(component.score()).toBe(1);
    vi.advanceTimersByTime(400);
    component.onBoardMove({ from: 'a1', to: 'a8' });
    expect(component.score()).toBe(2);

    vi.advanceTimersByTime(180_000);
    expect(component.phase()).toBe('finished');
    expect(shell.tabBarVisible()).toBe(true);
    expect(component.summary()).toEqual(expect.objectContaining({ score: 2, endReason: 'time', isNewBest: true }));
    expect(records.best('mates', 'blitz3')?.score).toBe(2);
  });

  it('should end the run after three mistakes', () => {
    startRun();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      component.onBoardMove({ from: 'g1', to: 'f1' });
      vi.advanceTimersByTime(1_000);
    }

    expect(component.strikes()).toBe(3);
    expect(component.phase()).toBe('finished');
    expect(component.summary()?.endReason).toBe('strikes');
    expect(component.summary()?.results.map((result) => result.expectedSan)).toEqual(['Ra8#', 'Ra8#', 'Ra8#']);
  });

  it('should retry and reveal a missed puzzle without changing the results, then hand it off to Analysis', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    startRun();
    component.onBoardMove({ from: 'g1', to: 'f1' });
    component.stop();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const reviewButton = [...root.querySelectorAll('button')].find((button) => button.textContent?.includes('Rivedi gli errori'));
    reviewButton?.click();
    fixture.detectChanges();
    const reviewPanel = fixture.debugElement.query(By.directive(PuzzleRushReviewComponent)).componentInstance as PuzzleRushReviewComponent;
    const startFen = reviewPanel.position().fen;
    expect(reviewPanel.legalDests().get('a1')).toContain('a8');
    reviewPanel.onMove({ from: 'a1', to: 'a8' });
    expect(reviewPanel.message()).toBe('Puzzle risolto!');
    expect(component.summary()).toEqual(expect.objectContaining({ score: 0, mistakes: 1 }));

    reviewPanel.showSolution();
    expect(reviewPanel.position().fen).not.toBe(startFen);
    reviewPanel.goToPly(0);
    expect(reviewPanel.position().fen).toBe(startFen);
    reviewPanel.openAnalysis();
    expect(navigate).toHaveBeenCalledWith(['/analysis'], { queryParams: { rushReview: 1 } });
    expect(TestBed.inject(PuzzleRushReviewService).analysis).toEqual({ fen: startFen, pgn: expect.stringMatching(/Ra8#/) });
  });

  it('should end the run when every puzzle has been played', () => {
    component.selectMode('survival');
    startRun();
    expect(component.remainingMs()).toBeNull();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      component.onBoardMove({ from: 'a1', to: 'a8' });
      vi.advanceTimersByTime(400);
    }

    expect(component.summary()).toEqual(expect.objectContaining({ score: 4, endReason: 'exhausted' }));
  });

  it('should stop the run on Escape and show the summary', () => {
    startRun();

    component.onDocumentKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));

    expect(component.phase()).toBe('finished');
    expect(component.summary()?.endReason).toBe('stopped');
  });
});
