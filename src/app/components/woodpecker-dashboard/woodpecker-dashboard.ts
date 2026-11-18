import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
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
  readonly tabs = [
    { id: 'overview', label: 'Panoramica' },
    { id: 'review', label: 'Ripasso' },
    { id: 'cycles', label: 'Cicli' },
  ] as const;
  readonly activeTab = signal<(typeof this.tabs)[number]['id']>('overview');
  readonly trendScope = signal<'pgn' | 'global'>('pgn');
  readonly statuses = [
    { id: 'unseen', label: 'Mai visto' },
    { id: 'solved', label: 'Risolto' },
    { id: 'slow', label: 'Lento' },
    { id: 'failed', label: 'Errato' },
  ] as const;
  readonly trend = computed(() => {
    const vm = this.data();
    const points = this.trendScope() === 'pgn' ? vm?.pgnImprovement : vm?.globalImprovement;
    const byDay = new Map(points?.map((point) => [point.label, point]));
    const today = new Date();

    return Array.from({ length: 14 }, (_, index): ImprovementPoint => {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() - (13 - index));
      const label = day.toISOString().slice(0, 10);
      return byDay.get(label) ?? { label, attempts: 0, accuracy: 0 };
    });
  });

  private readonly trendDateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

  private routeSub: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly analytics: WoodpeckerAnalyticsService,
  ) {}

  ngOnInit(): void {
    this.availablePgns.set(this.analytics.getAvailablePgns());
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.activeTab.set('overview');
      this.trendScope.set('pgn');
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

  onTabKeydown(event: KeyboardEvent, index: number, tabList: HTMLElement): void {
    const last = this.tabs.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.activeTab.set(this.tabs[next].id);
    tabList.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
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

  trendDay(label: string): string {
    return this.trendDateFormatter.format(new Date(label));
  }

  trendTitle(point: ImprovementPoint): string {
    const day = this.trendDay(point.label);
    return point.attempts ? `${day} · ${point.accuracy}% · Tentativi ${point.attempts}` : `${day} · Nessun tentativo`;
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
