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
  mode: LibraryMode;
  initialFen: string;
  fullUciHistory: string[];
  autoPlayFirstMove: boolean;
  autoAdvanceOnSuccess: boolean;
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

  expandedItemId: string | null = null;
  private readonly puzzleAutoFirstMoveByItem = new Map<string, boolean>();
  private readonly puzzleAutoAdvanceByItem = new Map<string, boolean>();

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

  onGameClick(item: PgnLibraryItem, game: PgnLibraryGame): void {
    const fullUciHistory = game.positions.at(-1)?.uciHistory ?? [];

    this.gameSelected.emit({
      itemId: item.id,
      gameId: game.id,
      mode: item.mode,
      initialFen: game.initialFen,
      fullUciHistory: [...fullUciHistory],
      autoPlayFirstMove: this.isPuzzleAutoFirstMove(item.id),
      autoAdvanceOnSuccess: this.isPuzzleAutoAdvance(item.id),
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

  gameTitle(index: number, item: PgnLibraryItem): string {
    const game = item.games[index];
    const white = game?.white || '?';
    const black = game?.black || '?';
    const result = game?.result || '*';
    return `Partita ${index + 1}: ${white} vs ${black} (${result})`;
  }

}
