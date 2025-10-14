import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { UsersService } from '../users';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class Registro implements OnDestroy {
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

  // Foto/Avatar (OBLIGATORIA)
  foto: string | null = null;

  // Gestor de Contenido (OBLIGATORIOS cuando role = Gestor de Contenido)
  descripcion = '';
  especialidad = '';
  tipoContenido: '' | 'Audio' | 'Video' = '';

  showPwd = false;
  showPwd2 = false;
  isLoading = false;
  private lastSubmitAt = 0;
  mensajeError = '';

  // --- Estado Pwned
  pwnedCount: number | null = null;
  pwnedCheckedFor: string = '';
  isCheckingPwned = false;
  private pwnedDebounce: any = null;

  // --- Alias único
  aliasUnique: boolean | null = null;
  aliasCheckedFor = '';
  isCheckingAlias = false;
  private aliasDebounce: any = null;

  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  avatars: string[] = [
    'assets/avatars/avatar1.png',
    'assets/avatars/avatar2.png',
    'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png',
    'assets/avatars/avatar5.png',
    'assets/avatars/avatar6.png'
  ];

  selectedAvatar: string | null = null;
  showAvatarModal = false;

  constructor(private usersService: UsersService) {}

  // ---------- Flags ----------
  get isGestor(): boolean { return this.role === 'Gestor de Contenido'; }
  get hasPwd(): boolean { return this.pwd.trim().length > 0; }

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

  // ---------- Pwned helpers ----------
  get pwnedSeverity(): 'ok' | 'warn' | 'unknown' {
    if (!this.hasPwd) return 'unknown';
    if (this.isCheckingPwned) return 'unknown';
    if (this.pwnedCount === null) return 'unknown';
    return (this.pwnedCount ?? 0) > 0 ? 'warn' : 'ok';
  }

  get pwnedMessage(): string {
    if (!this.hasPwd) return '';
    if (this.isCheckingPwned) return 'Comprobando en filtraciones públicas…';
    if (this.pwnedCount === null) return 'No se pudo verificar ahora. Intenta de nuevo más tarde.';
    if ((this.pwnedCount ?? 0) > 0) return `⚠️ Aparece en filtraciones <b>${this.pwnedCount}</b> veces. Elige otra.`;
    return '✅ No aparece en filtraciones conocidas.';
  }

  // ---------- UI ----------
  togglePwd() { this.showPwd = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }

  // ---------- Alerts / errores ----------
  private showAlert(title: string, text: string, icon: 'error' | 'info' | 'warning' | 'success') {
    void Swal.fire({ title, html: text, icon, confirmButtonText: 'Cerrar' });
  }

  private handleFormError(message: string) {
    const firstInvalid = document.querySelector('.input.input-error') as HTMLElement | null;
    firstInvalid?.focus();
    this.showAlert('Revisa el formulario', message, 'error');
  }

  // ---------- Pwned Passwords ----------
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
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    this.isCheckingPwned = !!this.pwd;
    this.pwnedDebounce = setTimeout(async () => {
      await this.ensurePwnedChecked();
    }, 700);
  }

  // ---------- Alias único ----------
  private async ensureAliasChecked(): Promise<void> {
    const value = this.alias.trim();
    if (!value || value === this.aliasCheckedFor) return;
    this.isCheckingAlias = true;
    try {
      // Ajusta este método a tu UsersService: debe devolver { available: boolean }
      const result = await firstValueFrom(this.usersService.checkAlias(value));
      this.aliasUnique = !!result?.available;
      this.aliasCheckedFor = value;
    } catch {
      this.aliasUnique = null;       // desconocido si falla
      this.aliasCheckedFor = value;
    } finally {
      this.isCheckingAlias = false;
    }
  }

  onAliasChange() {
    this.aliasUnique = null;
    this.aliasCheckedFor = '';
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
    const value = this.alias.trim();
    if (!value) return; // vacío: no comprobar aún
    this.isCheckingAlias = true;
    this.aliasDebounce = setTimeout(async () => {
      await this.ensureAliasChecked();
    }, 600);
  }

  // ---------- Avatares ----------
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }

  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.foto = avatar; // OBLIGATORIA
    this.closeAvatarModal();
  }

  // ---------- Submit ----------
  async onSubmit(form: NgForm) {
    const now = Date.now();
    if (now - this.lastSubmitAt < 5000)
      return this.showAlert('Demasiados intentos', 'Espera unos segundos antes de volver a intentarlo.', 'warning');

    // Reglas previas
    if (!this.termsAccepted)
      return this.showAlert('Falta aceptación', 'Debes aceptar los Términos y la Política de Privacidad.', 'info');

    if (!this.foto)
      return this.showAlert('Falta avatar', 'Debes seleccionar una foto de perfil (obligatoria).', 'info');

    if (!this.alias.trim())
      return this.showAlert('Alias obligatorio', 'Debes indicar un alias.', 'info');

    await this.ensureAliasChecked();
    if (this.aliasUnique !== true)
      return this.showAlert('Alias no disponible', 'El alias ya existe o no se ha podido verificar. Elige otro.', 'error');

    if (form.invalid || this.pwdIssues.length > 0 || this.pwdMismatch || this.fechaInvalida)
      return this.handleFormError('Hay campos con errores. Corrígelos y vuelve a intentarlo.');

    await this.ensurePwnedChecked();
    if ((this.pwnedCount ?? 0) > 0)
      return this.showAlert('Contraseña insegura',
        `Esta contraseña aparece en filtraciones públicas <b>${this.pwnedCount}</b> veces.<br>Por favor, elige otra distinta.`,
        'error');

    // Campos extra del Gestor
    if (this.isGestor) {
      if (!this.descripcion.trim() || !this.especialidad.trim() || !(this.tipoContenido === 'Audio' || this.tipoContenido === 'Video')) {
        return this.handleFormError('Para Gestor de Contenido, descripción, especialidad y tipo de contenido son obligatorios.');
      }
    }

    const datosRegistro: any = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.email,
      alias: this.alias.trim(),
      fechaNac: this.fechaNac,
      pwd: this.pwd,
      pwd2: this.pwd2,
      vip: this.vip,
      role: this.role,
      foto: this.foto
    };

    if (this.isGestor) {
      datosRegistro.descripcion = this.descripcion.trim();
      datosRegistro.especialidad = this.especialidad.trim();
      datosRegistro.tipoContenido = this.tipoContenido;
    }

    this.isLoading = true;
    this.lastSubmitAt = now;

    this.usersService.registrar(datosRegistro).subscribe({
      next: () => {
        this.isLoading = false;
        this.showAlert('¡Éxito!', 'Registro correcto.', 'success');
      },
      error: (error) => this.handleHttpError(error)
    });
  }

  private handleHttpError(error: any) {
    this.isLoading = false;
    this.mensajeError = 'Hubo un problema en el registro';
    if (error?.error) {
      if (typeof error.error === 'object' && error.error.message) this.mensajeError = error.error.message;
      else if (typeof error.error === 'string') {
        try {
          const obj = JSON.parse(error.error);
          if (obj.message) this.mensajeError = obj.message;
        } catch {
          this.mensajeError = error.error;
        }
      }
    }
    this.showAlert('Error', this.mensajeError, 'error');
  }

  ngOnDestroy() {
    if (this.pwnedDebounce) clearTimeout(this.pwnedDebounce);
    if (this.aliasDebounce) clearTimeout(this.aliasDebounce);
  }
}
