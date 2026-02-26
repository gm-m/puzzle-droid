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

interface LibraryFilteredGameEntry {
  game: PgnLibraryGame;
  index: number;
  title: string;
}

@Component({
  selector: 'app-library-panel',
  imports: [CommonModule],
  templateUrl: './library-panel.html',
  styleUrl: './library-panel.scss',
})
export class LibraryPanelComponent {
  @Input() items: PgnLibraryItem[] = [];

  @Output() readonly filesSelected = new EventEmitter<FileList | null>();
  @Output() readonly modeChanged = new EventEmitter<LibraryModeChange>();
  @Output() readonly gameSelected = new EventEmitter<LibraryGameSelection>();
  @Output() readonly itemRemoved = new EventEmitter<string>();
  @Output() readonly dashboardRequested = new EventEmitter<string>();

  expandedItemId: string | null = null;
  private readonly puzzleAutoFirstMoveByItem = new Map<string, boolean>();
  private readonly puzzleAutoAdvanceByItem = new Map<string, boolean>();
  private readonly puzzleAutoRotateByItem = new Map<string, boolean>();
  private readonly puzzleWoodpeckerByItem = new Map<string, boolean>();
  private readonly gameFilterByItem = new Map<string, string>();

  onFilesInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filesSelected.emit(input.files);
    input.value = '';
  }

  onModeChange(id: string, event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as LibraryMode;
    this.modeChanged.emit({ id, mode });
  }

  toggleItemExpansion(id: string): void {
    this.expandedItemId = this.expandedItemId === id ? null : id;
  }

  isExpanded(id: string): boolean {
    return this.expandedItemId === id;
  }

  onItemGameFilterInput(itemId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.gameFilterByItem.set(itemId, value);
  }

  itemGameFilter(itemId: string): string {
    return this.gameFilterByItem.get(itemId) ?? '';
  }

  filteredGameEntries(item: PgnLibraryItem): LibraryFilteredGameEntry[] {
    const query = this.itemGameFilter(item.id).trim().toLowerCase();

    return item.games
      .map((game, index) => ({
        game,
        index,
        title: this.gameTitle(index, item),
      }))
      .filter((entry) => !query || entry.title.toLowerCase().includes(query));
  }

  onRemoveItem(item: PgnLibraryItem): void {
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(`Rimuovere "${item.name}" dalla libreria? Questa azione non elimina il file dal disco.`);
    if (!confirmed) {
      return;
    }

    if (this.expandedItemId === item.id) {
      this.expandedItemId = null;
    }

    this.clearItemState(item.id);
    this.itemRemoved.emit(item.id);
  }

  onOpenDashboard(itemId: string): void {
    this.dashboardRequested.emit(itemId);
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
  }

  gameTitle(index: number, item: PgnLibraryItem): string {
    const game = item.games[index];
    const white = game?.white || '?';
    const black = game?.black || '?';
    const result = game?.result || '*';
    return `Partita ${index + 1}: ${white} vs ${black} (${result})`;
  }

}
