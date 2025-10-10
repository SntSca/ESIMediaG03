import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserDto } from '../models/user.dto';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  step: 'login' | 'mfa' | 'captcha' | 'done' = 'login';
  okMsg = '';
  errorMsg = '';
  loading = false;
  mfaCode = '';
  captchaResponse = '';

  constructor(private auth: AuthService, private router: Router) {}

  // =========================
  // LOGIN PRINCIPAL
  // =========================
  login() {
    this.errorMsg = '';
    this.loading = true;
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.loading = false;

        // Usuario con MFA
        if (res.step === 'mfa') {
          this.step = 'mfa';
          return;
        }

        // Usuario con captcha
        if (res.step === 'captcha') {
          this.step = 'captcha';
          return;
        }

        // Login exitoso
        if (res.user) {
          this.finalizeLogin(res.user);
          return;
        }

        this.errorMsg = 'No se pudo iniciar sesión. Intenta nuevamente.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Error al iniciar sesión.';
      }
    });
  }

  // =========================
  // VERIFICAR MFA
  // =========================
  verifyMfa() {
    if (!this.mfaCode) return;

    this.loading = true;
    this.auth.verifyMfa({ code: this.mfaCode }).subscribe({
      next: (res) => {
        this.loading = false;

        if (res?.ok || res?.status === 'OK') {
          this.finalizeLogin(); // <--- recupera perfil y redirige
          return;
        }

        this.errorMsg = 'Código MFA incorrecto.';
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Error al verificar el código MFA.';
      }
    });
  }

  // =========================
  // VERIFICAR CAPTCHA
  // =========================
  verifyCaptcha() {
    if (!this.captchaResponse) return;

    this.loading = true;
    this.auth.verifyCaptcha({ response: this.captchaResponse }).subscribe({
      next: (res) => {
        this.loading = false;

        if (res?.status === 'OK') {
          this.finalizeLogin(); // <--- recupera perfil y redirige
          return;
        }

        this.errorMsg = 'Captcha incorrecto.';
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Error al verificar captcha.';
      }
    });
  }

  // =========================
  // FUNCIONES AUXILIARES
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
    this.router.navigate(['/auth/login']);
  }

  private finalizeLogin(userMaybe?: Partial<UserDto>) {
    const proceed = (u: UserDto) => {
      this.okMsg = `Bienvenido, ${u?.nombre ?? u?.email ?? 'usuario'}`;
      this.auth.saveSession(u);
      this.step = 'done';
      this.navigateByRole(u?.role as any);
    };

    if (userMaybe?.role) {
      proceed(userMaybe as UserDto);
      return;
    }

    this.loading = true;
    this.auth.me().subscribe({
      next: (u) => {
        this.loading = false;
        proceed(u);
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'No se pudo recuperar el perfil. Inicia sesión de nuevo.';
        this.router.navigate(['/auth/login']);
      }
    });
  }
}
