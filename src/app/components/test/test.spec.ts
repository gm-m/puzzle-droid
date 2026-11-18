import { ActivatedRoute, convertToParamMap, type ParamMap, Router } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Chess } from 'chess.js';

import { ChessWorkspaceComponent } from './test';
import type { LibraryGameSelection } from '../library-panel/library-panel';
import { SettingsService } from '../../services/settings.service';
import { StockfishService } from '../../services/stockfish.service';
import { WoodpeckerAnalyticsService } from '../../services/woodpecker-analytics.service';
import { LibraryStorageService } from '../../services/library-storage.service';
import { ShellLayoutService } from '../../services/shell-layout.service';

describe('ChessWorkspaceComponent', () => {
  let component: ChessWorkspaceComponent;
  let fixture: ComponentFixture<ChessWorkspaceComponent>;
  let routerNavigateSpy: jasmine.Spy;
  let evaluateMovesSpy: jasmine.Spy;
  let settingsValue: Record<string, unknown>;

  beforeEach(async () => {
    const routeParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ view: 'analysis' }));
    const routeQueryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    evaluateMovesSpy = jasmine.createSpy('evaluateMoves').and.resolveTo(null);
    const stockfishMock: Pick<StockfishService, 'setListener' | 'init' | 'analyze' | 'stop' | 'destroy' | 'evaluateMoves'> = {
      setListener: jasmine.createSpy('setListener'),
      init: jasmine.createSpy('init'),
      analyze: jasmine.createSpy('analyze').and.returnValue(true),
      stop: jasmine.createSpy('stop'),
      destroy: jasmine.createSpy('destroy'),
      evaluateMoves: evaluateMovesSpy,
    };

    settingsValue = {
      boardTheme: 'brown',
      pieceSet: 'cburnett',
      is3d: false,
      showCoordinates: true,
      highlightLastMove: true,
      darkMode: false,
      autoQueen: false,
      puzzleEngineCheck: false,
    };
    const settingsMock = {
      settings: () => settingsValue,
    };

    const analyticsMock = {
      recordAttempt: jasmine.createSpy('recordAttempt'),
      getDashboardData: jasmine.createSpy('getDashboardData').and.returnValue(null),
      getAvailablePgns: jasmine.createSpy('getAvailablePgns').and.returnValue([]),
      getPuzzleStatuses: jasmine.createSpy('getPuzzleStatuses').and.returnValue([]),
      exportBackupBundle: jasmine.createSpy('exportBackupBundle').and.resolveTo('{}'),
      importBackupBundle: jasmine.createSpy('importBackupBundle').and.resolveTo({ ok: true, message: 'ok' }),
    };

    routerNavigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [ChessWorkspaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: StockfishService, useValue: stockfishMock },
        { provide: SettingsService, useValue: settingsMock },
        { provide: WoodpeckerAnalyticsService, useValue: analyticsMock },
        { provide: Router, useValue: { navigate: routerNavigateSpy } as Partial<Router> },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParamMap$.asObservable(),
            queryParamMap: routeQueryParamMap$.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          } as Partial<ActivatedRoute>,
        },
      ],
    }).compileComponents();

    spyOn(window.localStorage, 'getItem').and.returnValue(null);
    spyOn(window.localStorage, 'setItem');
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 404 }));

    fixture = TestBed.createComponent(ChessWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a single analysis panel instance', () => {
    const panels = fixture.nativeElement.querySelectorAll('app-analysis-panel');

    expect(panels.length).toBe(1);
  });

  it('should save a position bookmark with title, note and current fen', () => {
    component.applyFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');

    component.savePositionBookmark({
      title: 'Finale semplice',
      note: 'Da rivedere',
    });

    const bookmarks = component.positionBookmarks();
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].title).toBe('Finale semplice');
    expect(bookmarks[0].note).toBe('Da rivedere');
    expect(bookmarks[0].fen).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(component.fenFeedback()).toBe('Posizione salvata nei bookmark.');
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('should load a bookmark and switch to analysis view', () => {
    component.savePositionBookmark({
      title: 'Posizione test',
      note: 'Nota',
    });
    const bookmarkId = component.positionBookmarks()[0].id;

    component.activeView.set('library');
    component.loadPositionBookmark(bookmarkId);

    expect(component.currentFen()).toBe(component.positionBookmarks()[0].fen);
    expect(component.fenFeedback()).toContain('Bookmark caricato: Posizione test');
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/', 'analysis']);
  });

  it('should update an existing bookmark title and note', () => {
    component.savePositionBookmark({
      title: 'Vecchio titolo',
      note: 'Vecchia nota',
    });
    const bookmarkId = component.positionBookmarks()[0].id;

    component.updatePositionBookmark({
      id: bookmarkId,
      title: 'Nuovo titolo',
      note: 'Nuova nota',
    });

    const bookmark = component.positionBookmarks()[0];
    expect(bookmark.title).toBe('Nuovo titolo');
    expect(bookmark.note).toBe('Nuova nota');
    expect(component.fenFeedback()).toBe('Bookmark aggiornato.');
  });

  it('should delete an existing bookmark', () => {
    component.savePositionBookmark({
      title: 'Da cancellare',
      note: 'Nota',
    });
    const bookmarkId = component.positionBookmarks()[0].id;

    component.deletePositionBookmark(bookmarkId);

    expect(component.positionBookmarks().length).toBe(0);
    expect(component.fenFeedback()).toBe('Bookmark eliminato.');
  });

  it('should copy current fen to clipboard and show success toast', async () => {
    component.applyFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const writeTextSpy = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    });

    await component.copyCurrentFen();

    expect(writeTextSpy).toHaveBeenCalledWith('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(component.toastMessage()).toBe('FEN copiata negli appunti.');
    expect(component.toastTone()).toBe('success');
  });

  describe('puzzle player color', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const buildSelection = (overrides: Partial<LibraryGameSelection> = {}): LibraryGameSelection => ({
      itemId: 'pgn-1',
      gameId: 'pgn-1-g1',
      gameTitle: 'Partita 1',
      mode: 'puzzle',
      initialFen: startFen,
      fullUciHistory: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
      positions: [],
      autoPlayFirstMove: false,
      autoAdvanceOnSuccess: false,
      autoRotateBoardOnTurn: true,
      woodpeckerEnabled: false,
      blindfoldEnabled: false,
      blindfoldObservationSeconds: 2,
      blindfoldShowAfterAutoMove: false,
      ...overrides,
    });

    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('should let the user play white by default', () => {
      component.onLibraryGameSelected(buildSelection());
      jasmine.clock().tick(1000);

      expect(component.moveCursor()).toBe(0);
      expect(component.turnColor()).toBe('white');
      expect(component.boardOrientation()).toBe('white');
      expect(component.puzzleMessage()).toBe('Puzzle avviato. Fai la prima mossa corretta.');
    });

    it('should auto-play white moves when the user chooses black', () => {
      component.onLibraryPuzzlePlayerColorChanged({ gameId: 'pgn-1-g1', color: 'black' });
      component.onLibraryGameSelected(buildSelection());
      jasmine.clock().tick(1000);

      expect(component.moveCursor()).toBe(1);
      expect(component.turnColor()).toBe('black');
      expect(component.boardOrientation()).toBe('black');
      expect(component.puzzleMessage()).toBe('Giochi col Nero. Tocca a te.');

      component.onBoardMove({ from: 'e7', to: 'e5' });
      jasmine.clock().tick(1000);

      expect(component.moveCursor()).toBe(3);
      expect(component.turnColor()).toBe('black');
      expect(component.puzzleMessage()).toBe('Tocca a te.');
    });

    it('should restart the current puzzle with the new color when changed in game', () => {
      component.onLibraryGameSelected(buildSelection());
      component.onBoardMove({ from: 'e2', to: 'e4' });
      jasmine.clock().tick(1000);
      expect(component.moveCursor()).toBe(2);

      component.onPuzzlePlayerColorChanged('black');

      expect(component.currentPuzzlePlayerColor()).toBe('black');
      expect(component.moveCursor()).toBe(0);
      expect(component.boardOrientation()).toBe('black');

      jasmine.clock().tick(1000);

      expect(component.moveCursor()).toBe(1);
      expect(component.turnColor()).toBe('black');
      expect(component.puzzlePlayerColorByGameId()).toEqual({ 'pgn-1-g1': 'black' });
    });

    it('should ignore the auto first move option when the user chooses the side to move', () => {
      component.onLibraryPuzzlePlayerColorChanged({ gameId: 'pgn-1-g1', color: 'white' });
      component.onLibraryGameSelected(buildSelection({ autoPlayFirstMove: true, autoRotateBoardOnTurn: false }));
      jasmine.clock().tick(1000);

      expect(component.moveCursor()).toBe(0);
      expect(component.boardOrientation()).toBe('white');
    });
  });

  describe('puzzle move validation', () => {
    const buildSelection = (initialFen: string, fullUciHistory: string[]): LibraryGameSelection => ({
      itemId: 'pgn-1',
      gameId: 'pgn-1-g1',
      gameTitle: 'Partita 1',
      mode: 'puzzle',
      initialFen,
      fullUciHistory,
      positions: [],
      autoPlayFirstMove: false,
      autoAdvanceOnSuccess: false,
      autoRotateBoardOnTurn: false,
      woodpeckerEnabled: false,
      blindfoldEnabled: false,
      blindfoldObservationSeconds: 2,
      blindfoldShowAfterAutoMove: false,
    });

    it('should require the promotion piece of the solution', () => {
      component.onLibraryGameSelected(buildSelection('8/4P3/8/8/8/8/k7/4K3 w - - 0 1', ['e7e8n']));

      component.onBoardMove({ from: 'e7', to: 'e8', promotion: 'q' });
      expect(component.moveCursor()).toBe(0);
      expect(component.puzzleMessage()).toBe('Mossa sbagliata, riprova.');

      component.onBoardMove({ from: 'e7', to: 'e8', promotion: 'n' });
      expect(component.moveCursor()).toBe(1);
      expect(component.currentFen()).toContain('4N3');
      expect(component.puzzleMessage()).toBe('Puzzle risolto!');
    });

    it('should accept an alternative checkmate as the solution', () => {
      component.onLibraryGameSelected(buildSelection('6k1/5ppp/8/8/8/8/5PPP/R1R3K1 w - - 0 1', ['a1a8']));

      component.onBoardMove({ from: 'c1', to: 'c8' });

      expect(component.moveHistory()).toEqual(['c1c8']);
      expect(component.moveCursor()).toBe(1);
      expect(component.puzzleMessage()).toBe('Puzzle risolto!');
      expect(component.toastMessage()).toContain('mossa alternativa');
      expect(evaluateMovesSpy).not.toHaveBeenCalled();
    });

    it('should not ask the engine when the check is disabled', () => {
      component.onLibraryGameSelected(buildSelection(new Chess().fen(), ['e2e4', 'e7e5']));

      component.onBoardMove({ from: 'd2', to: 'd4' });

      expect(evaluateMovesSpy).not.toHaveBeenCalled();
      expect(component.puzzleMessage()).toBe('Mossa sbagliata, riprova.');
    });

    it('should not count an engine-equivalent alternative as a mistake', async () => {
      settingsValue['puzzleEngineCheck'] = true;
      evaluateMovesSpy.and.resolveTo([
        { multipv: 1, depth: 12, score: { type: 'cp', value: 35 }, pv: ['e2e4', 'e7e5'] },
        { multipv: 2, depth: 12, score: { type: 'cp', value: 30 }, pv: ['d2d4', 'd7d5'] },
      ]);
      component.onLibraryGameSelected(buildSelection(new Chess().fen(), ['e2e4', 'e7e5']));

      component.onBoardMove({ from: 'd2', to: 'd4' });
      expect(component.isPuzzleAutoPlaying()).toBeTrue();
      await new Promise((resolve) => setTimeout(resolve));

      expect(evaluateMovesSpy).toHaveBeenCalledWith(new Chess().fen(), ['e2e4', 'd2d4'], 12);
      expect(component.isPuzzleAutoPlaying()).toBeFalse();
      expect(component.moveCursor()).toBe(0);
      expect(component.batchHasMistake()).toBeFalse();
      expect(component.puzzleMessage()).toContain('Buona mossa');
    });

    it('should reject an alternative the engine considers clearly worse', async () => {
      settingsValue['puzzleEngineCheck'] = true;
      evaluateMovesSpy.and.resolveTo([
        { multipv: 1, depth: 12, score: { type: 'cp', value: 35 }, pv: ['e2e4'] },
        { multipv: 2, depth: 12, score: { type: 'cp', value: -150 }, pv: ['f2f3'] },
      ]);
      component.onLibraryGameSelected(buildSelection(new Chess().fen(), ['e2e4', 'e7e5']));

      component.onBoardMove({ from: 'f2', to: 'f3' });
      await new Promise((resolve) => setTimeout(resolve));

      expect(component.moveCursor()).toBe(0);
      expect(component.batchHasMistake()).toBeTrue();
      expect(component.puzzleMessage()).toBe('Mossa sbagliata, riprova.');
    });
  });

  it('should reject PGN files whose content is already in the library', async () => {
    const pgn = `[Event "Duplicato ${Date.now()}"]\n\n1. e4 e5 2. Nf3 *`;
    const transfer = new DataTransfer();
    transfer.items.add(new File([pgn], 'uno.pgn'));
    transfer.items.add(new File([pgn], 'due.pgn'));

    await component.onLibraryFilesSelected(transfer.files);

    const results = component.libraryUploadResults();
    expect(results.map((result) => result.status)).toEqual(['success', 'error']);
    expect(results[1].message).toContain('Già presente in libreria come "uno.pgn"');
    expect(component.libraryItems().filter((item) => item.pgn === pgn).length).toBe(1);

    await TestBed.inject(LibraryStorageService).deleteItem(component.libraryItems()[0].id);
  });

  it('should close the library game picker with Escape', () => {
    component.isLibraryGamePickerOpen.set(true);

    component.onWindowKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(component.isLibraryGamePickerOpen()).toBeFalse();
  });

  it('should hide the tab bar while a library item detail is open', () => {
    const shell = TestBed.inject(ShellLayoutService);

    expect(shell.tabBarVisible()).toBeTrue();

    component.libraryOpenedItemId.set('pgn-1');
    fixture.detectChanges();
    expect(shell.tabBarVisible()).toBeFalse();

    component.libraryOpenedItemId.set(null);
    fixture.detectChanges();
    expect(shell.tabBarVisible()).toBeTrue();
  });
});
