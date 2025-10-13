import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';
import { Contenidos } from '../contenidos';

type TipoContenido = 'AUDIO' | 'VIDEO';

interface ContenidoCreate {
  titulo: string;
  descripcion?: string;
  tipo: TipoContenido;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;    // 720p | 1080p | 4K (para VIDEO)
  tags: string[];
  duracionMinutos: number;
  vip: boolean;
  visible: boolean;
  restringidoEdad: boolean;
}

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css']
})
export class PaginaInicialGestor implements OnInit {

  // ===== Perfil (se mantiene) =====
  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = this.getInitials(this.userName);
  private loggedUser: UserDto | null = null;

  // ===== Formulario de subida =====
  nuevo: {
    titulo: string;
    descripcion: string;
    tipo: TipoContenido | '';
    ficheroAudio: string;
    urlVideo: string;
    resolucion: '720p' | '1080p' | '4K' | '';
    tagsStr: string; // separado por comas
    duracionMinutos: number | null;
    vip: 'si' | 'no';
    visible: 'si' | 'no';
    restringidoEdad: 'si' | 'no';
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
    restringidoEdad: 'no'
  };

  loading = false;
  errorMsg = '';
  successMsg = '';

  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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

  subirContenido(): void {
    this.errorMsg = '';
    this.successMsg = '';
    this.successMsg = 'Contenido subido correctamente.';
    this.resetForm();
    this.crearAbierto = false;
    
    if (!this.nuevo.titulo.trim()) {
      this.errorMsg = 'El título es obligatorio.';
      return;
    }
    if (this.nuevo.tipo !== 'AUDIO' && this.nuevo.tipo !== 'VIDEO') {
      this.errorMsg = 'Debes seleccionar el tipo (AUDIO o VIDEO).';
      return;
    }
    if (!this.nuevo.duracionMinutos || this.nuevo.duracionMinutos <= 0) {
      this.errorMsg = 'La duración debe ser mayor a 0.';
      return;
    }
    if (this.nuevo.tipo === 'AUDIO' && !this.nuevo.ficheroAudio.trim()) {
      this.errorMsg = 'Para AUDIO debes indicar la ruta del fichero de audio.';
      return;
    }
    if (this.nuevo.tipo === 'VIDEO' && !this.nuevo.urlVideo.trim()) {
      this.errorMsg = 'Para VIDEO debes indicar la URL del vídeo.';
      return;
    }
    if (this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion &&
        !/^720p|1080p|4K$/i.test(this.nuevo.resolucion)) {
      this.errorMsg = 'Resolución inválida (solo 720p, 1080p, 4K).';
      return;
    }

    const payload: ContenidoCreate = {
      titulo: this.nuevo.titulo.trim(),
      descripcion: this.nuevo.descripcion?.trim() || undefined,
      tipo: this.nuevo.tipo as TipoContenido,
      ficheroAudio: this.nuevo.tipo === 'AUDIO' ? this.nuevo.ficheroAudio.trim() : null,
      urlVideo: this.nuevo.tipo === 'VIDEO' ? this.nuevo.urlVideo.trim() : null,
      resolucion: this.nuevo.tipo === 'VIDEO' && this.nuevo.resolucion ? this.nuevo.resolucion : null,
      tags: this.nuevo.tagsStr.split(',')
        .map(t => t.trim())
        .filter(Boolean),
      duracionMinutos: Number(this.nuevo.duracionMinutos),
      vip: this.nuevo.vip === 'si',
      visible: this.nuevo.visible === 'si',
      restringidoEdad: this.nuevo.restringidoEdad === 'si'
    };

    this.loading = true;
    this.contenidosService.subirContenido(payload).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Contenido subido correctamente.';
        this.resetForm();
      },
      error: (err) => {
        console.error('Error al subir contenido:', err);
        this.loading = false;
        this.errorMsg = (err?.error?.message ?? 'No se pudo subir el contenido.');
      }
    });
  }

  resetForm(): void {
    this.nuevo = {
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
      restringidoEdad: 'no'
    };
  }

  // ===== Sesión (opcional, lo dejo por si lo usas en el header de perfil) =====
  cerrarSesion(): void {
    const confirmacion = confirm('¿Seguro que deseas cerrar sesión?');
    if (confirmacion) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      alert('Sesión cerrada correctamente.');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  crearAbierto = false;

  abrirCrear(): void {
    this.errorMsg = '';
    this.successMsg = '';
    this.crearAbierto = true;
  }

  cerrarCrear(): void {
    if (this.loading) return; // evita cerrar mientras envía
    this.crearAbierto = false;
  }


}
