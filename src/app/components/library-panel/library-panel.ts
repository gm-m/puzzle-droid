import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { LibraryMode, PgnLibraryGame, PgnLibraryItem, PgnLibraryPosition, PuzzleBatchConfig } from '../../models/library.models';
import type { PositionBookmark } from '../analysis-panel/analysis-panel';
import { AppIconComponent } from '../ui/app-icon/app-icon';
import { AppDialogComponent } from '../ui/app-dialog/app-dialog';
import { EmptyStateComponent } from '../ui/empty-state/empty-state';
import { LoadingIndicatorComponent } from '../ui/loading-indicator/loading-indicator';
import { StatusBadgeComponent, type StatusBadgeTone } from '../ui/status-badge/status-badge';

export interface LibraryModeChange {
  id: string;
  mode: LibraryMode;
}

export interface LibraryGameSelection {
  itemId: string;
  gameId: string;
  gameTitle: string;
  mode: LibraryMode;
  initialFen: string;
  fullUciHistory: string[];
  positions: PgnLibraryPosition[];
  autoPlayFirstMove: boolean;
  autoAdvanceOnSuccess: boolean;
  autoRotateBoardOnTurn: boolean;
  woodpeckerEnabled: boolean;
  blindfoldEnabled: boolean;
  blindfoldObservationSeconds: number;
  blindfoldShowAfterAutoMove: boolean;
  batchConfig?: PuzzleBatchConfig;
}


export interface LibraryWoodpeckerSessionInfo {
  hasSession: boolean;
  resumePuzzleIndex: number | null;
}

export interface LibraryResumeRequest {
  itemId: string;
  puzzleIndex: number;
  autoPlayFirstMove: boolean;
  autoAdvanceOnSuccess: boolean;
  autoRotateBoardOnTurn: boolean;
  woodpeckerEnabled: boolean;
  blindfoldEnabled: boolean;
  blindfoldObservationSeconds: number;
  blindfoldShowAfterAutoMove: boolean;
  batchConfig?: PuzzleBatchConfig;
}

export interface LibraryWoodpeckerTargetDaysChange {
  itemId: string;
  targetDays: number;
}

export interface LibraryUploadResult {
  fileName: string;
  status: 'success' | 'error';
  message: string;
}

type LibraryViewTab = 'pgn' | 'famous-tactics' | 'bookmarks';

interface LibraryFilteredGameEntry {
  game: PgnLibraryGame;
  index: number;
  title: string;
  moveCount: number;
}

interface LibraryHeaderFilters {
  white: string;
  black: string;
  event: string;
  result: string;
}

type BookmarkSortOption = 'newest' | 'oldest' | 'title';

const DEFAULT_WOODPECKER_TARGET_DAYS = 28;

@Component({
  selector: 'app-library-panel',
  imports: [CommonModule, AppIconComponent, AppDialogComponent, EmptyStateComponent, LoadingIndicatorComponent, StatusBadgeComponent],
  templateUrl: './library-panel.html',
  styleUrl: './library-panel.scss',
})
export class LibraryPanelComponent {
  @Input() items: PgnLibraryItem[] = [];
  @Input() famousTacticsItems: PgnLibraryItem[] = [];
  @Input() openedItemId: string | null = null;
  @Input() positionBookmarks: PositionBookmark[] = [];
  @Input() woodpeckerSessionInfoByItemId: Record<string, LibraryWoodpeckerSessionInfo> = {};
  @Input() isUploadInProgress = false;
  @Input() uploadResults: LibraryUploadResult[] = [];

  @Output() readonly filesSelected = new EventEmitter<FileList | null>();
  @Output() readonly modeChanged = new EventEmitter<LibraryModeChange>();
  @Output() readonly gameSelected = new EventEmitter<LibraryGameSelection>();
  @Output() readonly itemRemoved = new EventEmitter<string>();
  @Output() readonly dashboardRequested = new EventEmitter<string>();
  @Output() readonly openRequested = new EventEmitter<string>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly resumeRequested = new EventEmitter<LibraryResumeRequest>();
  @Output() readonly positionBookmarkSelected = new EventEmitter<string>();
  @Output() readonly positionBookmarkUpdated = new EventEmitter<{ id: string; title: string; note: string }>();
  @Output() readonly positionBookmarkDeleted = new EventEmitter<string>();
  @Output() readonly woodpeckerSessionDeleteRequested = new EventEmitter<string>();
  @Output() readonly woodpeckerTargetDaysChanged = new EventEmitter<LibraryWoodpeckerTargetDaysChange>();

  activeTab: LibraryViewTab = 'pgn';
  expandedItemId: string | null = null;
  editingBookmarkId: string | null = null;
  bookmarkPendingDeleteId: string | null = null;
  bookmarkSearch = '';
  bookmarkSort: BookmarkSortOption = 'newest';
  private readonly puzzleAutoFirstMoveByItem = new Map<string, boolean>();
  private readonly puzzleAutoAdvanceByItem = new Map<string, boolean>();
  private readonly puzzleAutoRotateByItem = new Map<string, boolean>();
  private readonly puzzleWoodpeckerByItem = new Map<string, boolean>();
  private readonly puzzleBlindfoldByItem = new Map<string, boolean>();
  private readonly puzzleBlindfoldSecondsByItem = new Map<string, number>();
  private readonly puzzleBlindfoldShowAfterAutoMoveByItem = new Map<string, boolean>();
  private readonly puzzleBatchEnabledByItem = new Map<string, boolean>();
  private readonly puzzleBatchRangeFromByItem = new Map<string, number>();
  private readonly puzzleBatchRangeToByItem = new Map<string, number>();
  private readonly puzzleBatchLoopByItem = new Map<string, boolean>();
  private readonly puzzleBatchShuffleByItem = new Map<string, boolean>();
  private readonly gameFilterByItem = new Map<string, string>();
  private readonly headerFiltersByItem = new Map<string, LibraryHeaderFilters>();


  onFilesInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filesSelected.emit(input.files);
    input.value = '';
  }

  setActiveTab(tab: LibraryViewTab): void {
    this.activeTab = tab;
  }

  onOpenBookmark(bookmarkId: string): void {
    this.positionBookmarkSelected.emit(bookmarkId);
  }

  startBookmarkEdit(bookmarkId: string): void {
    this.editingBookmarkId = bookmarkId;
  }

  cancelBookmarkEdit(): void {
    this.editingBookmarkId = null;
  }

  onBookmarkSearchInput(event: Event): void {
    this.bookmarkSearch = (event.target as HTMLInputElement).value;
  }

  onBookmarkSortChange(event: Event): void {
    this.bookmarkSort = (event.target as HTMLSelectElement).value as BookmarkSortOption;
  }

  filteredBookmarks(): PositionBookmark[] {
    const query = this.bookmarkSearch.trim().toLowerCase();

    return [...this.positionBookmarks]
      .filter((bookmark) => {
        if (!query) {
          return true;
        }

        return [bookmark.title, bookmark.note, bookmark.fen].join(' ').toLowerCase().includes(query);
      })
      .sort((left, right) => {
        switch (this.bookmarkSort) {
          case 'oldest':
            return left.createdAt - right.createdAt;
          case 'title':
            return left.title.localeCompare(right.title, 'it');
          case 'newest':
          default:
            return right.createdAt - left.createdAt;
        }
      });
  }

  saveBookmarkEdit(bookmarkId: string, titleInput: HTMLInputElement, noteInput: HTMLTextAreaElement): void {
    this.positionBookmarkUpdated.emit({
      id: bookmarkId,
      title: titleInput.value,
      note: noteInput.value,
    });
    this.editingBookmarkId = null;
  }

  deleteBookmark(bookmarkId: string): void {
    this.bookmarkPendingDeleteId = bookmarkId;
  }

  cancelBookmarkDelete(): void {
    this.bookmarkPendingDeleteId = null;
  }

  confirmBookmarkDelete(): void {
    const bookmarkId = this.bookmarkPendingDeleteId;
    if (!bookmarkId) return;

    this.positionBookmarkDeleted.emit(bookmarkId);
    if (this.editingBookmarkId === bookmarkId) {
      this.editingBookmarkId = null;
    }
    this.bookmarkPendingDeleteId = null;
  }

  pendingBookmarkDeleteTitle(): string {
    return this.positionBookmarks.find((entry) => entry.id === this.bookmarkPendingDeleteId)?.title ?? 'questo bookmark';
  }

  isEditingBookmark(bookmarkId: string): boolean {
    return this.editingBookmarkId === bookmarkId;
  }

  onModeChange(id: string, event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as LibraryMode;
    this.modeChanged.emit({ id, mode });
  }

  openedItem(): PgnLibraryItem | null {
    if (!this.openedItemId) {
      return null;
    }

    return this.visibleItems().find((item) => item.id === this.openedItemId) ?? null;
  }

  visibleItems(): PgnLibraryItem[] {
    return this.activeTab === 'famous-tactics' ? this.famousTacticsItems : this.items;
  }

  activePgnTabLabel(): string {
    return this.activeTab === 'famous-tactics' ? 'tattiche famose' : 'PGN';
  }

  activeEmptyStateLabel(): string {
    return this.activeTab === 'famous-tactics'
      ? 'Nessuna tattica da partite famose disponibile.'
      : 'Nessun PGN caricato.';
  }

  canRemoveItem(): boolean {
    return this.activeTab === 'pgn';
  }

  onOpenItem(itemId: string): void {
    this.openRequested.emit(itemId);
  }

  onCloseOpenedItem(): void {
    this.closeRequested.emit();
  }

  toggleItemExpansion(itemId: string): void {
    this.expandedItemId = this.expandedItemId === itemId ? null : itemId;
  }

  isExpanded(itemId: string): boolean {
    return this.expandedItemId === itemId;
  }

  onItemGameFilterInput(itemId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.gameFilterByItem.set(itemId, value);
  }

  itemGameFilter(itemId: string): string {
    return this.gameFilterByItem.get(itemId) ?? '';
  }

  onHeaderFilterInput(itemId: string, key: keyof LibraryHeaderFilters, event: Event): void {
    const rawValue = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const next = {
      ...this.itemHeaderFilters(itemId),
      [key]: rawValue,
    };
    this.headerFiltersByItem.set(itemId, next);
  }

  headerFilterValue(itemId: string, key: keyof LibraryHeaderFilters): string {
    return this.itemHeaderFilters(itemId)[key];
  }

  resultOptions(item: PgnLibraryItem): string[] {
    return [...new Set(item.games.map((game) => (game.result ?? '').trim()).filter((value) => value.length > 0))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  filteredGameEntries(item: PgnLibraryItem): LibraryFilteredGameEntry[] {
    const query = this.itemGameFilter(item.id).trim().toLowerCase();
    const headerFilters = this.itemHeaderFilters(item.id);
    const whiteFilter = headerFilters.white.trim().toLowerCase();
    const blackFilter = headerFilters.black.trim().toLowerCase();
    const eventFilter = headerFilters.event.trim().toLowerCase();
    const resultFilter = headerFilters.result.trim();

    return item.games
      .map((game, index) => ({
        game,
        index,
        title: this.gameTitle(index, item),
        moveCount: Math.max(0, game.positions.length - 1),
      }))
      .filter((entry) => {
        const haystack = [
          entry.title,
          entry.game.white ?? '',
          entry.game.black ?? '',
          entry.game.event ?? '',
          entry.game.result ?? '',
        ]
          .join(' ')
          .toLowerCase();

        if (query && !haystack.includes(query)) {
          return false;
        }

        if (whiteFilter && !(entry.game.white ?? '').toLowerCase().includes(whiteFilter)) {
          return false;
        }

        if (blackFilter && !(entry.game.black ?? '').toLowerCase().includes(blackFilter)) {
          return false;
        }

        if (eventFilter && !(entry.game.event ?? '').toLowerCase().includes(eventFilter)) {
          return false;
        }

        if (resultFilter && (entry.game.result ?? '*') !== resultFilter) {
          return false;
        }

        return true;
      });
  }

  onRemoveItem(item: PgnLibraryItem): void {
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(`Rimuovere "${item.name}" dalla libreria? Questa azione non elimina il file dal disco.`);
    if (!confirmed) {
      return;
    }

    this.clearItemState(item.id);
    this.itemRemoved.emit(item.id);
  }

  onOpenDashboard(itemId: string): void {
    this.dashboardRequested.emit(itemId);
  }

  hasResumeSession(itemId: string): boolean {
    return this.resumePuzzleIndex(itemId) !== null;
  }

  hasWoodpeckerSession(itemId: string): boolean {
    return this.woodpeckerSessionInfoByItemId[itemId]?.hasSession === true;
  }

  woodpeckerStatusLabel(itemId: string): string {
    if (this.hasResumeSession(itemId)) {
      return `Riprendi dal puzzle ${this.resumePuzzleIndex(itemId)! + 1}`;
    }

    if (this.hasWoodpeckerSession(itemId)) {
      return 'Sessione Woodpecker attiva';
    }

    return 'Nessuna sessione Woodpecker';
  }

  woodpeckerStatusClass(itemId: string): string {
    if (this.hasResumeSession(itemId)) {
      return 'status-resume';
    }

    if (this.hasWoodpeckerSession(itemId)) {
      return 'status-session';
    }

    return 'status-idle';
  }

  woodpeckerStatusTone(itemId: string): StatusBadgeTone {
    if (this.hasResumeSession(itemId)) return 'success';
    if (this.hasWoodpeckerSession(itemId)) return 'info';
    return 'neutral';
  }

  onResumeItem(itemId: string): void {
    const puzzleIndex = this.resumePuzzleIndex(itemId);
    if (puzzleIndex === null) {
      return;
    }

    this.resumeRequested.emit({
      itemId,
      puzzleIndex,
      autoPlayFirstMove: this.isPuzzleAutoFirstMove(itemId),
      autoAdvanceOnSuccess: this.isPuzzleAutoAdvance(itemId),
      autoRotateBoardOnTurn: this.isPuzzleAutoRotate(itemId),
      woodpeckerEnabled: true,
      blindfoldEnabled: this.isPuzzleBlindfold(itemId),
      blindfoldObservationSeconds: this.puzzleBlindfoldSeconds(itemId),
      blindfoldShowAfterAutoMove: this.isPuzzleBlindfoldShowAfterAutoMove(itemId),
    });
  }

  onDeleteWoodpeckerSession(itemId: string): void {
    this.woodpeckerSessionDeleteRequested.emit(itemId);
  }

  woodpeckerInitialTargetDays(item: PgnLibraryItem): number {
    const candidate = Number(item.woodpeckerInitialTargetDays ?? DEFAULT_WOODPECKER_TARGET_DAYS);
    if (!Number.isFinite(candidate)) {
      return DEFAULT_WOODPECKER_TARGET_DAYS;
    }

    return Math.max(1, Math.trunc(candidate));
  }

  onWoodpeckerTargetDaysInput(itemId: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.woodpeckerTargetDaysChanged.emit({
      itemId,
      targetDays: Math.max(1, Math.trunc(value)),
    });
  }

  onGameClick(item: PgnLibraryItem, game: PgnLibraryGame, gameIndex: number): void {
    const fullUciHistory = game.positions.at(-1)?.uciHistory ?? [];

    let batchConfig: PuzzleBatchConfig | undefined = undefined;
    if (item.mode === 'puzzle' && this.isPuzzleBatchEnabled(item.id)) {
      const from = Math.max(0, this.puzzleBatchRangeFrom(item.id) - 1);
      const to = Math.min(item.games.length - 1, Math.max(from, this.puzzleBatchRangeTo(item.id, item.games.length) - 1));
      batchConfig = {
        enabled: true,
        startIndex: from,
        endIndex: to,
        loopBatch: this.isPuzzleBatchLoop(item.id),
        shuffleOnMistakeOrBack: this.isPuzzleBatchShuffle(item.id),
      };
    }

    this.gameSelected.emit({
      itemId: item.id,
      gameId: game.id,
      gameTitle: this.gameTitle(gameIndex, item),
      mode: item.mode,
      initialFen: game.initialFen,
      fullUciHistory: [...fullUciHistory],
      positions: game.positions.map((position) => ({
        ...position,
        uciHistory: [...position.uciHistory],
      })),
      autoPlayFirstMove: this.isPuzzleAutoFirstMove(item.id),
      autoAdvanceOnSuccess: this.isPuzzleAutoAdvance(item.id),
      autoRotateBoardOnTurn: this.isPuzzleAutoRotate(item.id),
      woodpeckerEnabled: this.isPuzzleWoodpecker(item.id),
      blindfoldEnabled: this.isPuzzleBlindfold(item.id),
      blindfoldObservationSeconds: this.puzzleBlindfoldSeconds(item.id),
      blindfoldShowAfterAutoMove: this.isPuzzleBlindfoldShowAfterAutoMove(item.id),
      batchConfig,
    });
  }

  startBatchDrill(item: PgnLibraryItem): void {
    if (item.games.length === 0) {
      return;
    }

    const from = Math.max(0, this.puzzleBatchRangeFrom(item.id) - 1);
    const targetGame = item.games[from] ?? item.games[0];
    if (!targetGame) {
      return;
    }

    this.onGameClick(item, targetGame, from);
  }

  onPuzzleAutoFirstMoveChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleAutoFirstMoveByItem.set(itemId, checked);
  }

  isPuzzleAutoFirstMove(itemId: string): boolean {
    return this.puzzleAutoFirstMoveByItem.get(itemId) ?? false;
  }

  onPuzzleAutoAdvanceChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleAutoAdvanceByItem.set(itemId, checked);
  }

  isPuzzleAutoAdvance(itemId: string): boolean {
    return this.puzzleAutoAdvanceByItem.get(itemId) ?? true;
  }

  onPuzzleAutoRotateChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleAutoRotateByItem.set(itemId, checked);
  }

  isPuzzleAutoRotate(itemId: string): boolean {
    return this.puzzleAutoRotateByItem.get(itemId) ?? true;
  }

  onPuzzleBlindfoldChange(itemId: string, event: Event): void {
    this.puzzleBlindfoldByItem.set(itemId, (event.target as HTMLInputElement).checked);
  }

  isPuzzleBlindfold(itemId: string): boolean {
    return this.puzzleBlindfoldByItem.get(itemId) ?? false;
  }

  onPuzzleBlindfoldSecondsChange(itemId: string, event: Event): void {
    const seconds = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(seconds)) this.puzzleBlindfoldSecondsByItem.set(itemId, Math.min(60, Math.max(1, Math.trunc(seconds))));
  }

  puzzleBlindfoldSeconds(itemId: string): number {
    return this.puzzleBlindfoldSecondsByItem.get(itemId) ?? 2;
  }

  onPuzzleBlindfoldShowAfterAutoMoveChange(itemId: string, event: Event): void {
    this.puzzleBlindfoldShowAfterAutoMoveByItem.set(itemId, (event.target as HTMLInputElement).checked);
  }

  isPuzzleBlindfoldShowAfterAutoMove(itemId: string): boolean {
    return this.puzzleBlindfoldShowAfterAutoMoveByItem.get(itemId) ?? false;
  }

  onPuzzleWoodpeckerChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleWoodpeckerByItem.set(itemId, checked);
  }

  isPuzzleWoodpecker(itemId: string): boolean {
    return this.puzzleWoodpeckerByItem.get(itemId) ?? false;
  }

  onPuzzleBatchEnabledChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleBatchEnabledByItem.set(itemId, checked);
  }

  isPuzzleBatchEnabled(itemId: string): boolean {
    return this.puzzleBatchEnabledByItem.get(itemId) ?? false;
  }

  puzzleBatchRangeFrom(itemId: string): number {
    const candidate = Number(this.puzzleBatchRangeFromByItem.get(itemId) ?? 1);
    return Number.isFinite(candidate) && candidate >= 1 ? Math.trunc(candidate) : 1;
  }

  onPuzzleBatchRangeFromChange(itemId: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    this.puzzleBatchRangeFromByItem.set(itemId, Math.max(1, Math.trunc(value)));
  }

  puzzleBatchRangeTo(itemId: string, totalGames: number): number {
    const defaultTo = Math.min(10, Math.max(1, totalGames));
    const candidate = Number(this.puzzleBatchRangeToByItem.get(itemId) ?? defaultTo);
    if (!Number.isFinite(candidate)) {
      return defaultTo;
    }
    return Math.max(1, Math.trunc(candidate));
  }

  onPuzzleBatchRangeToChange(itemId: string, event: Event, totalGames: number): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    const maxVal = Math.max(1, totalGames);
    this.puzzleBatchRangeToByItem.set(itemId, Math.min(maxVal, Math.max(1, Math.trunc(value))));
  }

  isPuzzleBatchLoop(itemId: string): boolean {
    return this.puzzleBatchLoopByItem.get(itemId) ?? true;
  }

  onPuzzleBatchLoopChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleBatchLoopByItem.set(itemId, checked);
  }

  isPuzzleBatchShuffle(itemId: string): boolean {
    return this.puzzleBatchShuffleByItem.get(itemId) ?? true;
  }

  onPuzzleBatchShuffleChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleBatchShuffleByItem.set(itemId, checked);
  }

  private clearItemState(itemId: string): void {
    this.puzzleAutoFirstMoveByItem.delete(itemId);
    this.puzzleAutoAdvanceByItem.delete(itemId);
    this.puzzleAutoRotateByItem.delete(itemId);
    this.puzzleWoodpeckerByItem.delete(itemId);
    this.puzzleBlindfoldByItem.delete(itemId);
    this.puzzleBlindfoldSecondsByItem.delete(itemId);
    this.puzzleBlindfoldShowAfterAutoMoveByItem.delete(itemId);
    this.puzzleBatchEnabledByItem.delete(itemId);
    this.puzzleBatchRangeFromByItem.delete(itemId);
    this.puzzleBatchRangeToByItem.delete(itemId);
    this.puzzleBatchLoopByItem.delete(itemId);
    this.puzzleBatchShuffleByItem.delete(itemId);
    this.gameFilterByItem.delete(itemId);
    this.headerFiltersByItem.delete(itemId);
    if (this.expandedItemId === itemId) {
      this.expandedItemId = null;
    }
  }


  gameTitle(index: number, item: PgnLibraryItem): string {
    const game = item.games[index];
    const white = game?.white || '?';
    const black = game?.black || '?';
    const result = game?.result || '*';
    return `Partita ${index + 1}: ${white} vs ${black} (${result})`;
  }

  trackByGameEntry(_: number, entry: LibraryFilteredGameEntry): string {
    return entry.game.id;
  }

  private itemHeaderFilters(itemId: string): LibraryHeaderFilters {
    return (
      this.headerFiltersByItem.get(itemId) ?? {
        white: '',
        black: '',
        event: '',
        result: '',
      }
    );
  }

  private resumePuzzleIndex(itemId: string): number | null {
    const value = this.woodpeckerSessionInfoByItemId[itemId]?.resumePuzzleIndex;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return Math.max(0, Math.trunc(value));
  }

}
