import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';
import {
  BackendLoginResponse,
  LoginRequest,
  UserDto,
  MfaVerifyRequest,
  CaptchaVerifyRequest,
} from './models';

export interface FriendlyError {
  message: string;
  remainingAttempts?: number | null;
  retryAfterSeconds?: number | null;
}

/**
 * Sesión por pestaña (sessionStorage).
 * Cualquier pestaña nueva requerirá login de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/auth`;

  private readonly USER_KEY = 'user'; // clave guardada SIEMPRE en sessionStorage

  // === API ===
  login(body: LoginRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/login`, body);
  }

  verifyMfa(body: MfaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/mfa/verify`, body);
  }

  verifyCaptcha(body: CaptchaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/mfa3/verify`, body);
  }

  // === Sesión (por pestaña) ===
  saveSession(user: UserDto): void {
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getCurrentUser(): UserDto | null {
    try {
      const raw = sessionStorage.getItem(this.USER_KEY);
      return raw ? (JSON.parse(raw) as UserDto) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  logout(): void {
    sessionStorage.removeItem(this.USER_KEY);
  }
}
