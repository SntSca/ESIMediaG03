import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.getCurrentUser?.() ?? getUserFromLocalStorage();

  // Si hay usuario logueado → permitir acceso
  if (user) return true;
 
  router.navigateByUrl('/auth/login', { replaceUrl: true });
  return false;
};

function getUserFromLocalStorage() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
