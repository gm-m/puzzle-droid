import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AppIconName =
  | 'menu'
  | 'settings'
  | 'chevron-up'
  | 'chevron-down'
  | 'shuffle'
  | 'info'
  | 'close'
  | 'first'
  | 'previous'
  | 'next'
  | 'last'
  | 'more'
  | 'bookmark'
  | 'list'
  | 'rotate'
  | 'copy'
  | 'arrow-left'
  | 'play';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './app-icon.html',
  styleUrl: './app-icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppIconComponent {
  readonly name = input.required<AppIconName>();
}
