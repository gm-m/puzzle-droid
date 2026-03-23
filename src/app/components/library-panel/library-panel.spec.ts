import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryPanelComponent } from './library-panel';

describe('LibraryPanelComponent', () => {
  let component: LibraryPanelComponent;
  let fixture: ComponentFixture<LibraryPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryPanelComponent],
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

  it('should switch to bookmarks tab', () => {
    component.setActiveTab('bookmarks');

    expect(component.activeTab).toBe('bookmarks');
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

  it('should emit bookmark deletion and clear edit mode for the same bookmark', () => {
    spyOn(component.positionBookmarkDeleted, 'emit');
    component.startBookmarkEdit('bookmark-1');

    component.deleteBookmark('bookmark-1');

    expect(component.positionBookmarkDeleted.emit).toHaveBeenCalledWith('bookmark-1');
    expect(component.editingBookmarkId).toBeNull();
  });
});
