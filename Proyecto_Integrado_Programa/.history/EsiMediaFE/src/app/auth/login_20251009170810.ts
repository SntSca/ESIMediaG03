import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BackendLoginResponse, MfaMethod } from './models';

type Step = 'login' | 'mfa' | 'captcha' | 'done';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  loading = false;
  errorMsg = '';
  okMsg = '';
  showPwd = false;

  step: Step = 'login';

  mfaToken: string | null = null;
  mfaMethod: MfaMethod = null;

  // Captcha chain
  captchaToken: string | null = null;
  captchaImage: string | null = null;
  captchaIndex = 0;                 // 1-based for UX
  captchaTotal: number | null = null;

  remainingAttempts: number | null = null;
  retryAfterSeconds: number | null = null;
  countdown = 0;
  private timer: any | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  mfaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(4)]],
  });

  captchaForm = this.fb.group({
    answer: ['', [Validators.required]],
  });

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // ---------- Helpers Captcha (múltiples) ----------

  /** Inicia el flujo de captchas en cadena con datos del backend */
  private beginCaptchaFlow(payload: any) {
    this.step = 'captcha';
    this.captchaIndex = 1;

    // Intenta detectar total desde varios nombres comunes:
    const total =
      payload?.captchaTotal ??
      payload?.total ??
      (Number.isFinite(payload?.captchaRemaining) ? (payload.captchaRemaining as number) + 1 : null) ??
      (Number.isFinite(payload?.remaining) ? (payload.remaining as number) + 1 : null) ??
      null;

    this.captchaTotal = total;

    // Token/imagen iniciales (soporta varios nombres por robustez)
    this.captchaToken = payload?.captchaToken ?? payload?.token ?? null;
    this.captchaImage = payload?.captchaImage ?? payload?.image ?? null;

    // Mensaje de progreso
    if (this.captchaToken && this.captchaImage) {
      this.okMsg = this.captchaTotal
        ? `Captcha ${this.captchaIndex} de ${this.captchaTotal}`
        : `Captcha ${this.captchaIndex}`;
      this.errorMsg = '';
    } else {
      this.errorMsg = 'No se pudo iniciar el reto captcha.';
    }
  }

  /** Avanza a siguiente captcha: aumenta índice, setea nuevo token/imagen */
  private setNextCaptcha(payload: any) {
    this.captchaIndex += 1;

    // Si el backend envía 'remaining' o 'captchaRemaining', recalcular total o mostrar progreso
    if (Number.isFinite(payload?.captchaRemaining)) {
      this.captchaTotal = this.captchaIndex + (payload.captchaRemaining as number);
    } else if (Number.isFinite(payload?.remaining)) {
      this.captchaTotal = this.captchaIndex + (payload.remaining as number);
    }

    // Acepta nombres alternativos
    this.captchaToken = payload?.nextCaptchaToken ?? payload?.captchaToken ?? payload?.token ?? null;
    this.captchaImage = payload?.nextCaptchaImage ?? payload?.captchaImage ?? payload?.image ?? null;

    this.captchaForm.reset();

    // Mensaje de progreso
    if (this.captchaToken && this.captchaImage) {
      this.okMsg = this.captchaTotal
        ? `Captcha ${this.captchaIndex} de ${this.captchaTotal}`
        : `Captcha ${this.captchaIndex}`;
      this.errorMsg = '';
      this.step = 'captcha';
    } else {
      // Si no se proporcionó el siguiente captcha, terminar por seguridad
      this.okMsg = 'Captcha verificado. No hay más retos.';
      this.step = 'done';
    }
  }

  /** Determina si la respuesta del backend implica "hay otro captcha más" */
  private hasMoreCaptchas(r: any): boolean {
    // Criterios flexibles:
    // 1) nextCaptchaToken / nextCaptchaImage explícitos
    if (r?.nextCaptchaToken || r?.nextCaptchaImage) return true;

    // 2) needMfa3 con nuevos token/imagen (aunque status sea OK)
    if (r?.needMfa3 && (r?.captchaToken || r?.captchaImage || r?.token || r?.image)) return true;

    // 3) remaining contadores
    if (Number.isFinite(r?.captchaRemaining) && (r.captchaRemaining as number) > 0) return true;
    if (Number.isFinite(r?.remaining) && (r.remaining as number) > 0) return true;

    return false;
    }

  // ---------- Flujos ----------

  submit() {
    if (this.form.invalid || this.loading || this.retryAfterSeconds !== null) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';
    this.remainingAttempts = null;

    this.auth.login(this.form.value as any).subscribe({
      next: (res: BackendLoginResponse) => {
        this.loading = false;

        // Si desde login ya pide captcha(s)
        if (res.needMfa3) {
          this.beginCaptchaFlow(res);
          return;
        }

        // 2FA
        if (res.mfaMethod && res.mfaMethod !== 'NONE') {
          this.mfaMethod = res.mfaMethod;
          this.mfaToken = res.mfaToken ?? null;
          this.step = 'mfa';
          return;
        }

        // Login completo
        if (res.user) {
          this.okMsg = `Bienvenido, ${res.user.nombre ?? res.user.email}`;
          this.auth.saveSession(res.user);
          this.step = 'done';
          return;
        }

        this.errorMsg = 'Problema al intentar acceder a la plataforma, por favor comuníquese con un administrador.';
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.handleFriendlyError(err);
      },
    });
  }

  submitMfa() {
    if (!this.mfaToken || this.mfaForm.invalid || this.loading) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';

    const code = this.mfaForm.value.code ?? '';

    this.auth.verifyMfa({ mfaToken: this.mfaToken, code }).subscribe({
      next: (r: any) => {
        this.loading = false;

        // Tras MFA, si hay cadena de captchas, iniciarla
        if (r?.needMfa3) {
          this.beginCaptchaFlow(r);
          return;
        }

        // Si MFA queda OK y no hay más pasos
        if (r?.ok === true || r?.status === 'OK') {
          this.okMsg = 'Segundo factor verificado correctamente.';
          this.step = 'done';
          return;
        }

        this.errorMsg = 'No se pudo verificar el segundo factor.';
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'No se pudo verificar el segundo factor.';
      },
    });
  }

  submitCaptcha() {
    if (!this.captchaToken || this.captchaForm.invalid || this.loading) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';

    const answer = (this.captchaForm.value.answer ?? '').toString().trim();

    this.auth.verifyCaptcha({ captchaToken: this.captchaToken, answer }).subscribe({
      next: (r: any) => {
        this.loading = false;

        // Caso A: verificación correcta
        if (r?.status === 'OK' || r?.ok === true) {
          // ¿Hay más captchas encadenados?
          if (this.hasMoreCaptchas(r)) {
            this.setNextCaptcha(r);
            return;
          }
          // No hay más captchas → finalizar
          this.okMsg = 'Captcha(s) verificado(s) correctamente.';
          this.step = 'done';
          return;
        }

        // Caso B: respuesta indica que sigamos con otro captcha (algunos backends devuelven needMfa3 incluso tras éxito)
        if (r?.needMfa3 && (r?.captchaToken || r?.captchaImage || r?.nextCaptchaToken || r?.nextCaptchaImage)) {
          this.setNextCaptcha(r);
          return;
        }

        // Caso C: incorrecto → regenerar
        if (r?.needMfa3 && r?.captchaToken && r?.captchaImage) {
          this.captchaToken = r.captchaToken;
          this.captchaImage = r.captchaImage;
          this.captchaForm.reset();
          this.errorMsg = 'Respuesta incorrecta. Se ha generado un nuevo captcha.';
          return;
        }

        this.errorMsg = 'No se pudo verificar el captcha.';
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;

        const body = err?.error as any;

        // Error devolviendo un nuevo captcha (fallo de verificación)
        if (body?.needMfa3 && body?.captchaToken && body?.captchaImage) {
          this.captchaToken = body.captchaToken;
          this.captchaImage = body.captchaImage;
          this.captchaForm.reset();
          this.errorMsg = 'Respuesta incorrecta. Inténtalo de nuevo con el nuevo captcha.';
          return;
        }

        this.errorMsg = 'No se pudo verificar el captcha.';
      },
    });
  }

  // ---------- Errores / UX ----------

  private handleFriendlyError(err: HttpErrorResponse) {
    this.errorMsg = 'Credenciales incorrectas.';

    const data = (err?.error ?? {}) as {
      message?: string;
      attemptsLeft?: number;
      retryAfterSec?: number;
    };

    if (typeof data.message === 'string' && data.message.trim()) {
      this.errorMsg = data.message;
    }

    if (Number.isFinite(data.attemptsLeft as number)) {
      this.remainingAttempts = Number(data.attemptsLeft);
    } else {
      this.remainingAttempts = null;
    }

    if (Number.isFinite(data.retryAfterSec as number) && (data.retryAfterSec as number) > 0) {
      const seconds = Number(data.retryAfterSec);
      this.startCountdown(seconds);
    }
  }

  private startCountdown(totalSeconds: number) {
    this.clearTimer();
    this.retryAfterSeconds = totalSeconds;
    this.countdown = totalSeconds;

    this.errorMsg = '';

    this.timer = setInterval(() => {
      this.countdown = Math.max(0, this.countdown - 1);
      if (this.countdown === 0) {
        this.clearTimer();
        this.retryAfterSeconds = null;
        this.remainingAttempts = null;
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
