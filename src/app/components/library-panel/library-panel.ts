import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { LibraryMode, PgnLibraryGame, PgnLibraryItem, PgnLibraryPosition } from '../../models/library.models';

export interface LibraryModeChange {
  id: string;
  mode: LibraryMode;
}

export interface LibraryPositionSelection {
  itemId: string;
  gameId: string;
  positionId: string;
  initialFen: string;
  fen: string;
  uciHistory: string[];
  fullUciHistory: string[];
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
  @Output() readonly positionSelected = new EventEmitter<LibraryPositionSelection>();

  expandedItemId: string | null = null;
  selectedPositionKey: string | null = null;

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

  onPositionClick(itemId: string, game: PgnLibraryGame, position: PgnLibraryPosition): void {
    const fullUciHistory = game.positions.at(-1)?.uciHistory ?? [];

    this.selectedPositionKey = this.buildPositionKey(itemId, game.id, position.id);
    this.positionSelected.emit({
      itemId,
      gameId: game.id,
      positionId: position.id,
      initialFen: game.initialFen,
      fen: position.fen,
      uciHistory: [...position.uciHistory],
      fullUciHistory: [...fullUciHistory],
    });
  }

  isPositionSelected(itemId: string, gameId: string, positionId: string): boolean {
    return this.selectedPositionKey === this.buildPositionKey(itemId, gameId, positionId);
  }

  gameTitle(index: number, item: PgnLibraryItem): string {
    const game = item.games[index];
    const white = game?.white || '?';
    const black = game?.black || '?';
    const result = game?.result || '*';
    return `Partita ${index + 1}: ${white} vs ${black} (${result})`;
  }

  private buildPositionKey(itemId: string, gameId: string, positionId: string): string {
    return `${itemId}:${gameId}:${positionId}`;
  }
}
