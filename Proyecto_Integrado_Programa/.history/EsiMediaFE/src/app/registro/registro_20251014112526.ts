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
  foto: string | null = null;
  showPwd = false;
  showPwd2 = false;
  isLoading = false;

  mensajeError = '';
  pwnedCount: number | null = null;
  pwnedCheckedFor: string = '';
  isCheckingPwned = false;
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

  // --- Validaciones de contraseña ---
  get pwdIssues(): string[] {
    const issues: string[] = [];
    if (this.pwd.length < 8) issues.push('Al menos 8 caracteres');
    if (!/[A-Z]/.test(this.pwd)) issues.push('Una letra mayúscula');
    if (!/[a-z]/.test(this.pwd)) issues.push('Una letra minúscula');
    if (!/\d/.test(this.pwd)) issues.push('Un número');
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(this.pwd)) issues.push('Un carácter especial');
    return issues;
  }

  get pwdMismatch(): boolean {
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  get fechaInvalida(): boolean {
    return !!this.fechaNac && new Date(this.fechaNac) > new Date();
  }

  togglePwd() { this.showPwd = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }

  // --- Comprobación en tiempo real con HaveIBeenPwned ---
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
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }
    });
    if (!res.ok) throw new Error('Fallo consultando diccionario online');
    const lines = (await res.text()).split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix?.toUpperCase() === suffix) return parseInt(countStr.replace(/\D/g, ''), 10) || 0;
    }
    return 0;
  }

  async onPwdChange() {
    this.pwnedCount = null;
    this.pwnedCheckedFor = '';
    if (!this.pwd || this.pwd.length < 8) return; // evita spam mientras escribe

    this.isCheckingPwned = true;
    try {
      const count = await this.checkPasswordPwned(this.pwd);
      this.pwnedCount = count;
      this.pwnedCheckedFor = this.pwd;
    } catch {
      this.pwnedCount = null;
    } finally {
      this.isCheckingPwned = false;
    }
  }

  // --- Avatares ---
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.foto = avatar;
    this.closeAvatarModal();
  }

  // --- Envío del formulario ---
  async onSubmit(form: NgForm) {
    if (form.invalid || this.pwdIssues.length > 0 || this.pwdMismatch || this.fechaInvalida)
      return Swal.fire('Error', 'Hay errores en el formulario.', 'error');

    if ((this.pwnedCount ?? 0) > 0)
      return Swal.fire('Contraseña insegura',
        `Esta contraseña ha aparecido en <b>${this.pwnedCount}</b> filtraciones. Elige otra.`,
        'error');

    const datosRegistro = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      email: this.email,
      alias: this.alias,
      fechaNac: this.fechaNac,
      pwd: this.pwd,
      vip: this.vip,
      role: this.role,
      foto: this.foto
    };

    this.isLoading = true;
    this.usersService.registrar(datosRegistro).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire('¡Éxito!', 'Registro correcto.', 'success');
      },
      error: () => {
        this.isLoading = false;
        Swal.fire('Error', 'No se pudo completar el registro.', 'error');
      }
    });
  }
}
