import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryPanelComponent } from './library-panel';

describe('LibraryPanelComponent', () => {
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
    component.positionBookmarks = [
      {
        id: 'bookmark-1',
        title: 'Posizione uno',
        note: 'Nota iniziale',
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        createdAt: 1700000000000,
      },
    ];
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
    spyOn(component.positionBookmarkSelected, 'emit');

    component.onOpenBookmark('bookmark-1');

    expect(component.positionBookmarkSelected.emit).toHaveBeenCalledWith('bookmark-1');
  });

  it('should emit bookmark update and leave edit mode', () => {
    spyOn(component.positionBookmarkUpdated, 'emit');
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
    spyOn(component.positionBookmarkDeleted, 'emit');
    component.startBookmarkEdit('bookmark-1');

    component.deleteBookmark('bookmark-1');
    expect(component.positionBookmarkDeleted.emit).not.toHaveBeenCalled();

    component.confirmBookmarkDelete();

    expect(component.positionBookmarkDeleted.emit).toHaveBeenCalledWith('bookmark-1');
    expect(component.editingBookmarkId).toBeNull();
    expect(component.bookmarkPendingDeleteId).toBeNull();
  });

  it('should filter bookmarks by title, note or fen and sort them', () => {
    component.positionBookmarks = [
      ...component.positionBookmarks,
      {
        id: 'bookmark-2',
        title: 'Altra posizione',
        note: 'Seconda nota',
        fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
        createdAt: 1600000000000,
      },
    ];

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
    const primaryActions = compiled.querySelectorAll<HTMLButtonElement>('.card-primary-action');
    const secondaryActions = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.card-secondary-action'),
    ).map((button) => button.textContent?.trim());

    expect(primaryActions.length).toBe(1);
    expect(primaryActions[0].textContent?.trim()).toBe('Riprendi dal puzzle 5');
    expect(secondaryActions).toContain('Apri PGN');
    expect(secondaryActions).toContain('Anteprima partite');
    expect(secondaryActions).toContain('Dashboard Woodpecker');
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
    const primaryAction = compiled.querySelector<HTMLButtonElement>('.card-primary-action');

    expect(primaryAction?.textContent?.trim()).toBe('Apri PGN');
  });

  it('should expose and emit the per-game puzzle player color', () => {
    spyOn(component.puzzlePlayerColorChanged, 'emit');
    component.puzzlePlayerColorByGameId = { 'game-2': 'black' };
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
      jasmine.clock().install();
      try {
        const item = makeItem(10);
        const input = document.createElement('input');
        input.value = 'carlsen';

        component.onItemGameFilterInput(item.id, { target: input } as unknown as Event);
        expect(component.filteredGameEntries(item).length).toBe(10);

        jasmine.clock().tick(200);
        expect(component.filteredGameEntries(item).length).toBe(5);
      } finally {
        jasmine.clock().uninstall();
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

      expect(other.isPuzzleWoodpecker('pgn-puzzle')).toBeTrue();
      expect(other.isPuzzleAutoAdvance('pgn-puzzle')).toBeFalse();
      expect(other.isPuzzleAutoRotate('pgn-puzzle')).toBeTrue();
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
      component.woodpeckerSessionInfoByItemId = { [item.id]: { hasSession: true, resumePuzzleIndex: 6 } };
      component.onPuzzleBatchEnabledChange(item.id, checkboxEvent(true));
      component.onPuzzleBatchRangeFromChange(item, numberEvent('5'));
      spyOn(component.resumeRequested, 'emit');

      component.onResumeItem(item);

      expect(component.resumeRequested.emit).toHaveBeenCalledWith(
        jasmine.objectContaining({
          puzzleIndex: 6,
          batchConfig: jasmine.objectContaining({ enabled: true, startIndex: 4, endIndex: 9 }),
        }),
      );
    });

    it('should ask for confirmation before removing an item', () => {
      const item = makeItem(1);
      spyOn(component.itemRemoved, 'emit');

      component.onRemoveItem(item);
      expect(component.itemRemoved.emit).not.toHaveBeenCalled();
      expect(component.itemPendingRemoval).toBe(item);

      component.confirmItemRemoval();
      expect(component.itemRemoved.emit).toHaveBeenCalledWith(item.id);
      expect(component.itemPendingRemoval).toBeNull();
    });
  });
});
