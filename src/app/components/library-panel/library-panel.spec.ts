import { vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryPanelComponent } from './library-panel';

describe('LibraryPanelComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let component: LibraryPanelComponent;
  let fixture: ComponentFixture<LibraryPanelComponent>;

  beforeEach(async () => {
    localStorage.removeItem('puzzle-droid-library-puzzle-options-v1');
    await TestBed.configureTestingModule({
      imports: [LibraryPanelComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('positionBookmarks', [
      {
        id: 'bookmark-1',
        title: 'Posizione uno',
        note: 'Nota iniziale',
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        createdAt: 1700000000000,
      },
    ]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should switch to bookmarks tab', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const bookmarkTab = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.library-tab')).find(
      (button) => button.textContent?.trim() === 'Bookmark',
    );

    bookmarkTab?.click();
    await fixture.whenStable();

    const activeTab = compiled.querySelector<HTMLButtonElement>('.library-tab[aria-pressed="true"]');

    expect(component.activeTab).toBe('bookmarks');
    expect(activeTab?.textContent?.trim()).toBe('Bookmark');
  });

  it('should emit bookmark selection when opening a bookmark', () => {
    vi.spyOn(component.positionBookmarkSelected, 'emit').mockImplementation(() => {});

    component.onOpenBookmark('bookmark-1');

    expect(component.positionBookmarkSelected.emit).toHaveBeenCalledWith('bookmark-1');
  });

  it('should emit bookmark update and leave edit mode', () => {
    vi.spyOn(component.positionBookmarkUpdated, 'emit').mockImplementation(() => {});
    const titleInput = document.createElement('input');
    const noteInput = document.createElement('textarea');
    titleInput.value = 'Titolo aggiornato';
    noteInput.value = 'Nota aggiornata';

    component.startBookmarkEdit('bookmark-1');
    component.saveBookmarkEdit('bookmark-1', titleInput, noteInput);

    expect(component.positionBookmarkUpdated.emit).toHaveBeenCalledWith({
      id: 'bookmark-1',
      title: 'Titolo aggiornato',
      note: 'Nota aggiornata',
    });
    expect(component.editingBookmarkId).toBeNull();
  });

  it('should emit bookmark deletion after confirmation and clear edit mode', () => {
    vi.spyOn(component.positionBookmarkDeleted, 'emit').mockImplementation(() => {});
    component.startBookmarkEdit('bookmark-1');

    component.deleteBookmark('bookmark-1');
    expect(component.positionBookmarkDeleted.emit).not.toHaveBeenCalled();

    component.confirmBookmarkDelete();

    expect(component.positionBookmarkDeleted.emit).toHaveBeenCalledWith('bookmark-1');
    expect(component.editingBookmarkId).toBeNull();
    expect(component.bookmarkPendingDeleteId).toBeNull();
  });

  it('should filter bookmarks by title, note or fen and sort them', () => {
    fixture.componentRef.setInput('positionBookmarks', [
      ...component.positionBookmarks,
      {
        id: 'bookmark-2',
        title: 'Altra posizione',
        note: 'Seconda nota',
        fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
        createdAt: 1600000000000,
      },
    ]);

    component.bookmarkSearch = 'altra';
    component.bookmarkSort = 'title';

    const filtered = component.filteredBookmarks();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('bookmark-2');
  });

  it('should make resume the only primary card action when a session is available', () => {
    fixture.componentRef.setInput('items', [
      {
        id: 'pgn-1',
        name: 'Allenamento.pgn',
        pgn: '',
        mode: 'puzzle',
        games: [],
      },
    ]);
    fixture.componentRef.setInput('woodpeckerSessionInfoByItemId', {
      'pgn-1': { hasSession: true, resumePuzzleIndex: 4 },
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const resumeAction = compiled.querySelector<HTMLButtonElement>('.hero-resume');
    const openAction = compiled.querySelector<HTMLButtonElement>('.file-open');
    const moreAction = compiled.querySelector<HTMLButtonElement>('.file-more');

    expect(resumeAction?.textContent).toContain('Riprendi dal puzzle 5');
    expect(openAction).not.toBeNull();
    expect(moreAction).not.toBeNull();
  });

  it('should summarize collections with aggregated metadata', () => {
    const games = [
      { id: 'g1', initialFen: '', uciMoves: [], positions: [], plyCount: 20, event: 'Linares' },
      { id: 'g2', initialFen: '', uciMoves: [], positions: [], plyCount: 40, event: 'Wijk' },
    ];
    const item = { id: 'pgn-multi', name: 'Multi.pgn', pgn: '', mode: 'puzzle' as const, games, event: 'Linares' };
    fixture.componentRef.setInput('woodpeckerSessionInfoByItemId', { 'pgn-multi': { hasSession: true, resumePuzzleIndex: 1 } });

    expect(component.cardSummary(item)).toEqual([
      { label: 'Modalità', value: 'Puzzle' },
      { label: 'Eventi', value: '2 eventi' },
      { label: 'Mosse medie', value: '15' },
      { label: 'Progresso', value: '2 / 2' },
    ]);
  });

  it('should search and sort collections', () => {
    const make = (id: string, name: string, gameCount: number) => ({
      id,
      name,
      pgn: '',
      mode: 'view' as const,
      games: Array.from({ length: gameCount }, (_, index) => ({ id: `${id}-${index}`, initialFen: '', uciMoves: [], positions: [] })),
    });
    fixture.componentRef.setInput('items', [make('a', 'Zeta.pgn', 1), make('b', 'Alfa.pgn', 3), make('c', 'Beta finali.pgn', 2)]);

    expect(component.displayedItems().map((item) => item.id)).toEqual(['a', 'b', 'c']);

    component.onCollectionSortChange({ target: { value: 'name' } } as unknown as Event);
    expect(component.displayedItems().map((item) => item.id)).toEqual(['b', 'c', 'a']);

    component.onCollectionSortChange({ target: { value: 'size' } } as unknown as Event);
    expect(component.displayedItems().map((item) => item.id)).toEqual(['b', 'c', 'a']);

    component.onCollectionSearchInput({ target: { value: 'FINALI' } } as unknown as Event);
    expect(component.displayedItems().map((item) => item.id)).toEqual(['c']);
  });

  it('should expose per-puzzle Woodpecker status badges', () => {
    fixture.componentRef.setInput('woodpeckerSessionInfoByItemId', {
      'pgn-1': { hasSession: true, resumePuzzleIndex: 2, puzzleStatuses: ['solved', 'failed', 'unseen'] },
    });

    expect(component.hasPuzzleStatuses('pgn-1')).toBe(true);
    expect(component.hasPuzzleStatuses('pgn-2')).toBe(false);
    expect(component.puzzleStatusBadge('pgn-1', 0)).toEqual({ label: 'Risolto', tone: 'success' });
    expect(component.puzzleStatusBadge('pgn-1', 1)).toEqual({ label: 'Sbagliato', tone: 'danger' });
    expect(component.puzzleStatusBadge('pgn-1', 5)).toBeNull();
  });

  it('should confirm before deleting a Woodpecker session', () => {
    const item = { id: 'pgn-1', name: 'Allenamento.pgn', pgn: '', mode: 'puzzle' as const, games: [] };
    vi.spyOn(component.woodpeckerSessionDeleteRequested, 'emit').mockImplementation(() => {});

    component.onDeleteWoodpeckerSession(item);
    expect(component.woodpeckerSessionDeleteRequested.emit).not.toHaveBeenCalled();

    component.confirmWoodpeckerSessionDelete();
    expect(component.woodpeckerSessionDeleteRequested.emit).toHaveBeenCalledWith('pgn-1');
    expect(component.woodpeckerSessionPendingDelete).toBeNull();
  });

  it('should make open the primary card action when no session can be resumed', () => {
    fixture.componentRef.setInput('items', [
      {
        id: 'pgn-1',
        name: 'Allenamento.pgn',
        pgn: '',
        mode: 'view',
        games: [],
      },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const primaryAction = compiled.querySelector<HTMLButtonElement>('.file-open');

    expect(primaryAction?.textContent).toContain('Allenamento.pgn');
    expect(compiled.querySelector('.hero-resume')).toBeNull();
  });

  it('should expose and emit the per-game puzzle player color', () => {
    vi.spyOn(component.puzzlePlayerColorChanged, 'emit').mockImplementation(() => {});
    fixture.componentRef.setInput('puzzlePlayerColorByGameId', { 'game-2': 'black' });
    const select = document.createElement('select');
    select.innerHTML = '<option value="white">Bianco</option>';
    select.value = 'white';

    component.onPuzzlePlayerColorChange('game-1', { target: select } as unknown as Event);

    expect(component.puzzlePlayerColor('game-1')).toBe('auto');
    expect(component.puzzlePlayerColor('game-2')).toBe('black');
    expect(component.puzzlePlayerColorChanged.emit).toHaveBeenCalledWith({ gameId: 'game-1', color: 'white' });
  });

  it('should apply advanced filters without requiring a general search query', () => {
    const item = {
      id: 'pgn-1',
      name: 'Allenamento.pgn',
      pgn: '',
      mode: 'view' as const,
      games: [
        { id: 'game-1', initialFen: '', uciMoves: [], positions: [], white: 'Carlsen', black: 'Nakamura', result: '1-0' },
        { id: 'game-2', initialFen: '', uciMoves: [], positions: [], white: 'Kasparov', black: 'Karpov', result: '0-1' },
      ],
    };
    const input = document.createElement('input');
    input.value = 'Carlsen';

    component.onHeaderFilterInput(item.id, 'white', { target: input } as unknown as Event);

    expect(component.itemGameFilter(item.id)).toBe('');
    expect(component.filteredGameEntries(item).map((entry) => entry.game.id)).toEqual(['game-1']);
  });

  describe('game list', () => {
    const makeItem = (gameCount: number) => ({
      id: 'pgn-big',
      name: 'Grande.pgn',
      pgn: '',
      mode: 'view' as const,
      games: Array.from({ length: gameCount }, (_, index) => ({
        id: `big-${index + 1}`,
        initialFen: '',
        uciMoves: [],
        positions: [],
        plyCount: 10,
        white: index % 2 === 0 ? 'Carlsen' : 'Caruana',
      })),
    });

    it('should render large collections incrementally', () => {
      const item = makeItem(250);

      expect(component.filteredGameEntries(item).length).toBe(250);
      expect(component.visibleGameEntries(item).length).toBe(100);
      expect(component.hiddenGameEntriesCount(item)).toBe(150);

      component.showMoreGameEntries(item.id);
      expect(component.visibleGameEntries(item).length).toBe(200);
    });

    it('should memoize filtered entries until filters change', () => {
      const item = makeItem(10);
      const first = component.filteredGameEntries(item);

      expect(component.filteredGameEntries(item)).toBe(first);

      component.applyItemGameFilter(item.id, 'caruana');
      expect(component.filteredGameEntries(item).length).toBe(5);
    });

    it('should debounce the free-text search', () => {
      vi.useFakeTimers();
      try {
        const item = makeItem(10);
        const input = document.createElement('input');
        input.value = 'carlsen';

        component.onItemGameFilterInput(item.id, { target: input } as unknown as Event);
        expect(component.filteredGameEntries(item).length).toBe(10);

        vi.advanceTimersByTime(200);
        expect(component.filteredGameEntries(item).length).toBe(5);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('puzzle options', () => {
    const makeItem = (gameCount: number) => ({
      id: 'pgn-puzzle',
      name: 'Puzzle.pgn',
      pgn: '',
      mode: 'puzzle' as const,
      games: Array.from({ length: gameCount }, (_, index) => ({
        id: `game-${index + 1}`,
        initialFen: '',
        uciMoves: [],
        positions: [],
      })),
    });
    const checkboxEvent = (checked: boolean) => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      return { target: input } as unknown as Event;
    };
    const numberEvent = (value: string) => {
      const input = document.createElement('input');
      input.value = value;
      return { target: input } as unknown as Event;
    };

    it('should persist options across component instances', () => {
      component.onPuzzleWoodpeckerChange('pgn-puzzle', checkboxEvent(true));
      component.onPuzzleAutoAdvanceChange('pgn-puzzle', checkboxEvent(false));

      const other = TestBed.createComponent(LibraryPanelComponent).componentInstance;

      expect(other.isPuzzleWoodpecker('pgn-puzzle')).toBe(true);
      expect(other.isPuzzleAutoAdvance('pgn-puzzle')).toBe(false);
      expect(other.isPuzzleAutoRotate('pgn-puzzle')).toBe(true);
    });

    it('should keep the batch range within bounds and ordered', () => {
      const item = makeItem(20);

      expect(component.puzzleBatchRange(item)).toEqual({ from: 1, to: 10 });

      component.onPuzzleBatchRangeFromChange(item, numberEvent('50'));
      expect(component.puzzleBatchRange(item)).toEqual({ from: 20, to: 20 });

      component.onPuzzleBatchRangeFromChange(item, numberEvent('5'));
      component.onPuzzleBatchRangeToChange(item, numberEvent('3'));
      expect(component.puzzleBatchRange(item)).toEqual({ from: 5, to: 5 });

      component.onPuzzleBatchRangeToChange(item, numberEvent('12'));
      expect(component.puzzleBatchRange(item)).toEqual({ from: 5, to: 12 });
    });

    it('should include the batch config when resuming a session', () => {
      const item = makeItem(20);
      fixture.componentRef.setInput('woodpeckerSessionInfoByItemId', { [item.id]: { hasSession: true, resumePuzzleIndex: 6 } });
      component.onPuzzleBatchEnabledChange(item.id, checkboxEvent(true));
      component.onPuzzleBatchRangeFromChange(item, numberEvent('5'));
      vi.spyOn(component.resumeRequested, 'emit').mockImplementation(() => {});

      component.onResumeItem(item);

      expect(component.resumeRequested.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          puzzleIndex: 6,
          batchConfig: expect.objectContaining({ enabled: true, startIndex: 4, endIndex: 9 }),
        }),
      );
    });

    it('should ask for confirmation before removing an item', () => {
      const item = makeItem(1);
      vi.spyOn(component.itemRemoved, 'emit').mockImplementation(() => {});

      component.onRemoveItem(item);
      expect(component.itemRemoved.emit).not.toHaveBeenCalled();
      expect(component.itemPendingRemoval).toBe(item);

      component.confirmItemRemoval();
      expect(component.itemRemoved.emit).toHaveBeenCalledWith(item.id);
      expect(component.itemPendingRemoval).toBeNull();
    });
  });
});
