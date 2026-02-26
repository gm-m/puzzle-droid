import { Routes } from '@angular/router';
import { Test } from './components/test/test';
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
    component: Test,
  },
  {
    path: '**',
    redirectTo: 'analysis',
  },
];
