import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { UserDto } from './models';

export type Role = UserDto['role'];

function roleHome(role: Role): string {
  switch (role) {
    case 'ADMINISTRADOR':     return '/admin';
    case 'GESTOR_CONTENIDO':  return '/gestor';
    case 'USUARIO':           return '/usuario';
    default:                  return '/auth/login';
  }
}

/** Guard funcional por roles (usa AuthService.getCurrentUser()). */
export function roleGuard(allowed: Role[]): CanActivateFn {
  return (): boolean | UrlTree => {
    const router = inject(Router);
    const auth   = inject(AuthService);

    const user = auth.getCurrentUser();
    if (!user) {
      return router.createUrlTree(['/auth/login']);
    }

    if (!allowed?.length || allowed.includes(user.role)) {
      return true;
    }

    return router.createUrlTree([roleHome(user.role)]);
  };
}
