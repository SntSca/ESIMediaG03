import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { Registro } from './registro/registro';

export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'register', component: Registro }
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' }
];
