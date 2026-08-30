import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryPanelComponent } from './library-panel';

describe('LibraryPanelComponent', () => {
  let component: LibraryPanelComponent;
  let fixture: ComponentFixture<LibraryPanelComponent>;

  beforeEach(async () => {
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
    component.items = [
      {
        id: 'pgn-1',
        name: 'Allenamento.pgn',
        pgn: '',
        mode: 'puzzle',
        games: [],
      },
    ];
    component.woodpeckerSessionInfoByItemId = {
      'pgn-1': { hasSession: true, resumePuzzleIndex: 4 },
    };
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
    component.items = [
      {
        id: 'pgn-1',
        name: 'Allenamento.pgn',
        pgn: '',
        mode: 'view',
        games: [],
      },
    ];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const primaryAction = compiled.querySelector<HTMLButtonElement>('.card-primary-action');

    expect(primaryAction?.textContent?.trim()).toBe('Apri PGN');
  });

  it('should apply advanced filters without requiring a general search query', () => {
    const item = {
      id: 'pgn-1',
      name: 'Allenamento.pgn',
      pgn: '',
      mode: 'view' as const,
      games: [
        { id: 'game-1', initialFen: '', positions: [], white: 'Carlsen', black: 'Nakamura', result: '1-0' },
        { id: 'game-2', initialFen: '', positions: [], white: 'Kasparov', black: 'Karpov', result: '0-1' },
      ],
    };
    const input = document.createElement('input');
    input.value = 'Carlsen';

    component.onHeaderFilterInput(item.id, 'white', { target: input } as unknown as Event);

    expect(component.itemGameFilter(item.id)).toBe('');
    expect(component.filteredGameEntries(item).map((entry) => entry.game.id)).toEqual(['game-1']);
  });
});
