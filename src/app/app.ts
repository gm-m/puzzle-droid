import { Component, HostBinding, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppTabBarComponent } from './components/ui/app-tab-bar/app-tab-bar';
import { NativeShellService } from './services/native-shell.service';
import { SettingsService } from './services/settings.service';
import { ShellLayoutService } from './services/shell-layout.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppTabBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly shell = inject(ShellLayoutService);

  constructor() {
    // Registers the theme effect and native integrations (back button, status bar).
    inject(SettingsService);
    inject(NativeShellService).init();
  }

  /** Space pages must leave free below / left of the tab bar (0 when hidden). */
  @HostBinding('style.--tabbar-space') get tabbarSpace(): string {
    return this.shell.tabBarVisible() ? '110px' : '0px';
  }

  /** Height of the floating bottom bar measured from the viewport edge (safe area excluded). */
  @HostBinding('style.--tabbar-offset') get tabbarOffset(): string {
    return this.shell.tabBarVisible() ? '82px' : '0px';
  }

  @HostBinding('style.--tabbar-rail-space') get tabbarRailSpace(): string {
    return this.shell.tabBarVisible() ? '102px' : '0px';
  }
}
