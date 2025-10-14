import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
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
  mfaMethod: MfaMethod | null = null;
  captchaToken: string | null = null;
  captchaImage: string | null = null;
  remainingAttempts: number | null = null;
  retryAfterSeconds: number | null = null;
  countdown = 0;
  private timer: any;
  currentUser: UserDto | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  mfaForm = this.fb.group({ code: ['', [Validators.required, Validators.minLength(4)]] });
  captchaForm = this.fb.group({ answer: ['', [Validators.required]] });

  ngOnDestroy(): void { this.clearTimer(); }

  private navigateWithTransition(url: string, user: UserDto) {
    const go = () => this.router.navigateByUrl(url, { replaceUrl: true, state: { user } });
    const anyDoc = document as any;
    anyDoc?.startViewTransition ? anyDoc.startViewTransition(go) : go();
  }

  private redirectByRole(user: UserDto) {
    const map: Record<UserDto['role'], string> = {
      'ADMINISTRADOR': '/admin',
      'USUARIO': '/usuario',
      'GESTOR_CONTENIDO': '/gestor',
    };
    this.navigateWithTransition(map[user.role] ?? '/usuario', user);
  }

  private handleStepResponse(res: BackendLoginResponse, stepType: Step) {
    if (res.needMfa3) {
      this.captchaToken = res.captchaToken ?? null;
      this.captchaImage = res.captchaImage ?? null;
      this.step = 'captcha';
      return true;
    }

    if (res.mfaMethod && res.mfaMethod !== 'NONE') {
      this.mfaMethod = res.mfaMethod;
      this.mfaToken = res.mfaToken ?? null;
      this.step = 'mfa';
      return true;
    }

    if (res.user) {
      this.handleSuccessLogin(res.user, stepType);
      return true;
    }

    return false;
  }

  private handleSuccessLogin(user: UserDto, stepType: Step) {
    const messages: Record<Step, string> = {
      login: `Bienvenido, ${user.nombre ?? user.email}`,
      mfa: 'Segundo factor verificado correctamente.',
      captcha: 'Captcha verificado correctamente.',
      done: ''
    };
    this.okMsg = messages[stepType];
    this.auth.saveSession(user);
    this.currentUser = user;
    this.step = 'done';
    this.redirectByRole(user);
  }

  private handleStepError(err: HttpErrorResponse, stepType: Step) {
    this.loading = false;
    const body = err?.error as BackendLoginResponse;

    if (err.status === 401 && body?.needMfa3 && body?.captchaToken && body?.captchaImage) {
      this.captchaToken = body.captchaToken;
      this.captchaImage = body.captchaImage;

      if (stepType === 'mfa') this.mfaForm.reset();
      if (stepType === 'captcha') this.captchaForm.reset();

      this.step = 'captcha';
      this.errorMsg = stepType === 'mfa' 
        ? 'Código MFA incorrecto. Se ha generado un captcha.'
        : 'Respuesta incorrecta. Inténtalo de nuevo con el nuevo captcha.';
      return;
    }

    this.errorMsg = stepType === 'login' 
      ? 'Credenciales incorrectas.'
      : stepType === 'mfa'
        ? 'No se pudo verificar el segundo factor.'
        : 'No se pudo verificar el captcha.';
  }

  private startRequest(stepType: Step) {
    this.loading = true;
    this.errorMsg = '';
    this.okMsg = '';
  }

  submit() {
    if (this.form.invalid || this.loading || this.retryAfterSeconds !== null) return;
    this.startRequest('login');

    this.auth.login(this.form.value as any).subscribe({
      next: (res) => { this.loading = false; if (!this.handleStepResponse(res, 'login')) this.errorMsg = 'Problema al intentar acceder a la plataforma, por favor comuníquese con un administrador.'; },
      error: (err) => this.handleStepError(err, 'login')
    });
  }

  submitMfa() {
    if (!this.mfaToken || this.mfaForm.invalid || this.loading) return;
    this.startRequest('mfa');

    const code = this.mfaForm.value.code ?? '';
    this.auth.verifyMfa({ mfaToken: this.mfaToken, code }).subscribe({
      next: (res) => { this.loading = false; if (!this.handleStepResponse(res, 'mfa')) this.errorMsg = 'No se pudo verificar el segundo factor.'; },
      error: (err) => this.handleStepError(err, 'mfa')
    });
  }

  submitCaptcha() {
    if (!this.captchaToken || this.captchaForm.invalid || this.loading) return;
    this.startRequest('captcha');

    const answer = (this.captchaForm.value.answer ?? '').toString().trim();
    this.auth.verifyCaptcha({ captchaToken: this.captchaToken, answer }).subscribe({
      next: (res) => { this.loading = false; if (!this.handleStepResponse(res, 'captcha')) this.errorMsg = 'No se pudo verificar el captcha.'; },
      error: (err) => this.handleStepError(err, 'captcha')
    });
  }

  private clearTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  private startCountdown(totalSeconds: number) {
    this.clearTimer();
    this.retryAfterSeconds = totalSeconds;
    this.countdown = totalSeconds;
    this.errorMsg = '';

    this.timer = setInterval(() => {
      this.countdown = Math.max(0, this.countdown - 1);
      if (this.countdown === 0) { this.clearTimer(); this.retryAfterSeconds = null; this.remainingAttempts = null; }
    }, 1000);
  }

  private handleFriendlyError(err: HttpErrorResponse) {
    this.errorMsg = 'Credenciales incorrectas.';
    const data = (err?.error ?? {}) as { message?: string; attemptsLeft?: number; retryAfterSec?: number };
    if (typeof data.message === 'string' && data.message.trim()) this.errorMsg = data.message;
    this.remainingAttempts = Number.isFinite(data.attemptsLeft as number) ? Number(data.attemptsLeft) : null;
    if (Number.isFinite(data.retryAfterSec as number) && data.retryAfterSec > 0) this.startCountdown(Number(data.retryAfterSec));
  }
}
