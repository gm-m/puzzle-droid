import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  HardSetPuzzleSummary,
  ImprovementPoint,
  WoodpeckerCycleSnapshot,
  WoodpeckerDashboardData,
  WoodpeckerPuzzleCycleStatus,
  WoodpeckerPuzzleStatusSummary,
} from '../../models/woodpecker.models';
import { WoodpeckerAnalyticsService } from '../../services/woodpecker-analytics.service';
import { AppIconComponent } from '../ui/app-icon/app-icon';
import { StatusBadgeComponent, type StatusBadgeTone } from '../ui/status-badge/status-badge';
import { EmptyStateComponent } from '../ui/empty-state/empty-state';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-woodpecker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, StatusBadgeComponent, EmptyStateComponent],
  templateUrl: './woodpecker-dashboard.html',
  styleUrl: './woodpecker-dashboard.scss',
})
export class WoodpeckerDashboardComponent implements OnInit, OnDestroy {
  readonly data = signal<WoodpeckerDashboardData | null>(null);
  readonly availablePgns = signal<Array<{ pgnId: string; pgnName: string }>>([]);

  private routeSub: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly analytics: WoodpeckerAnalyticsService,
  ) {}

  ngOnInit(): void {
    this.availablePgns.set(this.analytics.getAvailablePgns());
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const pgnId = params.get('pgnId');
      if (!pgnId) {
        const latest = this.analytics.getLatestPgnId();
        if (latest) {
          void this.router.navigate(['/woodpecker-dashboard', latest], { replaceUrl: true });
          return;
        }

        this.data.set(null);
        return;
      }

      this.data.set(this.analytics.getDashboardData(pgnId));
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.routeSub = null;
  }

  riskClass(risk: 'basso' | 'medio' | 'alto'): string {
    return `risk-${risk}`;
  }

  statusClass(status: WoodpeckerPuzzleCycleStatus): string {
    return `status-${status}`;
  }

  statusLabel(status: WoodpeckerPuzzleCycleStatus): string {
    switch (status) {
      case 'solved':
        return 'Risolto';
      case 'slow':
        return 'Lento';
      case 'failed':
        return 'Sbagliato';
      default:
        return 'Da fare';
    }
  }

  statusTone(status: WoodpeckerPuzzleCycleStatus): StatusBadgeTone {
    switch (status) {
      case 'solved':
        return 'success';
      case 'slow':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  cycleProgressPercent(vm: WoodpeckerDashboardData): number {
    const total = vm.currentCyclePuzzles.length;
    if (total === 0) {
      return 0;
    }

    return Math.round(((vm.currentCycleStatusCounts.solved + vm.currentCycleStatusCounts.slow) / total) * 100);
  }

  deltaClass(value: number, reverse = false): string {
    if (value === 0) {
      return 'delta-neutral';
    }

    const positive = reverse ? value < 0 : value > 0;
    return positive ? 'delta-positive' : 'delta-negative';
  }

  formatDeltaPercent(value: number): string {
    return `${value > 0 ? '+' : ''}${value}%`;
  }

  formatDeltaSeconds(deltaMs: number): string {
    const seconds = deltaMs / 1000;
    return `${seconds > 0 ? '+' : ''}${seconds.toFixed(1)}s`;
  }

  formatDueDate(value: number): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  resumeWoodpecker(vm: WoodpeckerDashboardData): void {
    if (!vm.hasResumeSession || vm.resumePuzzleIndex === null) {
      return;
    }

    void this.router.navigate(['/analysis'], {
      queryParams: {
        resumeWoodpecker: 1,
        pgnId: vm.pgnId,
        puzzleIndex: vm.resumePuzzleIndex,
      },
    });
  }

  openFailedPuzzle(vm: WoodpeckerDashboardData, puzzleIndex: number): void {
    void this.router.navigate(['/analysis'], {
      queryParams: {
        resumeWoodpecker: 1,
        pgnId: vm.pgnId,
        puzzleIndex,
      },
    });
  }

  formatDate(value: number | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  /** Trend labels are ISO days (YYYY-MM-DD): show only the day under each bar. */
  trendDay(label: string): string {
    return label.slice(8, 10) || label;
  }

  trendTitle(point: ImprovementPoint): string {
    const [year, month, day] = point.label.split('-');
    return `${day}/${month}/${year}: ${point.accuracy}% (${point.attempts} tentativi)`;
  }

  trackByCycle(_: number, cycle: WoodpeckerCycleSnapshot): number {
    return cycle.cycle;
  }

  trackByPoint(_: number, point: ImprovementPoint): string {
    return point.label;
  }

  trackByFailedPuzzle(_: number, failed: { puzzleIndex: number }): number {
    return failed.puzzleIndex;
  }

  trackByPuzzleSummary(_: number, puzzle: WoodpeckerPuzzleStatusSummary): number {
    return puzzle.puzzleIndex;
  }

  trackByHardSet(_: number, puzzle: HardSetPuzzleSummary): number {
    return puzzle.puzzleIndex;
  }

  trackByPgn(_: number, pgn: { pgnId: string; pgnName: string }): string {
    return pgn.pgnId;
  }
}
