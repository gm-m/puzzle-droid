import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.models';

const SETTINGS_STORAGE_KEY = 'puzzle-droid-settings-v1';

const BOARD_THEME_3D_BY_THEME: Record<AppSettings['boardTheme'], string> = {
  brown: 'Rosewood',
  green: 'Rosewood',
  blue: 'Rosewood',
  grey: 'Rosewood',
};

const PIECE_SET_3D_BY_SET: Record<AppSettings['pieceSet'], string> = {
  cburnett: 'Staunton',
  merida: 'Wood',
  alpha: 'Metal',
  kosal: 'ModernWood',
};

const PIECE_TYPES = ['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn'] as const;
const PIECE_COLORS = ['White', 'Black'] as const;

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly document = inject(DOCUMENT);

  readonly settings = signal<AppSettings>(this.loadSettings());

  constructor() {
    effect(() => {
      const nextSettings = this.settings();
      this.saveSettings(nextSettings);
      this.applyTheme(nextSettings);
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

  private applyTheme(settings: AppSettings): void {
    const body = this.document?.body;
    if (!body) {
      return;
    }

    const baseUrl = new URL('assets/staunton/', this.document.baseURI).toString();
    const board3d = BOARD_THEME_3D_BY_THEME[settings.boardTheme];
    const pieceSet3d = PIECE_SET_3D_BY_SET[settings.pieceSet];

    body.classList.toggle('theme-dark', settings.darkMode);
    body.classList.toggle('is3d', settings.is3d);
    body.dataset['board3d'] = board3d;
    body.dataset['pieceSet3d'] = pieceSet3d;
    body.dataset['boardTheme'] = settings.boardTheme;
    body.style.setProperty('--board-3d-image', `url("${baseUrl}board/${board3d}.png")`);

    for (const color of PIECE_COLORS) {
      for (const type of PIECE_TYPES) {
        const colorKey = color.toLowerCase();
        const typeKey = type.toLowerCase();
        body.style.setProperty(
          `--piece-${colorKey}-${typeKey}-image`,
          `url("${baseUrl}piece/${pieceSet3d}/${color}-${type}.png")`,
        );
      }
    }

    if (pieceSet3d === 'Wood' || pieceSet3d === 'Metal' || pieceSet3d === 'ModernWood') {
      body.style.setProperty(
        '--piece-white-bishop-flipped-image',
        `url("${baseUrl}piece/${pieceSet3d}/White-Bishop-Flipped.png")`,
      );
      body.style.setProperty(
        '--piece-white-knight-flipped-image',
        `url("${baseUrl}piece/${pieceSet3d}/White-Knight-Flipped.png")`,
      );
      body.style.setProperty(
        '--piece-black-bishop-flipped-image',
        `url("${baseUrl}piece/${pieceSet3d}/Black-Bishop-Flipped.png")`,
      );
      body.style.setProperty(
        '--piece-black-knight-flipped-image',
        `url("${baseUrl}piece/${pieceSet3d}/Black-Knight-Flipped.png")`,
      );
    } else {
      body.style.setProperty('--piece-white-bishop-flipped-image', 'var(--piece-white-bishop-image)');
      body.style.setProperty('--piece-white-knight-flipped-image', 'var(--piece-white-knight-image)');
      body.style.setProperty('--piece-black-bishop-flipped-image', 'var(--piece-black-bishop-image)');
      body.style.setProperty('--piece-black-knight-flipped-image', 'var(--piece-black-knight-image)');
    }
  }
}
