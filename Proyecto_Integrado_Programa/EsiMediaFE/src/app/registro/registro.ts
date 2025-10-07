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
    switch (this.pwdScore) {
      case 0:
      case 1: return 'Débil';
      case 2:
      case 3: return 'Media';
      default: return 'Fuerte';
    }
  }

  get pwdMismatch(): boolean {
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  get fechaInvalida(): boolean {
    if (!this.fechaNac) return false;
    const hoy = new Date();
    const nac = new Date(this.fechaNac);
    return nac > hoy;
  }

  togglePwd()  { this.showPwd  = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }
  private async sha1Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  private async checkPasswordPwned(password: string): Promise<number> {
    if (!password) return 0;

    const fullHash = await this.sha1Hex(password);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }
    });

    if (!res.ok) throw new Error('Fallo consultando diccionario online');
    const text = await res.text();
 
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix?.toUpperCase() === suffix) {
        const count = parseInt((countStr || '0').replace(/\D/g, ''), 10) || 0;
        return count;
      }
    }
    return 0;
  }
  private async ensurePwnedChecked(): Promise<void> {
    if (!this.pwd || this.pwd === this.pwnedCheckedFor) return;
    this.isCheckingPwned = true;
    try {
      const count = await this.checkPasswordPwned(this.pwd);
      this.pwnedCount = count;
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
    if (now - this.lastSubmitAt < 5000) {
      Swal.fire({
        title: 'Demasiados intentos',
        text: 'Espera unos segundos antes de volver a intentarlo.',
        icon: 'warning',
        confirmButtonText: 'Cerrar'
      });
      return;
    }

    if (!this.termsAccepted) {
      Swal.fire({
        title: 'Falta aceptación',
        text: 'Debes aceptar los Términos y la Política de Privacidad.',
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (form.invalid || this.pwdIssues.length > 0 || this.pwdMismatch || this.fechaInvalida) {
      const firstInvalid = document.querySelector('.input.input-error') as HTMLElement | null;
      firstInvalid?.focus();
      Swal.fire({
        title: 'Revisa el formulario',
        text: 'Hay campos con errores. Corrígelos y vuelve a intentarlo.',
        icon: 'error',
        confirmButtonText: 'Cerrar'
      });
      return;
    }
    await this.ensurePwnedChecked();
    if ((this.pwnedCount ?? 0) > 0) {
      Swal.fire({
        title: 'Contraseña insegura',
        html: `Esta contraseña aparece en filtraciones públicas <b>${this.pwnedCount}</b> veces.<br>Por favor, elige otra distinta.`,
        icon: 'error',
        confirmButtonText: 'Cambiar contraseña'
      });
      return;
    }

    const datosRegistro = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.email,
      alias: this.alias,
      fechaNac: this.fechaNac,
      pwd: this.pwd,
      pwd2: this.pwd2,
      vip: this.vip,
      role: this.role,
      foto: this.foto?.name
    };

    this.isLoading = true;
    this.lastSubmitAt = now;

    this.usersService.registrar(datosRegistro).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          title: '¡Éxito!',
          text: 'Registro correcto. ',
          icon: 'success',
          confirmButtonText: 'Cerrar'
        });
      },
      error: (error) => {
        this.isLoading = false;
        this.mensajeError = 'Hubo un problema en el registro';
        if (error.error) {
          if (typeof error.error === 'object' && (error.error as any).message) {
            this.mensajeError = (error.error as any).message;
          } else if (typeof error.error === 'string') {
            try {
              const obj = JSON.parse(error.error);
              if (obj.message) this.mensajeError = obj.message;
            } catch {
              this.mensajeError = error.error;
            }
          }
        }
        Swal.fire({
          title: 'Error',
          text: this.mensajeError,
          icon: 'error',
          confirmButtonText: 'Cerrar'
        });
      }
    });
  }

  onFileChange(event: any) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.foto = null;
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isLt2MB = file.size <= 2 * 1024 * 1024;

    if (!isImage) {
      Swal.fire({ title: 'Formato no válido', text: 'Sube solo imágenes (jpg, png, webp...).', icon: 'error' });
      input.value = '';
      this.foto = null;
      return;
    }
    if (!isLt2MB) {
      Swal.fire({ title: 'Archivo demasiado grande', text: 'Máximo 2 MB.', icon: 'error' });
      input.value = '';
      this.foto = null;
      return;
    }
    this.foto = file;
  }

}
