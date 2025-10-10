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
    return this.http.post<BackendLoginResponse>(`${this.base}/login`, body);
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
