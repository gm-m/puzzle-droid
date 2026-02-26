import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { AppSettings } from '../../models/settings.models';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss'
})
export class SettingsPanelComponent {
  private readonly settingsService = inject(SettingsService);
  
  readonly settings = this.settingsService.settings;

  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settingsService.updateSettings({ [key]: value });
  }
  
  onThemeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppSettings['boardTheme'];
    this.updateSetting('boardTheme', value);
  }

  onCoordinatesChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateSetting('showCoordinates', checked);
  }

  onHighlightChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateSetting('highlightLastMove', checked);
  }

  resetSettings(): void {
    this.settingsService.resetToDefault();
  }
}
