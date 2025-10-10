import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Contenidos } from '../contenidos';import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';

interface ContenidoFront {
  id: string;
  titulo: string;
  descripcion: string;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  tags: string[];
  duracionMinutos: number;
  resolucion?: string | null;
  vip: boolean;
  visible: boolean;
  fechaEstado?: string | null;
  disponibleHasta?: string | null;
  restringidoEdad: boolean;
  tipo: 'AUDIO' | 'VIDEO' | string;
  favorito?: boolean;
  visto?: boolean;
}

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css']
})
export class PaginaInicialUsuario implements OnInit {

  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  userName = '';
  userEmail = '';
  userInitials = '';
  private loggedUser: UserDto | null = null;

  loading = false;
  errorMsg = '';

  contenidos: ContenidoFront[] = [];
  contenidosFiltrados: ContenidoFront[] = [];

  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };

  historial: ContenidoFront[] = [];
  favoritos: ContenidoFront[] = [];

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
    this.cargarContenidos();
  }

  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userInitials = this.getInitials(this.userName);
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

  cargarContenidos(): void {
    this.loading = true;
    this.errorMsg = '';

    this.contenidosService.listarContenidos().subscribe({
      next: (data) => {
        const list: any[] = Array.isArray(data) ? data : [];
        const normalizados: ContenidoFront[] = list.map((c: any) => ({
          id: c.id ?? c._id ?? '',
          titulo: c.titulo ?? 'Sin título',
          descripcion: c.descripcion ?? '',
          ficheroAudio: c.ficheroAudio ?? null,
          urlVideo: c.urlVideo ?? null,
          tags: Array.isArray(c.tags) ? c.tags.map((t: any) => String(t)) : [],
          duracionMinutos: Number.isFinite(c.duracionMinutos) ? c.duracionMinutos : 0,
          resolucion: c.resolucion ?? null,
          vip: !!c.vip,
          visible: !!c.visible,
          fechaEstado: c.fechaEstado ? String(c.fechaEstado) : null,
          disponibleHasta: c.disponibleHasta ? String(c.disponibleHasta) : null,
          restringidoEdad: !!c.restringidoEdad,
          tipo: c.tipo ?? 'VIDEO',
          favorito: false,
          visto: false
        }));

        this.contenidos = normalizados.filter(c => c.visible);
        this.contenidosFiltrados = [...this.contenidos];
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al listar contenidos:', err);
        this.errorMsg = 'No se pudieron cargar los contenidos.';
        this.loading = false;
      }
    });
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  aplicarFiltros(): void {
    const { titulo, tipo, vip, visible, tagIncluye, ordenar } = this.filtros;

    let lista = this.contenidos.filter(c => {
      const coincideTitulo = !titulo || c.titulo.toLowerCase().includes(titulo.toLowerCase());
      const coincideTipo = !tipo || (String(c.tipo).toUpperCase() === tipo);
      const coincideVip =
        vip === '' ||
        (vip === 'si' && c.vip) ||
        (vip === 'no' && !c.vip);
      const coincideVisible =
        visible === '' ||
        (visible === 'si' && c.visible) ||
        (visible === 'no' && !c.visible);
      const coincideTag =
        !tagIncluye || c.tags.some(t => t.toLowerCase().includes(tagIncluye.toLowerCase()));

      return coincideTitulo && coincideTipo && coincideVip && coincideVisible && coincideTag;
    });

    switch (ordenar) {
      case 'titulo':
        lista.sort((a, b) => a.titulo.localeCompare(b.titulo));
        break;
      case 'vip':
        lista.sort((a, b) => Number(b.vip) - Number(a.vip));
        break;
      case 'visible':
        lista.sort((a, b) => Number(b.visible) - Number(a.visible));
        break;
      case 'fecha':
      default:
        lista.sort((a, b) => {
          const ta = a.fechaEstado ? Date.parse(a.fechaEstado) : NaN;
          const tb = b.fechaEstado ? Date.parse(b.fechaEstado) : NaN;
          if (isNaN(ta) && isNaN(tb)) return 0;
          if (isNaN(ta)) return 1;
          if (isNaN(tb)) return -1;
          return tb - ta;
        });
        break;
    }

    this.contenidosFiltrados = lista;
  }

  toggleFavorito(contenido: ContenidoFront): void {
    contenido.favorito = !contenido.favorito;
    if (contenido.favorito) {
      this.favoritos.push(contenido);
    } else {
      this.favoritos = this.favoritos.filter(c => c.id !== contenido.id);
    }
  }

  marcarVisto(contenido: ContenidoFront): void {
    contenido.visto = true;
    if (!this.historial.some(c => c.id === contenido.id)) {
      this.historial.push(contenido);
    }
  }

  cerrarSesion(): void {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }
}
