import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { LibraryMode, PgnLibraryGame, PgnLibraryItem } from '../../models/library.models';

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
  autoPlayFirstMove: boolean;
  autoAdvanceOnSuccess: boolean;
  autoRotateBoardOnTurn: boolean;
  woodpeckerEnabled: boolean;
}

export interface LibraryWoodpeckerSessionInfo {
  hasSession: boolean;
  resumePuzzleIndex: number | null;
}

export interface LibraryResumeRequest {
  itemId: string;
  puzzleIndex: number;
}

export interface LibraryWoodpeckerTargetDaysChange {
  itemId: string;
  targetDays: number;
}

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

const DEFAULT_WOODPECKER_TARGET_DAYS = 28;

@Component({
  selector: 'app-library-panel',
  imports: [CommonModule],
  templateUrl: './library-panel.html',
  styleUrl: './library-panel.scss',
})
export class LibraryPanelComponent {
  @Input() items: PgnLibraryItem[] = [];
  @Input() openedItemId: string | null = null;
  @Input() woodpeckerSessionInfoByItemId: Record<string, LibraryWoodpeckerSessionInfo> = {};

  @Output() readonly filesSelected = new EventEmitter<FileList | null>();
  @Output() readonly modeChanged = new EventEmitter<LibraryModeChange>();
  @Output() readonly gameSelected = new EventEmitter<LibraryGameSelection>();
  @Output() readonly itemRemoved = new EventEmitter<string>();
  @Output() readonly dashboardRequested = new EventEmitter<string>();
  @Output() readonly openRequested = new EventEmitter<string>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly resumeRequested = new EventEmitter<LibraryResumeRequest>();
  @Output() readonly woodpeckerSessionDeleteRequested = new EventEmitter<string>();
  @Output() readonly woodpeckerTargetDaysChanged = new EventEmitter<LibraryWoodpeckerTargetDaysChange>();

  expandedItemId: string | null = null;
  private readonly puzzleAutoFirstMoveByItem = new Map<string, boolean>();
  private readonly puzzleAutoAdvanceByItem = new Map<string, boolean>();
  private readonly puzzleAutoRotateByItem = new Map<string, boolean>();
  private readonly puzzleWoodpeckerByItem = new Map<string, boolean>();
  private readonly gameFilterByItem = new Map<string, string>();
  private readonly headerFiltersByItem = new Map<string, LibraryHeaderFilters>();

  onFilesInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filesSelected.emit(input.files);
    input.value = '';
  }

  onModeChange(id: string, event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as LibraryMode;
    this.modeChanged.emit({ id, mode });
  }

  openedItem(): PgnLibraryItem | null {
    if (!this.openedItemId) {
      return null;
    }

    return this.items.find((item) => item.id === this.openedItemId) ?? null;
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
        if (!query) {
          return true;
        }

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

  onResumeItem(itemId: string): void {
    const puzzleIndex = this.resumePuzzleIndex(itemId);
    if (puzzleIndex === null) {
      return;
    }

    this.resumeRequested.emit({ itemId, puzzleIndex });
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

    this.gameSelected.emit({
      itemId: item.id,
      gameId: game.id,
      gameTitle: this.gameTitle(gameIndex, item),
      mode: item.mode,
      initialFen: game.initialFen,
      fullUciHistory: [...fullUciHistory],
      autoPlayFirstMove: this.isPuzzleAutoFirstMove(item.id),
      autoAdvanceOnSuccess: this.isPuzzleAutoAdvance(item.id),
      autoRotateBoardOnTurn: this.isPuzzleAutoRotate(item.id),
      woodpeckerEnabled: this.isPuzzleWoodpecker(item.id),
    });
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

  onPuzzleWoodpeckerChange(itemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.puzzleWoodpeckerByItem.set(itemId, checked);
  }

  isPuzzleWoodpecker(itemId: string): boolean {
    return this.puzzleWoodpeckerByItem.get(itemId) ?? false;
  }

  private clearItemState(itemId: string): void {
    this.puzzleAutoFirstMoveByItem.delete(itemId);
    this.puzzleAutoAdvanceByItem.delete(itemId);
    this.puzzleAutoRotateByItem.delete(itemId);
    this.puzzleWoodpeckerByItem.delete(itemId);
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
