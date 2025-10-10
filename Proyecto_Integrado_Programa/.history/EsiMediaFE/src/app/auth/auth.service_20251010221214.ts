import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../app.config';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/auth`;

  private readonly USER_KEY = 'user'; // ahora SIEMPRE en sessionStorage

  // ===== API =====
  login(body: LoginRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/login`, body);
  }
  verifyMfa(body: MfaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/mfa/verify`, body);
  }
  verifyCaptcha(body: CaptchaVerifyRequest): Observable<BackendLoginResponse> {
    return this.http.post<BackendLoginResponse>(`${this.base}/mfa3/verify`, body);
  }
 
  saveSession(user: UserDto) {
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getCurrentUser(): UserDto | null {
    const raw = sessionStorage.getItem(this.USER_KEY);
    return raw ? (JSON.parse(raw) as UserDto) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  logout() {
    sessionStorage.removeItem(this.USER_KEY);
  }
}
