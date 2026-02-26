import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { AppSettings } from '../../models/settings.models';
import { WoodpeckerAnalyticsService } from '../../services/woodpecker-analytics.service';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss'
})
export class SettingsPanelComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly woodpeckerAnalytics = inject(WoodpeckerAnalyticsService);
  
  readonly settings = this.settingsService.settings;
  backupFeedback = '';

  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settingsService.updateSettings({ [key]: value });
  }
  
  onThemeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppSettings['boardTheme'];
    this.updateSetting('boardTheme', value);
  }

  onPieceSetChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppSettings['pieceSet'];
    this.updateSetting('pieceSet', value);
  }

  onDarkModeChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateSetting('darkMode', checked);
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

  exportBackup(): void {
    const payload = this.woodpeckerAnalytics.exportBackupBundle();
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `puzzle-droid-backup-${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.backupFeedback = 'Backup esportato con successo.';
  }

  async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const raw = await file.text();
    const result = this.woodpeckerAnalytics.importBackupBundle(raw);
    this.backupFeedback = result.message;
    input.value = '';
  }
}
