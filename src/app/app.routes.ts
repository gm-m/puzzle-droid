import { Routes } from '@angular/router';
import { Test } from './components/test/test';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'analysis',
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
