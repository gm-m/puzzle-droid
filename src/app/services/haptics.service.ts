import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Tiny wrapper around Capacitor Haptics; no-ops off native platforms. */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly enabled = Capacitor.isNativePlatform();

  tap(): void {
    if (this.enabled) {
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    }
  }

  success(): void {
    if (this.enabled) {
      void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    }
  }

  error(): void {
    if (this.enabled) {
      void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    }
  }
}
