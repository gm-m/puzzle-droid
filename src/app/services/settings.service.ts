import { Injectable, signal, effect } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.models';

const SETTINGS_STORAGE_KEY = 'puzzle-droid-settings-v1';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  readonly settings = signal<AppSettings>(this.loadSettings());

  constructor() {
    effect(() => {
      this.saveSettings(this.settings());
    });
  }

  updateSettings(partialSettings: Partial<AppSettings>): void {
    this.settings.update(current => ({
      ...current,
      ...partialSettings
    }));
  }

  resetToDefault(): void {
    this.settings.set({ ...DEFAULT_SETTINGS });
  }

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load settings from localStorage', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Could not save settings to localStorage', e);
    }
  }
}
