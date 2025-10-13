import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
// Si ya usas provideHttpClient() en app.config.ts, puedes quitar HttpClientModule de imports:
import { HttpClientModule } from '@angular/common/http';

import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';
import { Contenidos } from '../contenidos';
import Swal from 'sweetalert2';

type TipoContenido = 'AUDIO' | 'VIDEO';

interface ContenidoCreate {
  titulo: string;
  descripcion?: string;
  tipo: TipoContenido;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;
  tags: string[];
  duracionMinutos: number;
  vip: boolean;
  visible: boolean;
  restringidoEdad: boolean;
  imagen?: string | null; // <-- se envía como string (ruta/URL), opcional
}

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css']
})
export class PaginaInicialGestor implements OnInit {

  // ===== Perfil =====
  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = this.getInitials(this.userName);
  private loggedUser: UserDto | null = null;

  // ===== Formulario (incluye imagen) =====
  nuevo: {
    titulo: string;
    descripcion: string;
    tipo: TipoContenido | '';
    ficheroAudio: string;
    urlVideo: string;
    resolucion: '720p' | '1080p' | '4K' | '';
    tagsStr: string;
    duracionMinutos: number | null;
    vip: 'si' | 'no';
    visible: 'si' | 'no';
    restringidoEdad: 'si' | 'no';
    imagen: string; // <-- aquí se bindea la ruta/URL de imagen
  } = {
    titulo: '',
    descripcion: '',
    tipo: '',
    ficheroAudio: '',
    urlVideo: '',
    resolucion: '',
    tagsStr: '',
    duracionMinutos: null,
    vip: 'no',
    visible: 'no',
    restringidoEdad: 'no',
    imagen: ''
  };

  loading = false;
  errorMsg = '';
  successMsg = '';
  crearAbierto = false;
  lastSubmitAt = 0;

  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ===== Ciclo de vida =====
  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }

  // ===== Perfil helpers =====
  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = this.mapRoleToLabel(user.role);
    this.userInitials = this.getInitials(this.userName);
  }

  private mapRoleToLabel(role: UserDto['role'] | string): string {
    switch (role) {
      case 'ADMINISTRADOR': return 'Administrador';
      case 'USUARIO': return 'Usuario';
      case 'GESTOR_CONTENIDO': return 'Gestor de contenido';
      default: return String(role ?? 'Desconocido');
    }
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && parsed.role) return parsed as UserDto;
      return null;
    } catch {
      return null;
    }
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  // ===== Modal =====
  abrirCrear(): void {
    this.errorMsg = '';
    this.successMsg = '';
    this.crearAbierto = true;
  }

  cerrarCrear(): void {
    if (this.loading) return; // Evita cerrar mientras envía
    this.crearAbierto = false;
  }

  // ===== Validaciones cruzadas (AUDIO/VIDEO) =====
  get audioHasVideoFields(): boolean {
    return this.nuevo?.tipo === 'AUDIO' && (!!this.nuevo?.urlVideo || !!this.nuevo?.resolucion);
  }
  get videoHasAudioField(): boolean {
    return this.nuevo?.tipo === 'VIDEO' && !!this.nuevo?.ficheroAudio;
  }
  get crossErrorsPresent(): boolean {
    return this.audioHasVideoFields || this.videoHasAudioField;
  }

  private markAllTouched(form: NgForm) {
    Object.values(form.controls).forEach(c => c.markAsTouched());
  }

  // ===== Submit con SweetAlert2 y throttling =====
  async onSubmit(form: NgForm) {
    const now = Date.now();
    if (now - this.lastSubmitAt < 5000) {
      await Swal.fire({
        title: 'Demasiados intentos',
        text: 'Espera unos segundos antes de volver a intentarlo.',
        icon: 'warning',
        confirmButtonText: 'Cerrar'
      });
      return;
    }

    // Incompatibilidades
    if (this.crossErrorsPresent) {
      this.markAllTouched(form);
      const firstInvalid = document.querySelector('.input-error');
      firstInvalid?.focus();
      await Swal.fire({
        title: 'Revisa el formulario',
        text: 'Hay incompatibilidades con el tipo seleccionado.',
        icon: 'error',
        confirmButtonText: 'Cerrar'
      });
      return;
    }

    // Form inválido
    if (form.invalid) {
      this.markAllTouched(form);
      const firstInvalid = document.querySelector('.input-error') as HTMLElement | null;
      firstInvalid?.focus();
      await Swal.fire({
        title: 'Revisa el formulario',
        text: 'Hay campos con errores. Corrígelos y vuelve a intentarlo.',
        icon: 'error',
        confirmButtonText: 'Cerrar'
      });
      return;
    }

    // Construcción del payload (normalizado)
    const payload: ContenidoCreate = {
      titulo: (this.nuevo.titulo ?? '').trim(),
      descripcion: (this.nuevo.descripcion ?? '').trim() || undefined,
      tipo: this.nuevo.tipo as TipoContenido,
      ficheroAudio: this.nuevo.tipo === 'AUDIO' ? (this.nuevo.ficheroAudio ?? '').trim() : null,
      urlVideo: this.nuevo.tipo === 'VIDEO' ? (this.nuevo.urlVideo ?? '').trim() : null,
      resolucion: this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion ? this.nuevo.resolucion : null,
      tags: (this.nuevo.tagsStr ?? '').split(',').map(t => t.trim()).filter(Boolean),
      duracionMinutos: Number(this.nuevo.duracionMinutos),
      vip: this.nuevo.vip === 'si',
      visible: this.nuevo.visible === 'si',
      restringidoEdad: this.nuevo.restringidoEdad === 'si',
      imagen: this.nuevo.imagen?.trim() ? this.nuevo.imagen.trim() : null
    };

    this.loading = true;
    this.lastSubmitAt = now;

    this.contenidosService.subirContenido(payload).subscribe({
      next: async () => {
        this.loading = false;
        await Swal.fire({
          title: '¡Éxito!',
          text: 'Contenido subido correctamente.',
          icon: 'success',
          confirmButtonText: 'Cerrar'
        });
        this.resetForm();
        this.crearAbierto = false;
      },
      error: async (error) => {
        this.loading = false;

        let mensajeError = 'No se pudo subir el contenido.';
        const raw = error?.error;
        if (raw) {
          if (typeof raw === 'object' && (raw as any).message) {
            mensajeError = (raw as any).message;
          } else if (typeof raw === 'string') {
            try {
              const obj = JSON.parse(raw);
              if (obj.message) mensajeError = obj.message;
            } catch {
              mensajeError = raw;
            }
          }
        }

        await Swal.fire({
          title: 'Error',
          text: mensajeError,
          icon: 'error',
          confirmButtonText: 'Cerrar'
        });
      }
    });
  }

  // ===== Reset del formulario (incluye imagen) =====
  resetForm(): void {
    Object.assign(this.nuevo, {
      titulo: '',
      descripcion: '',
      tipo: '',
      ficheroAudio: '',
      urlVideo: '',
      resolucion: '',
      tagsStr: '',
      duracionMinutos: null,
      vip: 'no',
      visible: 'no',
      restringidoEdad: 'no',
      imagen: '' // <-- CORRECTO (antes tenías 'portada')
    });
  }

  // ===== Sesión =====
  cerrarSesion(): void {
    const confirmacion = confirm('¿Seguro que deseas cerrar sesión?');
    if (confirmacion) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      alert('Sesión cerrada correctamente.');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }
}
