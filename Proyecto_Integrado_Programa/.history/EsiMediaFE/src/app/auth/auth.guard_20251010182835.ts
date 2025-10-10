import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { UserDto } from './models';

type Role = UserDto['role']; // 'USUARIO' | 'GESTOR_CONTENIDO' | 'ADMINISTRADOR'

// Mapea el rol a su home
function roleHome(role: Role): string {
  switch (role) {
    case 'ADMINISTRADOR':     return '/admin';
    case 'GESTOR_CONTENIDO':  return '/gestor';
    case 'USUARIO':           return '/usuario';
    default:                  return '/auth/login';
  }
}

// Fallback por si el AuthService no expone getCurrentUser()
function getUserFromLocalStorage(): UserDto | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) as UserDto : null;
  } catch {
    return null;
  }
}
export function roleGuard(allowed: Role[]): CanActivateFn {
  return (): boolean | UrlTree => {
    const router = inject(Router);
    const auth   = inject(AuthService);

    const user = auth.getCurrentUser?.() ?? getUserFromLocalStorage();
    if (!user) {
      return router.createUrlTree(['/auth/login']);
    }
    if (allowed.includes(user.role)) return true;

    return router.createUrlTree([roleHome(user.role)]);
  };
}
