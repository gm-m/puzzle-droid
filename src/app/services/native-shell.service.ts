import { Injectable, effect, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SettingsService } from './settings.service';

/**
 * Wires native niceties that cost no plugins:
 * - Android hardware back button: behaves like Escape (sheets/dialogs close
 *   first), then navigates back, then minimizes the app.
 * - Status bar content style follows the app theme.
 */
@Injectable({ providedIn: 'root' })
export class NativeShellService {
  private readonly settings = inject(SettingsService);
  private readonly location = inject(Location);
  private readonly native = Capacitor.isNativePlatform();
  private initialized = false;

  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    // Keep SystemBars in sync with the theme (also harmless on web).
    effect(() => {
      const dark = this.settings.settings().darkMode;
      SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
    });

    if (!this.native) {
      return;
    }

    void App.addListener('backButton', (event) => {
      // Give open dialogs/sheets a chance to close, like a real Escape key.
      // dispatchEvent returns false only when a listener called preventDefault().
      const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
      if (!document.dispatchEvent(escape)) {
        return;
      }

      if (event.canGoBack) {
        this.location.back();
      } else {
        void App.minimizeApp();
      }
    });
  }
}
