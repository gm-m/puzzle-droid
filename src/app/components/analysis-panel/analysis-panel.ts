import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { EngineLine, EngineScore } from '../../models/engine.models';

export interface LineMoveSelection {
  line: EngineLine;
  moveIndex: number;
}

interface MoveEntry {
  index: number;
  text: string;
}

interface MoveRow {
  moveNumber: number;
  white: MoveEntry | null;
  black: MoveEntry | null;
}

@Component({
  selector: 'app-analysis-panel',
  imports: [CommonModule],
  templateUrl: './analysis-panel.html',
  styleUrl: './analysis-panel.scss',
})
export class AnalysisPanelComponent {
  @Input() isAnalyzing = false;
  @Input() bestMove = '-';
  @Input() evalLabel = '-';
  @Input() fen = '';
  @Input() depth = 8;
  @Input() multiPv = 1;
  @Input() skillLevel = 20;
  @Input() showEvalBar = true;
  @Input() isSettingsOpen = false;
  isEngineLinesExpanded = false;

  get lines(): EngineLine[] {
    return this._lines;
  }
  @Input('lines') set lines(value: EngineLine[]) {
    this._lines = value;
  }
  private _lines: EngineLine[] = [];
  @Input() libraryGameTitle = '';
  @Input() canGoBack = false;
  @Input() canGoForward = false;
  @Input() canGoPreviousGame = false;
  @Input() canGoNextGame = false;
  @Input() showEngineArea = true;
  @Input() showMoveArea = true;
  @Input() showMoveList = true;
  @Input() moveListMaxHeight = 0;
  @Input() moves: string[] = [];
  @Input() moveCursor = 0;
  @Input() fenInputValue = '';
  @Input() fenFeedback = '';
  @Input() pgnFeedback = '';
  @Input() hideEngine = false;
  @Input() puzzleMessage = '';
  @Input() showSurrender = false;
  @Input() showWoodpeckerInfo = false;
  @Input() woodpeckerCycleLabel = '';
  @Input() woodpeckerProgressLabel = '';
  @Input() woodpeckerTargetLabel = '';
  @Input() woodpeckerDayLabel = '';
  @Input() woodpeckerCalendarLabel = '';
  @Input() woodpeckerProgressPercent = 0;
  @Input() boardOrientation: 'white' | 'black' = 'white';
  @Input() turnColor: 'white' | 'black' = 'white';
  @Input() showBestMoveArrow = false;
  @Input() showLibraryGameNavigation = false;

  isEngineSettingsOpen = false;
  isQuickMenuOpen = false;
  isWoodpeckerInfoModalOpen = false;

  @Output() readonly analyze = new EventEmitter<void>();
  @Output() readonly reset = new EventEmitter<void>();
  @Output() readonly depthChanged = new EventEmitter<number>();
  @Output() readonly multiPvChanged = new EventEmitter<number>();
  @Output() readonly skillLevelChanged = new EventEmitter<number>();
  @Output() readonly toggleEvalBar = new EventEmitter<void>();
  @Output() readonly firstMove = new EventEmitter<void>();
  @Output() readonly previousMove = new EventEmitter<void>();
  @Output() readonly nextMove = new EventEmitter<void>();
  @Output() readonly lastMove = new EventEmitter<void>();
  @Output() readonly previousGame = new EventEmitter<void>();
  @Output() readonly nextGame = new EventEmitter<void>();
  @Output() readonly moveJumpRequested = new EventEmitter<number>();
  @Output() readonly lineSelected = new EventEmitter<LineMoveSelection>();
  @Output() readonly fenApplied = new EventEmitter<string>();
  @Output() readonly pgnApplied = new EventEmitter<string>();
  @Output() readonly surrenderPuzzle = new EventEmitter<void>();
  @Output() readonly rotateBoard = new EventEmitter<void>();
  @Output() readonly bestMoveArrowToggled = new EventEmitter<boolean>();

  toggleEngineSettings(): void {
    this.isEngineSettingsOpen = !this.isEngineSettingsOpen;
  }

  toggleEngineLines(): void {
    this.isEngineLinesExpanded = !this.isEngineLinesExpanded;
  }

  toggleQuickMenu(): void {
    this.isQuickMenuOpen = !this.isQuickMenuOpen;
  }

  openWoodpeckerInfoModal(): void {
    this.isWoodpeckerInfoModalOpen = true;
  }

  closeWoodpeckerInfoModal(): void {
    this.isWoodpeckerInfoModalOpen = false;
  }

  onRotateBoardFromQuickMenu(): void {
    this.rotateBoard.emit();
    this.isQuickMenuOpen = false;
  }

  onDepthInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.depthChanged.emit(value);
    }
  }

  onMultiPvInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.multiPvChanged.emit(value);
    }
  }

  onSkillLevelInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.skillLevelChanged.emit(value);
    }
  }

  lineHeader(line: EngineLine): string {
    return `${this.formatScore(line.score)} | d${line.depth}`;
  }

  selectLineMove(line: EngineLine, moveIndex: number): void {
    this.lineSelected.emit({ line, moveIndex });
  }

  jumpToMove(ply: number): void {
    this.moveJumpRequested.emit(ply);
  }

  moveLabel(move: string, index: number): string {
    const moveNumber = Math.floor(index / 2) + 1;
    const prefix = index % 2 === 0 ? `${moveNumber}.` : `${moveNumber}...`;
    return `${prefix} ${move}`;
  }

  onFenSubmit(event: Event, rawFen: string): void {
    event.preventDefault();
    this.fenApplied.emit(rawFen);
  }

  onPgnSubmit(event: Event, rawPgn: string): void {
    event.preventDefault();
    this.pgnApplied.emit(rawPgn);
  }

  onBestMoveArrowChange(event: Event): void {
    this.bestMoveArrowToggled.emit((event.target as HTMLInputElement).checked);
  }

  onHideEvalBarChange(event: Event): void {
    const shouldHide = (event.target as HTMLInputElement).checked;
    const isHidden = !this.showEvalBar;

    if (shouldHide !== isHidden) {
      this.toggleEvalBar.emit();
    }
  }

  moveRows(): MoveRow[] {
    const rows: MoveRow[] = [];

    for (let index = 0; index < this.moves.length; index += 2) {
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: {
          index,
          text: this.moves[index],
        },
        black:
          index + 1 < this.moves.length
            ? {
                index: index + 1,
                text: this.moves[index + 1],
              }
            : null,
      });
    }

    return rows;
  }

  isMovePlayed(index: number): boolean {
    return index < this.moveCursor;
  }

  isMoveActive(index: number): boolean {
    return index + 1 === this.moveCursor;
  }

  private formatScore(score: EngineScore): string {
    if (score.type === 'mate') {
      return `M${score.value}`;
    }

    const pawns = score.value / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
  }
}
