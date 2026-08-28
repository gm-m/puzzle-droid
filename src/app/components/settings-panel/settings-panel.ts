import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
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
  backupFeedbackKind: 'success' | 'error' | 'info' = 'info';
  isImportingBackup = false;
  isResetConfirmationOpen = false;

  @ViewChild('resetDialog') private resetDialog?: ElementRef<HTMLElement>;
  private resetTrigger: HTMLElement | null = null;

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

  on3dChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateSetting('is3d', checked);
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

  openResetConfirmation(event: Event): void {
    this.resetTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.isResetConfirmationOpen = true;
    setTimeout(() => this.resetDialog?.nativeElement.querySelector<HTMLElement>('[autofocus]')?.focus());
  }

  closeResetConfirmation(): void {
    this.isResetConfirmationOpen = false;
    const trigger = this.resetTrigger;
    this.resetTrigger = null;
    setTimeout(() => trigger?.focus());
  }

  confirmResetSettings(): void {
    this.settingsService.resetToDefault();
    this.closeResetConfirmation();
    this.setBackupFeedback('Impostazioni ripristinate ai valori predefiniti.', 'success');
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
    this.setBackupFeedback('Backup esportato con successo.', 'success');
  }

  async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.isImportingBackup = true;
    this.setBackupFeedback(`Importazione di ${file.name} in corso…`, 'info');
    try {
      const raw = await file.text();
      const result = this.woodpeckerAnalytics.importBackupBundle(raw);
      this.setBackupFeedback(`${file.name}: ${result.message}`, result.ok ? 'success' : 'error');
    } catch {
      this.setBackupFeedback(`${file.name}: impossibile leggere il file selezionato.`, 'error');
    } finally {
      this.isImportingBackup = false;
      input.value = '';
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.isResetConfirmationOpen) {
      event.preventDefault();
      this.closeResetConfirmation();
    }
  }

  onDialogKeydown(event: KeyboardEvent, dialog: HTMLElement): void {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private setBackupFeedback(message: string, kind: 'success' | 'error' | 'info'): void {
    this.backupFeedback = message;
    this.backupFeedbackKind = kind;
  }
}
