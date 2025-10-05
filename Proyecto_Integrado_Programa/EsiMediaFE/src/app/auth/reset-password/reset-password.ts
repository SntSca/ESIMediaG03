import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPassword {
  token = '';
  pwd = '';
  pwd2 = '';
  showPwd = false;
  showPwd2 = false;
  cargando = false;

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {
    // Obtenemos el token de la URL (query params)
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
    });
  }

  togglePwd() { this.showPwd = !this.showPwd; }
  togglePwd2() { this.showPwd2 = !this.showPwd2; }

  // 🔹 Validación de fortaleza de contraseña
  get requisitos(): string[] {
    const errores: string[] = [];
    if (this.pwd.length < 8) errores.push('Al menos 8 caracteres');
    if (!/[A-Z]/.test(this.pwd)) errores.push('Una letra mayúscula');
    if (!/[a-z]/.test(this.pwd)) errores.push('Una letra minúscula');
    if (!/\d/.test(this.pwd)) errores.push('Un número');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(this.pwd)) errores.push('Un carácter especial');
    return errores;
  }

  get coincide(): boolean {
    return this.pwd2.length > 0 && this.pwd !== this.pwd2;
  }

  // 🔹 Enviar nueva contraseña al backend
  onSubmit() {
    if (this.requisitos.length > 0 || this.coincide || !this.token) {
      Swal.fire('Error', 'Revisa los campos: la contraseña debe cumplir los requisitos y coincidir', 'error');
      return;
    }

    this.cargando = true;
    this.http.post('http://localhost:8080/users/reset-password', {
      token: this.token,
      pwd: this.pwd,
      pwd2: this.pwd2
    }).subscribe({
      next: (res: any) => {
        this.cargando = false;
        Swal.fire('Éxito', res.message || 'Contraseña restablecida correctamente', 'success')
          .then(() => this.router.navigate(['/auth']));
      },
      error: (err) => {
        this.cargando = false;
        Swal.fire('Error', err.error?.message || 'Error al restablecer la contraseña', 'error');
      }
    });
  }
}
