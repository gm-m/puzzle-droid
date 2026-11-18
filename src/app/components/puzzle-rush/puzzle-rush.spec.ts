import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PuzzleRushComponent } from './puzzle-rush';
import { LibraryStorageService } from '../../services/library-storage.service';
import { PuzzleRushRecordsService } from '../../services/puzzle-rush-records.service';
import { SettingsService } from '../../services/settings.service';
import { ShellLayoutService } from '../../services/shell-layout.service';

const PUZZLES_PGN = Array.from({ length: 4 }, (_, index) =>
  [`[Event "Matto ${index + 1}"]`, '[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]', '', '1. Ra8# 1-0'].join('\n'),
).join('\n\n');

describe('PuzzleRushComponent', () => {
  let fixture: ComponentFixture<PuzzleRushComponent>;
  let component: PuzzleRushComponent;
  let records: PuzzleRushRecordsService;
  let shell: ShellLayoutService;

  beforeEach(async () => {
    spyOn(window.localStorage, 'getItem').and.returnValue(null);
    spyOn(window.localStorage, 'setItem');
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 404 }));

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

  afterEach(() => jasmine.clock().uninstall());

  const startRun = () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
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
    expect(shell.tabBarVisible()).toBeFalse();
    expect(component.remainingMs()).toBe(180_000);

    component.onBoardMove({ from: 'a1', to: 'a8' });
    expect(component.score()).toBe(1);
    jasmine.clock().tick(400);
    component.onBoardMove({ from: 'a1', to: 'a8' });
    expect(component.score()).toBe(2);

    jasmine.clock().tick(180_000);
    expect(component.phase()).toBe('finished');
    expect(shell.tabBarVisible()).toBeTrue();
    expect(component.summary()).toEqual(jasmine.objectContaining({ score: 2, endReason: 'time', isNewBest: true }));
    expect(records.best('mates', 'blitz3')?.score).toBe(2);
  });

  it('should end the run after three mistakes', () => {
    startRun();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      component.onBoardMove({ from: 'g1', to: 'f1' });
      jasmine.clock().tick(1_000);
    }

    expect(component.strikes()).toBe(3);
    expect(component.phase()).toBe('finished');
    expect(component.summary()?.endReason).toBe('strikes');
    expect(component.summary()?.results.map((result) => result.expectedSan)).toEqual(['Ra8#', 'Ra8#', 'Ra8#']);
  });

  it('should end the run when every puzzle has been played', () => {
    component.selectMode('survival');
    startRun();
    expect(component.remainingMs()).toBeNull();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      component.onBoardMove({ from: 'a1', to: 'a8' });
      jasmine.clock().tick(400);
    }

    expect(component.summary()).toEqual(jasmine.objectContaining({ score: 4, endReason: 'exhausted' }));
  });

  it('should stop the run on Escape and show the summary', () => {
    startRun();

    component.onDocumentKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));

    expect(component.phase()).toBe('finished');
    expect(component.summary()?.endReason).toBe('stopped');
  });
});
