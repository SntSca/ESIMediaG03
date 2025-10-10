import { inject, Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
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

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const user = this.auth.getCurrentUser();
    if (!user) {
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
    }

    const allowed: Role[] | undefined = route.data?.['roles'];
    if (!allowed || allowed.length === 0 || allowed.includes(user.role)) {
      return true;
    }
    return this.router.createUrlTree([roleHome(user.role)]);
  }
}
