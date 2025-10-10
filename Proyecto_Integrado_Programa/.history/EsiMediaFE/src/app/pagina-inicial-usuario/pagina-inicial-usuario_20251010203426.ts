import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Contenidos } from '../contenidos';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';
import { finalize } from 'rxjs/operators';

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
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {

  // Services
  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Usuario
  userName = '';
  userEmail = '';
  userInitials = '';
  private loggedUser: UserDto | null = null;

  // Estado general
  loading = false;
  errorMsg = '';

  // Datos
  contenidos: ContenidoFront[] = [];
  contenidosFiltrados: ContenidoFront[] = [];
  historial: ContenidoFront[] = [];
  favoritos: ContenidoFront[] = [];

  // Pestañas
  selectedTab: 'ALL' | 'AUDIO' | 'VIDEO' = 'ALL';

  // Filtros
  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };

  // Para bloquear clicks repetidos en el corazón
  private favLocks = new Set<string>();

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
    this.cargarContenidos();
    // Solo para ver la UI ahora mismo:
    this.cargarMock();

  }

  // ==== Usuario ====
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

  // ==== Carga de contenidos ====
  cargarContenidos(): void {
    this.loading = true;
    this.errorMsg = '';

    this.contenidosService.listarContenidos()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          const list: any[] = Array.isArray(data) ? data : [];
          const normalizados: ContenidoFront[] = list.map((c: any) => ({
            id: c.id ?? c._id ?? '',
            titulo: c.titulo ?? 'Sin título',
            descripcion: c.descripcion ?? '',
            ficheroAudio: c.ficheroAudio ?? null,
            urlVideo: c.urlVideo ?? null,
            tags: Array.isArray(c.tags) ? c.tags.filter((t: any) => !!t).map((t: any) => String(t)) : [],
            duracionMinutos: Number.isFinite(c.duracionMinutos) ? c.duracionMinutos : 0,
            resolucion: c.resolucion ?? null,
            vip: !!c.vip,
            visible: !!c.visible,
            fechaEstado: c.fechaEstado ? String(c.fechaEstado) : null,
            disponibleHasta: c.disponibleHasta ? String(c.disponibleHasta) : null,
            restringidoEdad: !!c.restringidoEdad,
            tipo: (c.tipo ?? 'VIDEO'),
            favorito: !!c.favorito,   // si el BE lo trae
            visto: !!c.visto          // opcional
          }));

          // Sólo visibles para el usuario final
          this.contenidos = normalizados.filter(c => c.visible);
          // Iniciales de favoritos/historial si vienen marcados
          this.favoritos = this.contenidos.filter(c => c.favorito);
          this.historial = this.contenidos.filter(c => c.visto);

          this.contenidosFiltrados = [...this.contenidos];
          this.aplicarFiltros();
        },
        error: (err) => {
          console.error('Error al listar contenidos:', err);
          this.errorMsg = 'No se pudieron cargar los contenidos.';
        }
      });
  }

  // ==== Utilidades ====
  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  getEmoji(c: ContenidoFront){ return String(c.tipo).toUpperCase()==='AUDIO' ? '🎵' : '🎬'; }

  // ==== Filtros / Pestañas ====
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

  setTab(tab: 'ALL' | 'AUDIO' | 'VIDEO'){ this.selectedTab = tab; }

  get contenidosTab(): ContenidoFront[] {
    const tipo = this.selectedTab;
    return this.contenidosFiltrados.filter(c =>
      tipo === 'ALL' ? true : String(c.tipo).toUpperCase() === tipo
    );
  }

  // ==== Carruseles ====
  get carruselRecomendados(): ContenidoFront[] {
    const arr = [...this.contenidosTab];
    arr.sort((a,b)=> Number(a.restringidoEdad) - Number(b.restringidoEdad) || Number(b.vip)-Number(a.vip));
    return arr.slice(0, 20);
  }
  get carruselPopulares(): ContenidoFront[] {
    const vipFirst = [...this.contenidosTab].sort((a,b)=> Number(b.vip) - Number(a.vip));
    return vipFirst.slice(0, 20);
  }
  get carruselUltimos(): ContenidoFront[] {
    const byFecha = [...this.contenidosTab].sort((a,b)=>{
      const ta = a.fechaEstado ? Date.parse(a.fechaEstado) : 0;
      const tb = b.fechaEstado ? Date.parse(b.fechaEstado) : 0;
      return tb - ta;
    });
    return byFecha.slice(0, 20);
  }

  scrollCarousel(el: HTMLElement, dir: 'prev'|'next'){
    if (!el) return;
    const delta = el.clientWidth * 0.9 * (dir === 'next' ? 1 : -1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

toggleFavorito(contenido: ContenidoFront): void {
  if (!contenido?.id) return;

  const u: any = this.loggedUser;
  const userId: string | null = (u?.id ?? u?._id ?? null);
  if (!userId) { alert('No se pudo identificar al usuario.'); return; }

  const lockKey = `${userId}:${contenido.id}`;
  if (this.favLocks.has(lockKey)) return;
  this.favLocks.add(lockKey);

  const estabaFavorito = !!contenido.favorito;
  // Optimistic UI
  contenido.favorito = !estabaFavorito;
  if (contenido.favorito) {
    if (!this.favoritos.some(f => f.id === contenido.id)) this.favoritos.unshift(contenido);
  } else {
    this.favoritos = this.favoritos.filter(f => f.id !== contenido.id);
  }

  const req$ = estabaFavorito
    ? this.contenidosService.removeFavorito(Number(userId), Number(contenido.id))
    : this.contenidosService.addFavorito(Number(userId), Number(contenido.id));

  req$.subscribe({
    next: () => this.favLocks.delete(lockKey),
    error: (err) => {
      console.error('Error favorito:', err);
      // rollback
      contenido.favorito = estabaFavorito;
      if (estabaFavorito) {
        if (!this.favoritos.some(f => f.id === contenido.id)) this.favoritos.unshift(contenido);
      } else {
        this.favoritos = this.favoritos.filter(f => f.id !== contenido.id);
      }
      this.favLocks.delete(lockKey);
      alert('No se pudo actualizar favorito. Inténtalo de nuevo.');
    }
  });
}



  // ==== Historial / visto ====
  marcarVisto(contenido: ContenidoFront): void {
    contenido.visto = true;
    if (!this.historial.some(c => c.id === contenido.id)) {
      this.historial.push(contenido);
    }
    // Si necesitas persistirlo, añade aquí service.setVisto(contenido.id, true).subscribe(...)
  }

  // ==== Sesión ====
  cerrarSesion(): void {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }
  /** ⚙️ Mock rápido para ver la UI sin backend */
  cargarMock(): void {
    const ahora = new Date();

    const mock: ContenidoFront[] = [
      {
        id: 'c001',
        titulo: 'Lo-Fi para estudiar',
        descripcion: 'Sesión relajante de lo-fi durante 2 horas para mantener el foco.',
        ficheroAudio: '/files/lofi.mp3',
        urlVideo: null,
        tags: ['lofi', 'focus', 'study'],
        duracionMinutos: 120,
        resolucion: null,
        vip: false,
        visible: true,
        fechaEstado: new Date(ahora.getTime() - 2 * 3600_000).toISOString(),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'AUDIO',
        favorito: false,
        visto: false
      },
      {
        id: 'c002',
        titulo: 'Corto Sci-Fi “Orbital”',
        descripcion: 'Un ingeniero espacial descubre un secreto en la órbita lunar.',
        ficheroAudio: null,
        urlVideo: 'https://cdn.esim/video/abc123',
        tags: ['scifi', 'shortfilm'],
        duracionMinutos: 14,
        resolucion: '1080p',
        vip: true,
        visible: true,
        fechaEstado: new Date(ahora.getTime() - 26 * 3600_000).toISOString(),
        disponibleHasta: null,
        restringidoEdad: true,
        tipo: 'VIDEO',
        favorito: true,  // 👉 aparecerá con corazón rojo
        visto: true
      },
      {
        id: 'c003',
        titulo: 'Podcast Seguridad AppSec #27',
        descripcion: 'Repasamos OWASP Top 10 y casos reales en microservicios.',
        ficheroAudio: '/files/appsec27.mp3',
        urlVideo: null,
        tags: ['security', 'owasp', 'devsecops'],
        duracionMinutos: 56,
        resolucion: null,
        vip: false,
        visible: true,
        fechaEstado: new Date(ahora.getTime() - 6 * 3600_000).toISOString(),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'AUDIO',
        favorito: false,
        visto: false
      },
      {
        id: 'c004',
        titulo: 'Documental: Bosques de Niebla',
        descripcion: 'Un viaje visual por los ecosistemas de montaña más singulares.',
        ficheroAudio: null,
        urlVideo: 'https://cdn.esim/video/nebula999',
        tags: ['nature', 'documentary', '4k'],
        duracionMinutos: 48,
        resolucion: '4K',
        vip: false,
        visible: true,
        fechaEstado: new Date(ahora.getTime() - 4 * 3600_000).toISOString(),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'VIDEO',
        favorito: false,
        visto: false
      },
      {
        id: 'c005',
        titulo: 'Jazz Nocturno',
        descripcion: 'Selección de clásicos de jazz para la noche.',
        ficheroAudio: '/files/jazz-night.mp3',
        urlVideo: null,
        tags: ['jazz', 'night', 'classics'],
        duracionMinutos: 90,
        resolucion: null,
        vip: true,
        visible: true,
        fechaEstado: new Date(ahora.getTime() - 1 * 3600_000).toISOString(),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'AUDIO',
        favorito: false,
        visto: false
      },
      {
        id: 'c006',
        titulo: 'Tutorial Angular Animations',
        descripcion: 'Aprende a crear transiciones y micro-interacciones con Angular.',
        ficheroAudio: null,
        urlVideo: 'https://cdn.esim/video/ng-anim',
        tags: ['angular', 'frontend', 'tutorial'],
        duracionMinutos: 22,
        resolucion: '720p',
        vip: false,
        visible: true,
        fechaEstado: ahora.toISOString(),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'VIDEO',
        favorito: false,
        visto: false
      }
    ];

    // Simula que el backend devuelve visibles:
    this.contenidos = mock.filter(c => c.visible);
    // Marca favoritos/historial desde mock:
    this.favoritos = this.contenidos.filter(c => c.favorito);
    this.historial = this.contenidos.filter(c => c.visto);

    this.contenidosFiltrados = [...this.contenidos];
    this.aplicarFiltros();
  }

}
