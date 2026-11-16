import { Injectable, signal } from '@angular/core';

/**
 * Shared shell state between the routed views and the app-level tab bar.
 * Views that take over the whole screen (e.g. the PGN detail with its own
 * bottom CTA) hide the tab bar; everything else shows it.
 */
@Injectable({ providedIn: 'root' })
export class ShellLayoutService {
  /** When false the bottom tab bar is hidden for the current screen. */
  readonly tabBarVisible = signal(true);
}
