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
  historial: ContenidoFront[] = [];
  favoritos: ContenidoFront[] = [];

  // Pestañas principales y subpestañas
  selectedTab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV' = 'ALL';
  selectedSubTab: 'AUDIO' | 'VIDEO' | 'ALL' = 'ALL'; // en HIST/FAV usaremos solo AUDIO/VIDEO

  // Filtros superiores
  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };

  private favLocks = new Set<string>();

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

          // Cargar favoritos del usuario y marcarlos
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
              error: () => {
                this.aplicarFiltros();
              }
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

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  getEmoji(c: ContenidoFront){ return String(c.tipo).toUpperCase()==='AUDIO' ? '🎵' : '🎬'; }

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

  // Tabs
  setTab(tab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV'){
    this.selectedTab = tab;
    // Si entramos en Historial o Favoritos, mostramos subpestañas solo AUDIO/VIDEO y
    // arrancamos en AUDIO por defecto (como pediste, sin "Todos").
    if (tab === 'HIST' || tab === 'FAV') {
      this.selectedSubTab = 'AUDIO';
    } else {
      this.selectedSubTab = 'ALL';
    }
  }
  setSubTab(sub: 'AUDIO' | 'VIDEO'){ this.selectedSubTab = sub; }

  // Conjunto activo por pestaña + subpestaña
  get contenidosTab(): ContenidoFront[] {
    let base: ContenidoFront[] = [];
    switch (this.selectedTab) {
      case 'AUDIO': base = this.contenidosFiltrados.filter(c => String(c.tipo).toUpperCase()==='AUDIO'); break;
      case 'VIDEO': base = this.contenidosFiltrados.filter(c => String(c.tipo).toUpperCase()==='VIDEO'); break;
      case 'HIST':
        base = [...this.historial];
        base = base.filter(c => String(c.tipo).toUpperCase() === this.selectedSubTab);
        break;
      case 'FAV':
        base = [...this.favoritos];
        base = base.filter(c => String(c.tipo).toUpperCase() === this.selectedSubTab);
        break;
      case 'ALL':
      default:
        base = this.contenidosFiltrados;
        break;
    }
    return base;
  }

  // Carruseles (toman el conjunto activo)
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

  // Favoritos (sin boolean en API pública)
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
      ? this.contenidosService.removeFavorito(Number(userId), contenido.id)
      : this.contenidosService.addFavorito(Number(userId), contenido.id);

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

  marcarVisto(contenido: ContenidoFront): void {
    contenido.visto = true;
    if (!this.historial.some(c => c.id === contenido.id)) this.historial.push(contenido);
    // Persistencia opcional: service.setVisto(userId, contenido.id) ...
  }

  cerrarSesion(): void {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }
}
