import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';
import { Observable, of, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import {
  BackendLoginResponse,
  LoginRequest,
  UserDto,
  MfaVerifyRequest,
  CaptchaVerifyRequest,
  SimpleStatus,
} from './models';

export interface FriendlyError {
  message: string;
  remainingAttempts?: number | null;
  retryAfterSeconds?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/auth`;

  /**
   * Login y devuelve el usuario completo.
   */
  login(body: LoginRequest): Observable<UserDto> {
    return this.http.post<BackendLoginResponse>(`${this.base}/login`, body).pipe(
      switchMap((res) => {
        // Si hay usuario directo, lo devolvemos
        if (res.user) {
          this.saveSession(res.user);
          return of(res.user);
        }

        // Si necesita MFA o Captcha, no podemos devolver el usuario todavía
        if (res.needMfa || res.needMfa3) {
          return throwError(() => ({
            message: 'Se requiere MFA o Captcha',
            data: res,
          }));
        }

        return throwError(() => ({
          message: 'Login fallido sin usuario',
          data: res,
        }));
      }),
      catchError((err) => throwError(() => err))
    );
  }

  verifyMfa(body: MfaVerifyRequest): Observable<UserDto> {
    return this.http.post<SimpleStatus>(`${this.base}/mfa/verify`, body).pipe(
      switchMap((r) => {
        if (r.ok || r.status === 'OK') {
          return this.me().pipe(
            switchMap((user) => {
              this.saveSession(user);
              return of(user);
            })
          );
        }
        return throwError(() => ({
          message: 'No se pudo verificar el segundo factor',
          data: r,
        }));
      })
    );
  }

  verifyCaptcha(body: CaptchaVerifyRequest): Observable<SimpleStatus> {
    return this.http.post<SimpleStatus>(`${this.base}/mfa3/verify`, body);
  }

  me(): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.base}/me`);
  }

  saveSession(user: UserDto) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  getCurrentUser(): UserDto | null {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserDto) : null;
  }

  logout() {
    localStorage.removeItem('user');
  }
}

