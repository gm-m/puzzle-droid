import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import type { LibraryMode, PgnLibraryGame, PgnLibraryItem, PgnLibraryPosition, PuzzleBatchConfig, PuzzlePlayerColor } from '../../models/library.models';
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

export interface LibraryPuzzlePlayerColorChange {
  gameId: string;
  color: PuzzlePlayerColor;
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

interface PuzzleItemOptions {
  autoFirstMove: boolean;
  autoAdvance: boolean;
  autoRotate: boolean;
  woodpecker: boolean;
  blindfold: boolean;
  blindfoldSeconds: number;
  blindfoldShowAfterAutoMove: boolean;
  batchEnabled: boolean;
  batchFrom: number;
  batchTo: number | null;
  batchLoop: boolean;
  batchShuffle: boolean;
}

const DEFAULT_PUZZLE_OPTIONS: PuzzleItemOptions = {
  autoFirstMove: false,
  autoAdvance: true,
  autoRotate: true,
  woodpecker: false,
  blindfold: false,
  blindfoldSeconds: 2,
  blindfoldShowAfterAutoMove: false,
  batchEnabled: false,
  batchFrom: 1,
  batchTo: null,
  batchLoop: true,
  batchShuffle: true,
};

const PUZZLE_OPTIONS_STORAGE_KEY = 'puzzle-droid-library-puzzle-options-v1';
const COMPACT_LAYOUT_QUERY = '(max-width: 767px)';
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
  @Input() puzzlePlayerColorByGameId: Record<string, PuzzlePlayerColor> = {};

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
  @Output() readonly puzzlePlayerColorChanged = new EventEmitter<LibraryPuzzlePlayerColorChange>();

  activeTab: LibraryViewTab = 'pgn';
  expandedItemId: string | null = null;
  editingBookmarkId: string | null = null;
  bookmarkPendingDeleteId: string | null = null;
  bookmarkSearch = '';
  bookmarkSort: BookmarkSortOption = 'newest';
  itemPendingRemoval: PgnLibraryItem | null = null;
  readonly isCompactLayout = signal(false);
  private readonly puzzleOptionsByItem = new Map<string, PuzzleItemOptions>(loadPersistedPuzzleOptions());
  private readonly gameFilterByItem = new Map<string, string>();
  private readonly headerFiltersByItem = new Map<string, LibraryHeaderFilters>();

  constructor() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const syncLayout = () => this.isCompactLayout.set(mediaQuery.matches);
    syncLayout();
    mediaQuery.addEventListener('change', syncLayout);
    inject(DestroyRef).onDestroy(() => mediaQuery.removeEventListener('change', syncLayout));
  }

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
    this.itemPendingRemoval = item;
  }

  cancelItemRemoval(): void {
    this.itemPendingRemoval = null;
  }

  confirmItemRemoval(): void {
    const item = this.itemPendingRemoval;
    if (!item) return;

    this.itemPendingRemoval = null;
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

  onResumeItem(item: PgnLibraryItem): void {
    const puzzleIndex = this.resumePuzzleIndex(item.id);
    if (puzzleIndex === null) {
      return;
    }

    this.resumeRequested.emit({
      itemId: item.id,
      puzzleIndex,
      autoPlayFirstMove: this.isPuzzleAutoFirstMove(item.id),
      autoAdvanceOnSuccess: this.isPuzzleAutoAdvance(item.id),
      autoRotateBoardOnTurn: this.isPuzzleAutoRotate(item.id),
      woodpeckerEnabled: true,
      blindfoldEnabled: this.isPuzzleBlindfold(item.id),
      blindfoldObservationSeconds: this.puzzleBlindfoldSeconds(item.id),
      blindfoldShowAfterAutoMove: this.isPuzzleBlindfoldShowAfterAutoMove(item.id),
      batchConfig: this.buildBatchConfig(item),
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
    const batchConfig = this.buildBatchConfig(item);

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

    const from = this.puzzleBatchRange(item).from - 1;
    const targetGame = item.games[from] ?? item.games[0];
    if (!targetGame) {
      return;
    }

    this.onGameClick(item, targetGame, from);
  }

  puzzlePlayerColor(gameId: string): PuzzlePlayerColor {
    return this.puzzlePlayerColorByGameId[gameId] ?? 'auto';
  }

  onPuzzlePlayerColorChange(gameId: string, event: Event): void {
    const color = (event.target as HTMLSelectElement).value as PuzzlePlayerColor;
    this.puzzlePlayerColorChanged.emit({ gameId, color });
  }

  onPuzzleAutoFirstMoveChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { autoFirstMove: (event.target as HTMLInputElement).checked });
  }

  isPuzzleAutoFirstMove(itemId: string): boolean {
    return this.puzzleOptions(itemId).autoFirstMove;
  }

  onPuzzleAutoAdvanceChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { autoAdvance: (event.target as HTMLInputElement).checked });
  }

  isPuzzleAutoAdvance(itemId: string): boolean {
    return this.puzzleOptions(itemId).autoAdvance;
  }

  onPuzzleAutoRotateChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { autoRotate: (event.target as HTMLInputElement).checked });
  }

  isPuzzleAutoRotate(itemId: string): boolean {
    return this.puzzleOptions(itemId).autoRotate;
  }

  onPuzzleBlindfoldChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { blindfold: (event.target as HTMLInputElement).checked });
  }

  isPuzzleBlindfold(itemId: string): boolean {
    return this.puzzleOptions(itemId).blindfold;
  }

  onPuzzleBlindfoldSecondsChange(itemId: string, event: Event): void {
    const seconds = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(seconds)) this.updatePuzzleOptions(itemId, { blindfoldSeconds: Math.min(60, Math.max(1, Math.trunc(seconds))) });
  }

  puzzleBlindfoldSeconds(itemId: string): number {
    return this.puzzleOptions(itemId).blindfoldSeconds;
  }

  onPuzzleBlindfoldShowAfterAutoMoveChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { blindfoldShowAfterAutoMove: (event.target as HTMLInputElement).checked });
  }

  isPuzzleBlindfoldShowAfterAutoMove(itemId: string): boolean {
    return this.puzzleOptions(itemId).blindfoldShowAfterAutoMove;
  }

  onPuzzleWoodpeckerChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { woodpecker: (event.target as HTMLInputElement).checked });
  }

  isPuzzleWoodpecker(itemId: string): boolean {
    return this.puzzleOptions(itemId).woodpecker;
  }

  onPuzzleBatchEnabledChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { batchEnabled: (event.target as HTMLInputElement).checked });
  }

  isPuzzleBatchEnabled(itemId: string): boolean {
    return this.puzzleOptions(itemId).batchEnabled;
  }

  /** Effective 1-based batch range, always within [1, games.length] and with from <= to. */
  puzzleBatchRange(item: PgnLibraryItem): { from: number; to: number } {
    const total = Math.max(1, item.games.length);
    const options = this.puzzleOptions(item.id);
    const from = Math.min(total, Math.max(1, Math.trunc(options.batchFrom)));
    const requestedTo = options.batchTo ?? Math.min(10, total);
    const to = Math.min(total, Math.max(from, Math.trunc(requestedTo)));
    return { from, to };
  }

  onPuzzleBatchRangeFromChange(item: PgnLibraryItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (Number.isFinite(value)) {
      const total = Math.max(1, item.games.length);
      const batchFrom = Math.min(total, Math.max(1, Math.trunc(value)));
      const currentTo = this.puzzleOptions(item.id).batchTo;
      this.updatePuzzleOptions(item.id, {
        batchFrom,
        batchTo: currentTo !== null && currentTo < batchFrom ? batchFrom : currentTo,
      });
    }
    input.value = String(this.puzzleBatchRange(item).from);
  }

  onPuzzleBatchRangeToChange(item: PgnLibraryItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (Number.isFinite(value)) {
      const total = Math.max(1, item.games.length);
      this.updatePuzzleOptions(item.id, { batchTo: Math.min(total, Math.max(this.puzzleBatchRange(item).from, Math.trunc(value))) });
    }
    input.value = String(this.puzzleBatchRange(item).to);
  }

  isPuzzleBatchLoop(itemId: string): boolean {
    return this.puzzleOptions(itemId).batchLoop;
  }

  onPuzzleBatchLoopChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { batchLoop: (event.target as HTMLInputElement).checked });
  }

  isPuzzleBatchShuffle(itemId: string): boolean {
    return this.puzzleOptions(itemId).batchShuffle;
  }

  onPuzzleBatchShuffleChange(itemId: string, event: Event): void {
    this.updatePuzzleOptions(itemId, { batchShuffle: (event.target as HTMLInputElement).checked });
  }

  private buildBatchConfig(item: PgnLibraryItem): PuzzleBatchConfig | undefined {
    if (item.mode !== 'puzzle' || item.games.length === 0 || !this.isPuzzleBatchEnabled(item.id)) {
      return undefined;
    }

    const { from, to } = this.puzzleBatchRange(item);
    return {
      enabled: true,
      startIndex: from - 1,
      endIndex: to - 1,
      loopBatch: this.isPuzzleBatchLoop(item.id),
      shuffleOnMistakeOrBack: this.isPuzzleBatchShuffle(item.id),
    };
  }

  private puzzleOptions(itemId: string): PuzzleItemOptions {
    return this.puzzleOptionsByItem.get(itemId) ?? DEFAULT_PUZZLE_OPTIONS;
  }

  private updatePuzzleOptions(itemId: string, patch: Partial<PuzzleItemOptions>): void {
    this.puzzleOptionsByItem.set(itemId, { ...this.puzzleOptions(itemId), ...patch });
    persistPuzzleOptions(this.puzzleOptionsByItem);
  }

  private clearItemState(itemId: string): void {
    if (this.puzzleOptionsByItem.delete(itemId)) {
      persistPuzzleOptions(this.puzzleOptionsByItem);
    }
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

function loadPersistedPuzzleOptions(): [string, PuzzleItemOptions][] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(PUZZLE_OPTIONS_STORAGE_KEY) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed as Record<string, unknown>).flatMap(([itemId, raw]) => {
      if (!raw || typeof raw !== 'object') return [];
      const stored = raw as Partial<Record<keyof PuzzleItemOptions, unknown>>;
      const options = { ...DEFAULT_PUZZLE_OPTIONS };
      for (const key of Object.keys(DEFAULT_PUZZLE_OPTIONS) as (keyof PuzzleItemOptions)[]) {
        const value = stored[key];
        const expected = typeof DEFAULT_PUZZLE_OPTIONS[key];
        if (typeof value === expected || (key === 'batchTo' && typeof value === 'number')) {
          (options as Record<string, unknown>)[key] = value;
        }
      }
      return [[itemId, options] as [string, PuzzleItemOptions]];
    });
  } catch {
    return [];
  }
}

function persistPuzzleOptions(optionsByItem: Map<string, PuzzleItemOptions>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(PUZZLE_OPTIONS_STORAGE_KEY, JSON.stringify(Object.fromEntries(optionsByItem)));
  } catch {
    // Ignore persistence errors (private mode / quota).
  }
}
