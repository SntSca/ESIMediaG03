import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Contenidos } from '../contenidos';            // Service esperado
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
  fechaEstado?: string | null;     // ISO string
  disponibleHasta?: string | null; // ISO string
  restringidoEdad: boolean;
  tipo: 'AUDIO' | 'VIDEO' | string;
  favorito?: boolean;
  visto?: boolean;
}

interface RailSection {
  key: string;             // clave normalizada: "drama"
  title: string;           // visible: "Drama"
  items: ContenidoFront[]; // contenidos del tema
}

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {

  // ===== Config de demo =====
  // Ponlo a false para usar tu backend real.
  private readonly USE_MOCK = true;

  // ===== Inyección de servicios =====
  private readonly contenidosService = inject(Contenidos);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ===== Usuario =====
  userName = '';
  userEmail = '';
  userInitials = '';
  private loggedUser: UserDto | null = null;

  // ===== Estado =====
  loading = false;
  errorMsg = '';

  // ===== Datos =====
  contenidos: ContenidoFront[] = [];
  contenidosFiltrados: ContenidoFront[] = [];
  historial: ContenidoFront[] = [];
  favoritos: ContenidoFront[] = [];

  // ===== Tabs =====
  selectedTab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV' = 'ALL';
  selectedSubTab: 'AUDIO' | 'VIDEO' | 'ALL' = 'ALL'; // En HIST/FAV solo AUDIO/VIDEO

  // ===== Filtros =====
  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };

  // ===== Control para evitar doble click en corazón =====
  private favLocks = new Set<string>();

  // ===== Parámetros de railes por tema =====
  private readonly RAILS_MAX = 12;
  private readonly RAIL_ITEMS_MAX = 20;
  private readonly MIN_ITEMS_PER_RAIL = 2;
  private readonly MULTI_ASSIGN = true; // un contenido aparece en todos sus tags

  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);

    if (this.USE_MOCK) {
      this.cargarMock();
      return;
    }

    this.cargarContenidos();
  }

  // ================= Usuario =================
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

  // ================= Backend =================
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
            favorito: !!c.favorito,
            visto: !!c.visto
          }));

          this.contenidos = normalizados.filter(c => c.visible);
          this.contenidosFiltrados = [...this.contenidos];

          const userId = this.getLoggedUserId();
          if (userId) {
            this.contenidosService.getFavoritos(Number(userId)).subscribe({
              next: (idsFav) => {
                const favSet = new Set(idsFav ?? []);
                this.contenidos.forEach(c => c.favorito = favSet.has(c.id));
                this.favoritos = this.contenidos.filter(c => c.favorito);
                this.historial = this.contenidos.filter(c => c.visto);
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

  // ================= Mock para ver la UI =================
  cargarMock(): void {
    const now = new Date();
    const isoAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

    const mock: ContenidoFront[] = [
      {
        id: 'c001',
        titulo: 'Lo-Fi para estudiar',
        descripcion: 'Sesión relajante de lo-fi durante 2 horas para mantener el foco.',
        ficheroAudio: '/files/lofi.mp3',
        urlVideo: null,
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
        urlVideo: 'https://cdn.esim/video/abc123',
        tags: ['scifi', 'drama'],
        duracionMinutos: 14,
        resolucion: '1080p',
        vip: true,
        visible: true,
        fechaEstado: isoAgo(26),
        disponibleHasta: null,
        restringidoEdad: true,
        tipo: 'VIDEO',
        favorito: true,
        visto: true
      },
      {
        id: 'c003',
        titulo: 'Podcast Seguridad AppSec #27',
        descripcion: 'Repasamos OWASP Top 10 y casos reales en microservicios.',
        ficheroAudio: '/files/appsec27.mp3',
        urlVideo: null,
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
        descripcion: 'Un viaje visual por los ecosistemas de montaña más singulares.',
        ficheroAudio: null,
        urlVideo: 'https://cdn.esim/video/nebula999',
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
        ficheroAudio: '/files/jazz-night.mp3',
        urlVideo: null,
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
        descripcion: 'Crea transiciones y micro-interacciones en Angular paso a paso.',
        ficheroAudio: null,
        urlVideo: 'https://cdn.esim/video/ng-anim',
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
        descripcion: 'Una historia de amor y guerra en el siglo XIX.',
        ficheroAudio: null,
        urlVideo: 'https://cdn.esim/video/drama-epoca',
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
        ficheroAudio: '/files/focus-beats.mp3',
        urlVideo: null,
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
    this.historial = this.contenidos.filter(c => c.visto);

    this.contenidosFiltrados = [...this.contenidos];
    this.aplicarFiltros();
  }

  // ================= Utilidades =================
  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  getEmoji(c: ContenidoFront){ return String(c.tipo).toUpperCase()==='AUDIO' ? '🎵' : '🎬'; }

  private normTema(raw: string): string {
    return (raw || '')
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .trim();
  }
  private titleCase(s: string): string {
    const clean = (s || '').trim();
    return clean ? clean[0].toUpperCase() + clean.slice(1) : clean;
  }

  // ================= Filtros / Tabs =================
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

  setTab(tab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV'){
    this.selectedTab = tab;
    this.selectedSubTab = (tab === 'HIST' || tab === 'FAV') ? 'AUDIO' : 'ALL';
  }
  setSubTab(sub: 'AUDIO' | 'VIDEO'){ this.selectedSubTab = sub; }

  get contenidosTab(): ContenidoFront[] {
    let base: ContenidoFront[] = [];
    switch (this.selectedTab) {
      case 'AUDIO': base = this.contenidosFiltrados.filter(c => String(c.tipo).toUpperCase()==='AUDIO'); break;
      case 'VIDEO': base = this.contenidosFiltrados.filter(c => String(c.tipo).toUpperCase()==='VIDEO'); break;
      case 'HIST':
        base = this.historial.filter(c => String(c.tipo).toUpperCase() === this.selectedSubTab);
        break;
      case 'FAV':
        base = this.favoritos.filter(c => String(c.tipo).toUpperCase() === this.selectedSubTab);
        break;
      case 'ALL':
      default:
        base = this.contenidosFiltrados;
        break;
    }
    return base;
  }

  // ================= Rails por tema (dinámicos) =================
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
      .filter(sec => sec.items.length >= this.MIN_ITEMS_PER_RAIL);

    // Ordena railes por nº de items (desc)
    sections.sort((a, b) => b.items.length - a.items.length);

    return sections.slice(0, this.RAILS_MAX);
  }

  trackByKey = (_: number, sec: RailSection) => sec.key;

  // ================= Carrusel scroll =================
  scrollCarousel(el: HTMLElement, dir: 'prev'|'next'){
    if (!el) return;
    const delta = el.clientWidth * 0.9 * (dir === 'next' ? 1 : -1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  // ================= Favoritos =================
  toggleFavorito(contenido: ContenidoFront): void {
    if (!contenido?.id) return;

    const u: any = this.loggedUser;
    const userId: string | null = this.USE_MOCK ? 'mock-user-1' : (u?.id ?? u?._id ?? null);
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
      // demo: no llamamos backend
      this.favLocks.delete(lockKey);
      return;
    }

    const req$ = estabaFavorito
      ? this.contenidosService.removeFavorito(Number(userId), Number(contenido.id))
      : this.contenidosService.addFavorito(Number(userId), Number(contenido.id));

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

  // ================= Historial (local) =================
  marcarVisto(contenido: ContenidoFront): void {
    contenido.visto = true;
    if (!this.historial.some(c => c.id === contenido.id)) this.historial.push(contenido);
    // Persistencia opcional: service.setVisto(userId, contenido.id) ...
  }

  // ================= Sesión =================
  cerrarSesion(): void {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }
}
