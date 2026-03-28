import { Routes } from '@angular/router';
import { ChessWorkspaceComponent } from './components/test/test';
import { WoodpeckerDashboardComponent } from './components/woodpecker-dashboard/woodpecker-dashboard';

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
    path: ':view',
    component: ChessWorkspaceComponent,
  },
  {
    path: '**',
    redirectTo: 'analysis',
  },
];
