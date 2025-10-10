import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BackendLoginResponse, MfaMethod, UserDto } from './models';

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
  private readonly router = inject(Router);

  loading = false;
  errorMsg = '';
  okMsg = '';
  showPwd = false;

  step: Step = 'login';

  mfaToken: string | null = null;
  mfaMethod: MfaMethod = null;
  captchaToken: string | null = null;
  captchaImage: string | null = null;

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

  submit() {
    if (this.form.invalid || this.loading || this.retryAfterSeconds !== null) return;

    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';
    this.remainingAttempts = null;

    this.auth.login(this.form.value as any).subscribe({
      next: (res: BackendLoginResponse) => {
        this.loading = false;

        // 3er factor (captcha) requerido
        if (res.needMfa3) {
          this.captchaToken = res.captchaToken ?? null;
          this.captchaImage = res.captchaImage ?? null;
          this.step = 'captcha';
          return;
        }

        // 2FA requerido
        if (res.mfaMethod && res.mfaMethod !== 'NONE') {
          this.mfaMethod = res.mfaMethod;
          this.mfaToken = res.mfaToken ?? null;
          this.step = 'mfa';
          return;
        }

        // Login completo con usuario ya disponible
        if (res.user) {
          this.finalizeLogin(res.user);
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

        // Si ahora pide captcha
        if (r?.needMfa3) {
          this.captchaToken = r.captchaToken ?? null;
          this.captchaImage = r.captchaImage ?? null;
          this.step = 'captcha';
          return;
        }

        // 2FA OK → finalizar login (si no viene user, hará /me)
        if (r?.ok === true || r?.status === 'OK') {
          this.finalizeLogin(); // intentará recuperar el usuario con /me
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

        // Captcha OK → finalizar login (si no viene user, hará /me)
        if (r?.status === 'OK') {
          this.finalizeLogin();
          return;
        }

        // Requiere nuevo captcha
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

  // =========================
  // Helpers de UX/Errores
  // =========================

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

  // =========================
  // Nuevo: finalización y routing por rol
  // =========================

  private navigateByRole(role: string | undefined | null) {
    const r = (role ?? '').toUpperCase();
    if (r === 'ADMINISTRADOR') {
      this.router.navigate(['/admin']);
      return;
    }
    if (r === 'GESTOR DE CONTENIDO') {
      this.router.navigate(['/gestor']);
      return;
    }
    if (r === 'USUARIO') {
      this.router.navigate(['/usuario']);
      return;
    }
    // Fallback seguro
    this.router.navigate(['/auth/login']);
  }

  /**
   * Finaliza el login:
   *  - Si ya tienes user -> guarda sesión y redirige
   *  - Si no tienes user -> consulta perfil al backend (me()) y luego guarda y redirige
   */
    private finalizeLogin(userMaybe?: Partial<UserDto>) {
    const proceed = (u: UserDto) => {
      this.okMsg = `Bienvenido, ${u?.nombre ?? u?.email ?? 'usuario'}`;
      this.auth.saveSession(u); // ⚠️ importante guardar token aquí
      this.step = 'done';
      this.navigateByRole(u?.role as any);
    };

    // Si ya tenemos user con token, procede directamente
    if (userMaybe?.role && userMaybe?.token) {
      this.auth.saveSession(userMaybe as UserDto);
      proceed(userMaybe as UserDto);
      return;
    }

    // Si no tenemos user, necesitamos pedir /me
    this.loading = true;
    this.auth.me().subscribe({
      next: (u) => { 
        this.loading = false; 
        proceed(u); 
      },
      error: (err) => {
        console.error('Error en /me', err);
        this.loading = false;
        this.errorMsg = 'No se pudo recuperar el perfil. Inicia sesión de nuevo.';
        this.router.navigate(['/auth/login']);
      }
    });
  }

}
