import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';
import { map, Observable } from 'rxjs';
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

  login(body: LoginRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/login`, body, { observe: 'response' })
      .pipe(
        map(resp => resp.body!),
        catchError((err: HttpErrorResponse) => {
          if(err.status === 429) { // demasiados intentos
            return of({
              MSG_KEY: err.error?.MSG_KEY,
              RETRY_AFTER_SEC_KEY: err.error?.RETRY_AFTER_SEC_KEY
            });
          }
          if(err.status === 401) { // credenciales incorrectas
            return of({
              MSG_KEY: err.error?.MSG_KEY,
              ATTEMPTS_LEFT_KEY: err.error?.ATTEMPTS_LEFT_KEY
            });
          }
          if(err.status === 403) { // usuario bloqueado
            return of({ MSG_KEY: err.error?.MSG_KEY });
          }
          return throwError(() => err);
        })
      );
  }


  verifyMfa(body: MfaVerifyRequest): Observable<SimpleStatus> {
    return this.http.post<SimpleStatus>(`${this.base}/mfa/verify`, body);
  }

  verifyCaptcha(body: CaptchaVerifyRequest): Observable<SimpleStatus> {
    return this.http.post<SimpleStatus>(`${this.base}/mfa3/verify`, body);
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
