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
  ficheroAudio?: string | null;  // URL real de audio (mp3)
  urlVideo?: string | null;      // URL real de video (mp4)
  posterUrl?: string | null;     // URL de imagen de carátula
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

interface RailSection {
  key: string;
  title: string;
  items: ContenidoFront[];
}

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {

  // Cambia a false cuando conectes el backend real
  private readonly USE_MOCK = true;

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

  /** Historial “online por sesión” (resetea al entrar) */
  historialSesion: ContenidoFront[] = [];

  /** Favoritos persistentes (mock o backend) */
  favoritos: ContenidoFront[] = [];

  selectedTab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV' = 'ALL';
  selectedSubTab: 'AUDIO' | 'VIDEO' | 'ALL' = 'ALL';

  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };

  private favLocks = new Set<string>();

  private readonly RAILS_MAX = 12;
  private readonly RAIL_ITEMS_MAX = 20;
  /** Mínimo global (en ALL/Audio/Video). En FAV/HIST usaremos 1 dinámicamente. */
  private readonly MIN_ITEMS_PER_RAIL = 2;
  private readonly MULTI_ASSIGN = true;

  ngOnInit(): void {
    // Reset historial “online” en cada entrada
    this.historialSesion = [];

    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);

    if (!this.USE_MOCK) {
      const userId = this.getLoggedUserId();
      if (userId) {
        // Si quieres limpiar el historial de sesión en el backend:
        // this.contenidosService.resetHistorialSesion(userId).subscribe({ next:()=>{}, error:()=>{} });
      }
    }

    if (this.USE_MOCK) {
      this.cargarMock();
    } else {
      this.cargarContenidos();
    }
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

  private getLoggedUserId(): string | null {
    const u: any = this.loggedUser;
    return (u?.id ?? u?._id ?? null) as string | null;
  }

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
            posterUrl: c.posterUrl ?? null,
            tags: Array.isArray(c.tags) ? c.tags.filter((t: any) => !!t).map((t: any) => String(t)) : [],
            duracionMinutos: Number.isFinite(c.duracionMinutos) ? c.duracionMinutos : 0,
            resolucion: c.resolucion ?? null,
            vip: !!c.vip,
            visible: !!c.visible,
            fechaEstado: c.fechaEstado ? String(c.fechaEstado) : null,
            disponibleHasta: c.disponibleHasta ? String(c.disponibleHasta) : null,
            restringidoEdad: !!c.restringidoEdad,
            tipo: (c.tipo ?? 'VIDEO'),
            favorito: !!c.favorito,
            visto: !!c.visto
          }));

          this.contenidos = normalizados.filter(c => c.visible);
          this.contenidosFiltrados = [...this.contenidos];

          const userId = this.getLoggedUserId();
          if (userId) {
            this.contenidosService.getFavoritos(userId).subscribe({
              next: (idsFav) => {
                const favSet = new Set(idsFav ?? []);
                this.contenidos.forEach(c => c.favorito = favSet.has(c.id));
                this.favoritos = this.contenidos.filter(c => c.favorito);
                this.aplicarFiltros();
              },
              error: () => { this.aplicarFiltros(); }
            });
          } else {
            this.aplicarFiltros();
          }
        },
        error: (err) => {
          console.error('Error al listar contenidos:', err);
          this.errorMsg = 'No se pudieron cargar los contenidos.';
        }
      });
  }

  // ===== MOCK con URLs reales =====
  cargarMock(): void {
    const now = new Date();
    const isoAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

    const mock: ContenidoFront[] = [
      {
        id: 'c001',
        titulo: 'Lo-Fi para estudiar',
        descripcion: 'Sesión relajante de lo-fi para mantener el foco.',
        ficheroAudio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        urlVideo: null,
        posterUrl: 'https://images.unsplash.com/photo-1520975657282-7b0f81a2d36b?q=80&w=600&auto=format&fit=crop',
        tags: ['study', 'relax', 'lofi'],
        duracionMinutos: 120,
        resolucion: null,
        vip: false,
        visible: true,
        fechaEstado: isoAgo(2),
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
        urlVideo: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=600&auto=format&fit=crop',
        tags: ['scifi', 'drama'],
        duracionMinutos: 14,
        resolucion: '1080p',
        vip: true,
        visible: true,
        fechaEstado: isoAgo(26),
        disponibleHasta: null,
        restringidoEdad: true,
        tipo: 'VIDEO',
        favorito: true,   // favorito inicial (para probar pestaña)
        visto: true
      },
      {
        id: 'c003',
        titulo: 'Podcast Seguridad AppSec #27',
        descripcion: 'Repasamos OWASP Top 10 y casos reales en microservicios.',
        ficheroAudio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
        urlVideo: null,
        posterUrl: 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=600&auto=format&fit=crop',
        tags: ['tech', 'security', 'podcast'],
        duracionMinutos: 56,
        resolucion: null,
        vip: false,
        visible: true,
        fechaEstado: isoAgo(6),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'AUDIO',
        favorito: false,
        visto: false
      },
      {
        id: 'c004',
        titulo: 'Documental: Bosques de Niebla',
        descripcion: 'Un viaje visual por los ecosistemas de montaña.',
        ficheroAudio: null,
        urlVideo: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=600&auto=format&fit=crop',
        tags: ['nature', 'documentary'],
        duracionMinutos: 48,
        resolucion: '4K',
        vip: false,
        visible: true,
        fechaEstado: isoAgo(4),
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
        ficheroAudio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
        urlVideo: null,
        posterUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=600&auto=format&fit=crop',
        tags: ['jazz', 'night', 'relax'],
        duracionMinutos: 90,
        resolucion: null,
        vip: true,
        visible: true,
        fechaEstado: isoAgo(1),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'AUDIO',
        favorito: false,
        visto: false
      },
      {
        id: 'c006',
        titulo: 'Tutorial Angular Animations',
        descripcion: 'Transiciones y micro-interacciones en Angular paso a paso.',
        ficheroAudio: null,
        urlVideo: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=600&auto=format&fit=crop',
        tags: ['tech', 'frontend', 'tutorial'],
        duracionMinutos: 22,
        resolucion: '720p',
        vip: false,
        visible: true,
        fechaEstado: isoAgo(0),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'VIDEO',
        favorito: false,
        visto: false
      },
      {
        id: 'c007',
        titulo: 'Cine: Drama de Época',
        descripcion: 'Historia de amor y guerra en el siglo XIX.',
        ficheroAudio: null,
        urlVideo: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=600&auto=format&fit=crop',
        tags: ['drama'],
        duracionMinutos: 102,
        resolucion: '1080p',
        vip: false,
        visible: true,
        fechaEstado: isoAgo(12),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'VIDEO',
        favorito: false,
        visto: false
      },
      {
        id: 'c008',
        titulo: 'Focus Beats',
        descripcion: 'Beats electrónicos suaves para concentración.',
        ficheroAudio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        urlVideo: null,
        posterUrl: 'https://images.unsplash.com/photo-1497032205916-ac775f0649ae?q=80&w=600&auto=format&fit=crop',
        tags: ['study', 'electronic'],
        duracionMinutos: 60,
        resolucion: null,
        vip: false,
        visible: true,
        fechaEstado: isoAgo(8),
        disponibleHasta: null,
        restringidoEdad: false,
        tipo: 'AUDIO',
        favorito: false,
        visto: false
      }
    ];

    this.contenidos = mock.filter(c => c.visible);
    this.favoritos = this.contenidos.filter(c => c.favorito);

    this.contenidosFiltrados = [...this.contenidos];
    this.aplicarFiltros();
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  getEmoji(c: ContenidoFront){ return String(c.tipo).toUpperCase()==='AUDIO' ? '🎵' : '🎬'; }

  private normTema(raw: string): string {
    return (raw || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  }
  private titleCase(s: string): string {
    const clean = (s || '').trim();
    return clean ? clean[0].toUpperCase() + clean.slice(1) : clean;
  }

  aplicarFiltros(): void {
    const { titulo, tipo, vip, visible, tagIncluye, ordenar } = this.filtros;

    let lista = this.contenidos.filter(c => {
      const coincideTitulo = !titulo || c.titulo.toLowerCase().includes(titulo.toLowerCase());
      const coincideTipo = !tipo || (String(c.tipo).toUpperCase() === tipo);
      const coincideVip =
        vip === '' || (vip === 'si' && c.vip) || (vip === 'no' && !c.vip);
      const coincideVisible =
        visible === '' || (visible === 'si' && c.visible) || (visible === 'no' && !c.visible);
      const coincideTag =
        !tagIncluye || c.tags.some(t => t.toLowerCase().includes(tagIncluye.toLowerCase()));

      return coincideTitulo && coincideTipo && coincideVip && coincideVisible && coincideTag;
    });

    switch (ordenar) {
      case 'titulo': lista.sort((a, b) => a.titulo.localeCompare(b.titulo)); break;
      case 'vip':    lista.sort((a, b) => Number(b.vip) - Number(a.vip));   break;
      case 'visible':lista.sort((a, b) => Number(b.visible) - Number(a.visible)); break;
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

  /** Cambia pestaña y auto-detecta subtabs en FAV/HIST */
  setTab(tab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV'){
    this.selectedTab = tab;

    if (tab === 'HIST') {
      const hasAudio = this.historialSesion.some(c => String(c.tipo).toUpperCase()==='AUDIO');
      const hasVideo = this.historialSesion.some(c => String(c.tipo).toUpperCase()==='VIDEO');
      this.selectedSubTab = hasAudio ? 'AUDIO' : (hasVideo ? 'VIDEO' : 'AUDIO');
    } else if (tab === 'FAV') {
      const hasAudio = this.favoritos.some(c => String(c.tipo).toUpperCase()==='AUDIO');
      const hasVideo = this.favoritos.some(c => String(c.tipo).toUpperCase()==='VIDEO');
      this.selectedSubTab = hasAudio ? 'AUDIO' : (hasVideo ? 'VIDEO' : 'AUDIO');
    } else {
      this.selectedSubTab = 'ALL';
    }
  }
  setSubTab(sub: 'AUDIO' | 'VIDEO'){ this.selectedSubTab = sub; }

  get contenidosTab(): ContenidoFront[] {
    switch (this.selectedTab) {
      case 'AUDIO':
        return this.contenidosFiltrados.filter(c => String(c.tipo).toUpperCase()==='AUDIO');
      case 'VIDEO':
        return this.contenidosFiltrados.filter(c => String(c.tipo).toUpperCase()==='VIDEO');
      case 'HIST': {
        const base = this.historialSesion;
        return base.filter(c => String(c.tipo).toUpperCase() === this.selectedSubTab);
      }
      case 'FAV': {
        const base = this.favoritos;
        return base.filter(c => String(c.tipo).toUpperCase() === this.selectedSubTab);
      }
      case 'ALL':
      default:
        return this.contenidosFiltrados;
    }
  }

  /** Rails por tema (dinámicos) con mínimo flexible */
  get railSections(): RailSection[] {
    const src = this.contenidosTab;
    const map = new Map<string, ContenidoFront[]>();

    for (const c of src) {
      const tags = Array.isArray(c.tags) ? c.tags.filter(Boolean) : [];
      if (!tags.length) {
        const k = 'otros';
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
        continue;
      }
      if (this.MULTI_ASSIGN) {
        for (const tRaw of tags) {
          const k = this.normTema(tRaw);
          if (!k) continue;
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push(c);
        }
      } else {
        const k = this.normTema(tags[0]);
        if (!k) continue;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
      }
    }

    // 👉 mínimo de items por rail: 1 para FAV/HIST, si no usa el global (2)
    const minPerRail = (this.selectedTab === 'FAV' || this.selectedTab === 'HIST') ? 1 : this.MIN_ITEMS_PER_RAIL;

    let sections: RailSection[] = Array.from(map.entries())
      .map(([k, arr]) => ({
        key: k,
        title: this.titleCase(k),
        items: arr
          .slice()
          .sort((a, b) =>
            Number(b.vip) - Number(a.vip) ||
            ((b.fechaEstado ? Date.parse(b.fechaEstado) : 0) -
             (a.fechaEstado ? Date.parse(a.fechaEstado) : 0))
          )
          .slice(0, this.RAIL_ITEMS_MAX)
      }))
      .filter(sec => sec.items.length >= minPerRail);

    sections.sort((a, b) => b.items.length - a.items.length);
    return sections.slice(0, this.RAILS_MAX);
  }

  trackByKey = (_: number, sec: RailSection) => sec.key;

  scrollCarousel(el: HTMLElement, dir: 'prev'|'next'){
    if (!el) return;
    const delta = el.clientWidth * 0.9 * (dir === 'next' ? 1 : -1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  // === Play: abre la URL del contenido y lo mete en historial de sesión ===
  playContenido(c: ContenidoFront): void {
    const url = (String(c.tipo).toUpperCase() === 'VIDEO') ? c.urlVideo : c.ficheroAudio;
    if (!url) { alert('Este contenido no tiene una URL disponible.'); return; }
    try {
      window.open(url, '_blank', 'noopener');
      this.marcarVisto(c);
    } catch {
      location.href = url; // fallback
      this.marcarVisto(c);
    }
  }

  toggleFavorito(contenido: ContenidoFront, ev?: Event): void {
    ev?.stopPropagation(); // no reproducir al pulsar el corazón
    if (!contenido?.id) return;

    const userId = this.USE_MOCK ? 'mock-user-1' : this.getLoggedUserId();
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

    if (this.USE_MOCK) {
      this.favLocks.delete(lockKey);
      return;
    }

    const req$ = estabaFavorito
      ? this.contenidosService.removeFavorito(NuserId!, contenido.id)
      : this.contenidosService.addFavorito(userId!, contenido.id);

    req$.pipe(finalize(()=> this.favLocks.delete(lockKey)))
      .subscribe({
        next: () => {},
        error: (err) => {
          console.error('Error favorito:', err);
          // rollback
          contenido.favorito = estabaFavorito;
          if (estabaFavorito) {
            if (!this.favoritos.some(f => f.id === contenido.id)) this.favoritos.unshift(contenido);
          } else {
            this.favoritos = this.favoritos.filter(f => f.id !== contenido.id);
          }
          alert('No se pudo actualizar favorito. Inténtalo de nuevo.');
        }
      });
  }

  /** Marca visto y lo empuja al historial de sesión (y opcionalmente al backend). */
  marcarVisto(contenido: ContenidoFront): void {
    contenido.visto = true;
    if (!this.historialSesion.some(c => c.id === contenido.id)) {
      this.historialSesion.push(contenido);
    }

    if (!this.USE_MOCK) {
      const userId = this.getLoggedUserId();
      if (userId) {
        // this.contenidosService.addHistorial(userId, contenido.id).subscribe({ next:()=>{}, error:()=>{} });
      }
    }
  }

  onCardKeydown(ev: KeyboardEvent, c: ContenidoFront) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.playContenido(c);
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
