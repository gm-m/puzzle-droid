import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, PRIMARY_OUTLET, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { WoodpeckerAnalyticsService } from '../../../services/woodpecker-analytics.service';
import { HapticsService } from '../../../services/haptics.service';
import { ShellLayoutService } from '../../../services/shell-layout.service';
import { AppIconComponent } from '../app-icon/app-icon';

/**
 * Bottom navigation bar shared by every screen.
 * Order: Libreria · Analisi · Rush · Woodpecker · Impostazioni.
 * On wide screens it docks to the left as a vertical rail.
 */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [RouterLink, AppIconComponent],
  templateUrl: './app-tab-bar.html',
  styleUrl: './app-tab-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppTabBarComponent implements OnDestroy {
  protected readonly shell = inject(ShellLayoutService);
  private readonly router = inject(Router);
  private readonly analytics = inject(WoodpeckerAnalyticsService);
  private readonly haptics = inject(HapticsService);

  protected readonly woodpeckerPgnId = signal<string | null>(null);
  private readonly activeSection = signal<string | undefined>(undefined);
  private readonly routerSub: Subscription;

  constructor() {
    this.refresh(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.refresh(event.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }

  private refresh(url: string): void {
    const primaryRoute = this.router.parseUrl(url).root.children[PRIMARY_OUTLET];
    this.activeSection.set(primaryRoute?.segments[0]?.path);
    this.woodpeckerPgnId.set(this.analytics.getLatestPgnId());
  }

  protected currentPage(section: string): 'page' | null {
    return this.activeSection() === section ? 'page' : null;
  }

  protected woodpeckerLink(): string[] {
    const pgnId = this.woodpeckerPgnId();
    return pgnId ? ['/woodpecker-dashboard', pgnId] : ['/woodpecker-dashboard'];
  }

  protected onTabTap(): void {
    this.haptics.tap();
  }
}
