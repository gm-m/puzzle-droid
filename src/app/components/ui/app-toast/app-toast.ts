import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppIconComponent } from '../app-icon/app-icon';

export type AppToastTone = 'success' | 'info' | 'error';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [AppIconComponent],
  templateUrl: './app-toast.html',
  styleUrl: './app-toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppToastComponent {
  readonly message = input.required<string>();
  readonly tone = input<AppToastTone>('info');
  readonly closed = output<void>();
}
