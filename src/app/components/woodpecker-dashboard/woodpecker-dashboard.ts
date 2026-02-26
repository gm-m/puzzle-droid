import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ImprovementPoint, WoodpeckerCycleSnapshot, WoodpeckerDashboardData } from '../../models/woodpecker.models';
import { WoodpeckerAnalyticsService } from '../../services/woodpecker-analytics.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-woodpecker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
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

  trackByCycle(_: number, cycle: WoodpeckerCycleSnapshot): number {
    return cycle.cycle;
  }

  trackByPoint(_: number, point: ImprovementPoint): string {
    return point.label;
  }

  trackByFailedPuzzle(_: number, failed: { puzzleIndex: number }): number {
    return failed.puzzleIndex;
  }

  trackByPgn(_: number, pgn: { pgnId: string; pgnName: string }): string {
    return pgn.pgnId;
  }
}
