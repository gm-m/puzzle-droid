import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { EngineLine, EngineScore } from '../../models/engine.models';

export interface LineMoveSelection {
  line: EngineLine;
  moveIndex: number;
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
  @Input() depth = 12;
  @Input() multiPv = 1;
  @Input() showEvalBar = true;
  @Input() lines: EngineLine[] = [];
  @Input() canGoBack = false;
  @Input() canGoForward = false;
  @Input() moveCursorLabel = '0/0';
  @Input() fenInputValue = '';
  @Input() fenFeedback = '';

  isSettingsOpen = false;

  @Output() readonly analyze = new EventEmitter<void>();
  @Output() readonly reset = new EventEmitter<void>();
  @Output() readonly depthChanged = new EventEmitter<number>();
  @Output() readonly multiPvChanged = new EventEmitter<number>();
  @Output() readonly toggleEvalBar = new EventEmitter<void>();
  @Output() readonly previousMove = new EventEmitter<void>();
  @Output() readonly nextMove = new EventEmitter<void>();
  @Output() readonly lineSelected = new EventEmitter<LineMoveSelection>();
  @Output() readonly fenApplied = new EventEmitter<string>();

  toggleSettings(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
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

  lineHeader(line: EngineLine): string {
    return `${this.formatScore(line.score)} | d${line.depth}`;
  }

  selectLineMove(line: EngineLine, moveIndex: number): void {
    this.lineSelected.emit({ line, moveIndex });
  }

  onFenSubmit(event: Event, rawFen: string): void {
    event.preventDefault();
    this.fenApplied.emit(rawFen);
  }

  private formatScore(score: EngineScore): string {
    if (score.type === 'mate') {
      return `M${score.value}`;
    }

    const pawns = score.value / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
  }
}
