import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisPanelComponent } from './analysis-panel';

describe('AnalysisPanelComponent', () => {
  let component: AnalysisPanelComponent;
  let fixture: ComponentFixture<AnalysisPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisPanelComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalysisPanelComponent);
    component = fixture.componentInstance;
    component.libraryGameTitle = 'Partita di test';
    component.showLibraryGamePicker = true;
    fixture.detectChanges();
  });

  it('should render separate engine and move regions', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.analysis-engine-region')).not.toBeNull();
    expect(compiled.querySelector('.analysis-moves-region')).not.toBeNull();
  });

  it('should request the library game picker from its visible action', () => {
    spyOn(component.openLibraryGamePickerRequested, 'emit');
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('.library-game-picker-trigger')?.click();

    expect(component.openLibraryGamePickerRequested.emit).toHaveBeenCalled();
  });

  it('should focus the bookmark form and restore focus when the dialog closes', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector<HTMLButtonElement>('.position-action-button');

    trigger?.click();
    await fixture.whenStable();
    await nextTask();

    const titleInput = compiled.querySelector<HTMLInputElement>('.bookmark-form input');
    expect(document.activeElement).toBe(titleInput);

    compiled.querySelector<HTMLButtonElement>('.bookmark-modal-close')?.click();
    await fixture.whenStable();
    await nextTask();

    expect(document.activeElement).toBe(trigger);
  });

  it('should keep keyboard focus inside the bookmark dialog', async () => {
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('.position-action-button')?.click();
    await fixture.whenStable();
    await nextTask();

    const dialog = compiled.querySelector<HTMLElement>('.bookmark-modal');
    const focusable = dialog?.querySelectorAll<HTMLElement>('button, input, textarea');
    const first = focusable?.item(0);
    const last = focusable?.item((focusable?.length ?? 1) - 1);
    last?.focus();
    last?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(first).toBeDefined();
    expect(document.activeElement).toBe(first!);
  });
});

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
