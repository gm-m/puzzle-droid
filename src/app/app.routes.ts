import { Routes } from '@angular/router';
import { ChessWorkspaceComponent } from './components/test/test';
import { WoodpeckerDashboardComponent } from './components/woodpecker-dashboard/woodpecker-dashboard';
import { PuzzleRushComponent } from './components/puzzle-rush/puzzle-rush';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'analysis',
  },
  {
    path: 'woodpecker-dashboard/:pgnId',
    component: WoodpeckerDashboardComponent,
  },
  {
    path: 'woodpecker-dashboard',
    component: WoodpeckerDashboardComponent,
  },
  {
    path: 'rush',
    component: PuzzleRushComponent,
  },
  {
    path: ':view',
    component: ChessWorkspaceComponent,
  },
  {
    path: '**',
    redirectTo: 'analysis',
  },
];
