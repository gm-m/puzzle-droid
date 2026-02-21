import { Component, Input } from '@angular/core';
import type { EngineScore } from '../../models/engine.models';

@Component({
  selector: 'app-eval-bar',
  imports: [],
  templateUrl: './eval-bar.html',
  styleUrl: './eval-bar.scss',
})
export class EvalBarComponent {
  @Input() score: EngineScore | null = null;
  @Input() hidden = false;

  get whitePercent(): number {
    if (!this.score) {
      return 50;
    }

    if (this.score.type === 'mate') {
      return this.score.value > 0 ? 100 : 0;
    }

    const limitedCp = Math.max(-1200, Math.min(1200, this.score.value));
    return 50 + limitedCp / 24;
  }

  get scoreLabel(): string {
    if (!this.score) {
      return '-';
    }

    if (this.score.type === 'mate') {
      return `M${this.score.value}`;
    }

    const pawns = this.score.value / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
  }
}
