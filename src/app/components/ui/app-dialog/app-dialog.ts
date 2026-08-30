import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, output } from '@angular/core';
import { AppIconComponent } from '../app-icon/app-icon';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [AppIconComponent],
  templateUrl: './app-dialog.html',
  styleUrl: './app-dialog.scss',
})
export class AppDialogComponent implements OnChanges {
  private static nextId = 0;

  @Input() open = false;
  @Input() title = '';
  readonly closed = output<void>();
  readonly titleId = `app-dialog-title-${AppDialogComponent.nextId++}`;

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  private trigger: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      this.trigger = document.activeElement as HTMLElement | null;
      setTimeout(() => this.dialog?.nativeElement.querySelector<HTMLElement>('[autofocus], button, input, select, textarea')?.focus());
    } else if (!changes['open'].firstChange) {
      const trigger = this.trigger;
      this.trigger = null;
      setTimeout(() => trigger?.focus());
    }
  }

  requestClose(): void {
    this.closed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }
    if (event.key !== 'Tab' || !this.dialog) return;

    const focusable = Array.from(
      this.dialog.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
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
}
