import { vi, type Mock } from 'vitest';
import { ActivatedRoute, convertToParamMap, type ParamMap, Router } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Chess } from 'chess.js';
import { IDBFactory } from 'fake-indexeddb';

import { ChessWorkspaceComponent } from './test';
import type { LibraryGameSelection } from '../library-panel/library-panel';
import { SettingsService } from '../../services/settings.service';
import { StockfishService } from '../../services/stockfish.service';
import { WoodpeckerAnalyticsService } from '../../services/woodpecker-analytics.service';
import { LibraryStorageService } from '../../services/library-storage.service';
import { ShellLayoutService } from '../../services/shell-layout.service';

describe('ChessWorkspaceComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  let component: ChessWorkspaceComponent;
  let fixture: ComponentFixture<ChessWorkspaceComponent>;
  let routerNavigateSpy: Mock<Router['navigate']>;
  let routerNavigateByUrlSpy: Mock<Router['navigateByUrl']>;
  let evaluateMovesSpy: Mock<StockfishService['evaluateMoves']>;
  let recordAttempt: Mock<WoodpeckerAnalyticsService['recordAttempt']>;
  let settingsValue: Record<string, unknown>;

  beforeEach(async () => {
    const routeParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ view: 'analysis' }));
    const routeQueryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    evaluateMovesSpy = vi.fn<StockfishService['evaluateMoves']>().mockResolvedValue(null);
    const stockfishMock: Pick<StockfishService, 'setListener' | 'init' | 'analyze' | 'stop' | 'destroy' | 'evaluateMoves'> = {
      setListener: vi.fn().mockName('setListener'),
      init: vi.fn().mockName('init'),
      analyze: vi.fn().mockName('analyze').mockReturnValue(true),
      stop: vi.fn().mockName('stop'),
      destroy: vi.fn().mockName('destroy'),
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

    recordAttempt = vi.fn<WoodpeckerAnalyticsService['recordAttempt']>();
    const analyticsMock = {
      recordAttempt,
      getDashboardData: vi.fn().mockName('getDashboardData').mockReturnValue(null),
      getAvailablePgns: vi.fn().mockName('getAvailablePgns').mockReturnValue([]),
      getPuzzleStatuses: vi.fn().mockName('getPuzzleStatuses').mockReturnValue([]),
      exportBackupBundle: vi.fn().mockName('exportBackupBundle').mockResolvedValue('{}'),
      importBackupBundle: vi.fn().mockName('importBackupBundle').mockResolvedValue({ ok: true, message: 'ok' }),
    };

    routerNavigateSpy = vi.fn<Router['navigate']>().mockResolvedValue(true);
    routerNavigateByUrlSpy = vi.fn<Router['navigateByUrl']>().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ChessWorkspaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: StockfishService, useValue: stockfishMock },
        { provide: SettingsService, useValue: settingsMock },
        { provide: WoodpeckerAnalyticsService, useValue: analyticsMock },
        {
          provide: Router,
          useValue: {
            navigate: routerNavigateSpy,
            navigateByUrl: routerNavigateByUrlSpy,
            url: '/library?libraryItem=pgn-1',
          } as Partial<Router>,
        },
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

    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('indexedDB', new IDBFactory());

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
    const writeTextSpy = vi.fn<Clipboard['writeText']>().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: writeTextSpy } });

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

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('should let the user play white by default', () => {
      component.onLibraryGameSelected(buildSelection());
      vi.advanceTimersByTime(1000);

      expect(component.moveCursor()).toBe(0);
      expect(component.turnColor()).toBe('white');
      expect(component.boardOrientation()).toBe('white');
      expect(component.puzzleMessage()).toBe('Puzzle avviato. Fai la prima mossa corretta.');
    });

    it('should record the full Woodpecker attempt across an automatic reply and time the retry separately', () => {
      const selection = buildSelection({ woodpeckerEnabled: true, fullUciHistory: ['e2e4', 'e7e5', 'g1f3'] });
      component.libraryItems.set([{
        id: selection.itemId,
        name: 'Woodpecker',
        pgn: '1. e4 e5 2. Nf3 *',
        mode: 'puzzle',
        games: [{
          id: selection.gameId,
          initialFen: selection.initialFen,
          uciMoves: selection.fullUciHistory,
          positions: [],
        }],
      }]);
      component.onLibraryGameSelected(selection);

      vi.advanceTimersByTime(8000);
      component.onBoardMove({ from: 'e2', to: 'e4' });
      vi.advanceTimersByTime(2700);
      component.onBoardMove({ from: 'd2', to: 'd4' });
      vi.advanceTimersByTime(3000);
      component.onBoardMove({ from: 'g1', to: 'f3' });

      expect(recordAttempt.mock.calls).toEqual([
        [expect.objectContaining({ correct: false, elapsedMs: 10700 })],
        [expect.objectContaining({ correct: true, elapsedMs: 3000 })],
      ]);
    });

    it('should hide navigation in a puzzle and cancel the pending move when closing it', () => {
      const shell = TestBed.inject(ShellLayoutService);
      component.activeView.set('library');
      component.onLibraryGameSelected(buildSelection({ autoPlayFirstMove: true }));
      component.activeView.set('analysis');
      fixture.detectChanges();

      expect(shell.tabBarVisible()).toBe(false);
      expect(component.isPuzzleAutoPlaying()).toBe(true);
      const closeButton: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Chiudi sessione puzzle"]');
      closeButton.click();
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(component.isPuzzleMode()).toBe(false);
      expect(component.isPuzzleAutoPlaying()).toBe(false);
      expect(component.moveCursor()).toBe(0);
      expect(shell.tabBarVisible()).toBe(true);
      expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/library?libraryItem=pgn-1', { replaceUrl: true });
    });

    it('should auto-play white moves when the user chooses black', () => {
      component.onLibraryPuzzlePlayerColorChanged({ gameId: 'pgn-1-g1', color: 'black' });
      component.onLibraryGameSelected(buildSelection());
      vi.advanceTimersByTime(1000);

      expect(component.moveCursor()).toBe(1);
      expect(component.turnColor()).toBe('black');
      expect(component.boardOrientation()).toBe('black');
      expect(component.puzzleMessage()).toBe('Giochi col Nero. Tocca a te.');

      component.onBoardMove({ from: 'e7', to: 'e5' });
      vi.advanceTimersByTime(1000);

      expect(component.moveCursor()).toBe(3);
      expect(component.turnColor()).toBe('black');
      expect(component.puzzleMessage()).toBe('Tocca a te.');
    });

    it('should restart the current puzzle with the new color when changed in game', () => {
      component.onLibraryGameSelected(buildSelection());
      component.onBoardMove({ from: 'e2', to: 'e4' });
      vi.advanceTimersByTime(1000);
      expect(component.moveCursor()).toBe(2);

      component.onPuzzlePlayerColorChanged('black');

      expect(component.currentPuzzlePlayerColor()).toBe('black');
      expect(component.moveCursor()).toBe(0);
      expect(component.boardOrientation()).toBe('black');

      vi.advanceTimersByTime(1000);

      expect(component.moveCursor()).toBe(1);
      expect(component.turnColor()).toBe('black');
      expect(component.puzzlePlayerColorByGameId()).toEqual({ 'pgn-1-g1': 'black' });
    });

    it('should ignore the auto first move option when the user chooses the side to move', () => {
      component.onLibraryPuzzlePlayerColorChanged({ gameId: 'pgn-1-g1', color: 'white' });
      component.onLibraryGameSelected(buildSelection({ autoPlayFirstMove: true, autoRotateBoardOnTurn: false }));
      vi.advanceTimersByTime(1000);

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
      evaluateMovesSpy.mockResolvedValue([
        { multipv: 1, depth: 12, score: { type: 'cp', value: 35 }, pv: ['e2e4', 'e7e5'] },
        { multipv: 2, depth: 12, score: { type: 'cp', value: 30 }, pv: ['d2d4', 'd7d5'] },
      ]);
      component.onLibraryGameSelected(buildSelection(new Chess().fen(), ['e2e4', 'e7e5']));

      component.onBoardMove({ from: 'd2', to: 'd4' });
      expect(component.isPuzzleAutoPlaying()).toBe(true);
      await new Promise((resolve) => setTimeout(resolve));

      expect(evaluateMovesSpy).toHaveBeenCalledWith(new Chess().fen(), ['e2e4', 'd2d4'], 12);
      expect(component.isPuzzleAutoPlaying()).toBe(false);
      expect(component.moveCursor()).toBe(0);
      expect(component.batchHasMistake()).toBe(false);
      expect(component.puzzleMessage()).toContain('Buona mossa');
    });

    it('should reject an alternative the engine considers clearly worse', async () => {
      settingsValue['puzzleEngineCheck'] = true;
      evaluateMovesSpy.mockResolvedValue([
        { multipv: 1, depth: 12, score: { type: 'cp', value: 35 }, pv: ['e2e4'] },
        { multipv: 2, depth: 12, score: { type: 'cp', value: -150 }, pv: ['f2f3'] },
      ]);
      component.onLibraryGameSelected(buildSelection(new Chess().fen(), ['e2e4', 'e7e5']));

      component.onBoardMove({ from: 'f2', to: 'f3' });
      await new Promise((resolve) => setTimeout(resolve));

      expect(component.moveCursor()).toBe(0);
      expect(component.batchHasMistake()).toBe(true);
      expect(component.puzzleMessage()).toBe('Mossa sbagliata, riprova.');
    });
  });

  it('should reject PGN files whose content is already in the library', async () => {
    const pgn = `[Event "Duplicato ${Date.now()}"]\n\n1. e4 e5 2. Nf3 *`;
    const files = ['uno.pgn', 'due.pgn'].map((name) =>
      Object.assign(new File([pgn], name), { text: async () => pgn }),
    );
    const fileList: FileList = Object.assign(files, {
      item: (index: number) => files[index] ?? null,
    });

    await component.onLibraryFilesSelected(fileList);

    const results = component.libraryUploadResults();
    expect(results.map((result) => result.status)).toEqual(['success', 'error']);
    expect(results[1].message).toContain('Già presente in libreria come "uno.pgn"');
    expect(component.libraryItems().filter((item) => item.pgn === pgn).length).toBe(1);

    await TestBed.inject(LibraryStorageService).deleteItem(component.libraryItems()[0].id);
  });

  it('should close the library game picker with Escape', () => {
    component.isLibraryGamePickerOpen.set(true);

    component.onWindowKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(component.isLibraryGamePickerOpen()).toBe(false);
  });

  it('should hide the tab bar while a library item detail is open', () => {
    const shell = TestBed.inject(ShellLayoutService);

    expect(shell.tabBarVisible()).toBe(true);

    component.libraryOpenedItemId.set('pgn-1');
    fixture.detectChanges();
    expect(shell.tabBarVisible()).toBe(false);

    component.libraryOpenedItemId.set(null);
    fixture.detectChanges();
    expect(shell.tabBarVisible()).toBe(true);
  });
});
