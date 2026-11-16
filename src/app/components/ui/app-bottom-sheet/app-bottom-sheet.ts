import { ChangeDetectionStrategy, Component, ElementRef, OnChanges, SimpleChanges, ViewChild, input, output } from '@angular/core';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  templateUrl: './app-bottom-sheet.html',
  styleUrl: './app-bottom-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppBottomSheetComponent implements OnChanges {
  private static nextId = 0;

  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();
  readonly titleId = `app-sheet-title-${AppBottomSheetComponent.nextId++}`;

  @ViewChild('sheet') private sheet?: ElementRef<HTMLElement>;
  private trigger: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open()) {
      this.trigger = document.activeElement as HTMLElement | null;
      // Focus the dialog itself unless a control asks for it: focusing an input would pop up the mobile keyboard.
      setTimeout(() => {
        const sheet = this.sheet?.nativeElement;
        (sheet?.querySelector<HTMLElement>('[autofocus]') ?? sheet)?.focus();
      });
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
    if (event.key !== 'Tab' || !this.sheet) return;

    const focusable = Array.from(
      this.sheet.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
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
