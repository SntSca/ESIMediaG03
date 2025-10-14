import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { UsersService } from '../users';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class Registro {
  nombre = '';
  apellidos = '';
  email = '';
  alias = '';
  fechaNac = '';
  pwd = '';
  pwd2 = '';
  vip = false;
  role: 'usuario' | 'Gestor de Contenido' | 'Administrador' = 'usuario';
  termsAccepted = false;
  foto: File | null = null;
  showPwd = false;
  showPwd2 = false;
  isLoading = false;
  private lastSubmitAt = 0;
  mensajeError = '';
  pwnedCount: number | null = null;
  pwnedCheckedFor: string = '';
  isCheckingPwned = false;
  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  constructor(private usersService: UsersService) {}

  // =================== PASSWORD HELPERS =====================
  get pwdIssues(): string[] {
    const issues: string[] = [];
    if (this.pwd.length < 8) issues.push('Al menos 8 caracteres');
    if (!/[A-Z]/.test(this.pwd)) issues.push('Una letra mayúscula');
    if (!/[a-z]/.test(this.pwd)) issues.push('Una letra minúscula');
    if (!/\d/.test(this.pwd)) issues.push('Un número');
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(this.pwd)) issues.push('Un carácter especial');
    return issues;
  }

  get pwdScore(): number {
    let score = 0;
    if (this.pwd.length >= 8) score++;
    if (/[A-Z]/.test(this.pwd)) score++;
    if (/[a-z]/.test(this.pwd)) score++;
    if (/\d/.test(this.pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(this.pwd)) score++;
    return Math.min(4, score);
  }

  get pwdStrengthLabel(): string {
    if (this.pwdScore <= 1) return 'Débil';
    if (this.pwdScore <= 3) return 'Media';
    return 'Fuerte';
  }

  get pwdMismatch(): boolean {
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  get fechaInvalida(): boolean {
    if (!this.fechaNac) return false;
    return new Date(this.fechaNac) > new Date();
  }

  togglePwd() { this.showPwd = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }

  // =================== ALERT HELPER =====================
  private showAlert(title: string, text: string, icon: 'error' | 'info' | 'warning' | 'success') {
    void Swal.fire({ title, text, icon, confirmButtonText: 'Cerrar' });
  }

  private handleFormError(message: string) {
    const firstInvalid = document.querySelector('.input.input-error') as HTMLElement | null;
    firstInvalid?.focus();
    this.showAlert('Revisa el formulario', message, 'error');
  }

  private async sha1Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  private async checkPasswordPwned(password: string): Promise<number> {
    if (!password) return 0;
    const fullHash = await this.sha1Hex(password);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) throw new Error('Fallo consultando diccionario online');
    const lines = (await res.text()).split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix?.toUpperCase() === suffix) return parseInt(countStr.replace(/\D/g, ''), 10) || 0;
    }
    return 0;
  }

  private async ensurePwnedChecked(): Promise<void> {
    if (!this.pwd || this.pwd === this.pwnedCheckedFor) return;
    this.isCheckingPwned = true;
    try {
      this.pwnedCount = await this.checkPasswordPwned(this.pwd);
      this.pwnedCheckedFor = this.pwd;
    } catch {
      this.pwnedCount = null;
      this.pwnedCheckedFor = this.pwd;
    } finally {
      this.isCheckingPwned = false;
    }
  }

  async onPwdChange() {
    this.pwnedCheckedFor = '';
    this.pwnedCount = null;
    await this.ensurePwnedChecked();
  }

  async onSubmit(form: NgForm) {
    const now = Date.now();
    if (now - this.lastSubmitAt < 5000) return this.showAlert('Demasiados intentos', 'Espera unos segundos antes de volver a intentarlo.', 'warning');
    if (!this.termsAccepted) return this.showAlert('Falta aceptación', 'Debes aceptar los Términos y la Política de Privacidad.', 'info');
    if (form.invalid || this.pwdIssues.length > 0 || this.pwdMismatch || this.fechaInvalida) {
      return this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.');
    }

    await this.ensurePwnedChecked();
    if ((this.pwnedCount ?? 0) > 0) {
      return this.showAlert('Contraseña insegura', `Esta contraseña aparece en filtraciones públicas <b>${this.pwnedCount}</b> veces.<br>Por favor, elige otra distinta.`, 'error');
    }

    const datosRegistro = {
      nombre: this.nombre, apellidos: this.apellidos, email: this.email, alias: this.alias,
      fechaNac: this.fechaNac, pwd: this.pwd, pwd2: this.pwd2, vip: this.vip, role: this.role,
      foto: this.foto?.name
    };

    this.isLoading = true;
    this.lastSubmitAt = now;

    this.usersService.registrar(datosRegistro).subscribe({
      next: () => { this.isLoading = false; this.showAlert('¡Éxito!', 'Registro correcto.', 'success'); },
      error: (error) => this.handleHttpError(error)
    });
  }

  private handleHttpError(error: any) {
    this.isLoading = false;
    this.mensajeError = 'Hubo un problema en el registro';
    if (error.error) {
      if (typeof error.error === 'object' && error.error.message) this.mensajeError = error.error.message;
      else if (typeof error.error === 'string') {
        try { const obj = JSON.parse(error.error); if (obj.message) this.mensajeError = obj.message; } catch { this.mensajeError = error.error; }
      }
    }
    this.showAlert('Error', this.mensajeError, 'error');
  }

  onFileChange(event: any) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const error = this.validateFile(file);
    if (error) { this.showAlert(...error); input.value = ''; this.foto = null; return; }
    this.foto = file;
  }

  private validateFile(file: File | null): [string, string, 'error'] | null {
    if (!file) return null;
    if (!file.type.startsWith('image/')) return ['Formato no válido', 'Sube solo imágenes (jpg, png, webp...).', 'error'];
    if (file.size > 2 * 1024 * 1024) return ['Archivo demasiado grande', 'Máximo 2 MB.', 'error'];
    return null;
  }
}
