import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';

// TODO: sustituye este import por tu servicio real de contenidos
// import { ContenidosService } from '../contenidos/contenidos.service';

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
  fechaEstado?: string | null;        // ISO string si viene del BE
  disponibleHasta?: string | null;    // ISO string si viene del BE
  restringidoEdad: boolean;
  tipo: 'AUDIO' | 'VIDEO' | string;
}

@Component({
  selector: 'app-pagina-inicial-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-gestor.html',
  styleUrls: ['./pagina-inicial-gestor.css']
})
export class PaginaInicialGestor implements OnInit {

  userName = 'Gestor de Contenido';
  userEmail = 'gestor@esimedia.com';
  userRole = 'Gestor de contenido';
  userInitials = this.getInitials(this.userName);

  private loggedUser: UserDto | null = null;

  modalAbierto = false;
  contenidoSeleccionado: ContenidoFront | null = null;

  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    restringido: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };

  loading = false;
  errorMsg = '';

  contenidos: ContenidoFront[] = [];
  contenidosFiltrados: ContenidoFront[] = [];

  // private readonly contenidosService = inject(ContenidosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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

  cargarContenidos(): void {
    this.loading = true;
    this.errorMsg = '';

    this.user.listarContenidos().subscribe({
      next: (data) => {
        const list: any[] = Array.isArray(data) ? data : [];

        // 1️⃣ Normaliza cada contenido
        const normalizados = list.map((c: any) => {
          const id: string = c.id ?? c._id ?? '';
          const titulo: string = c.titulo || c.title || 'Sin título';
          const descripcion: string = c.descripcion || c.description || '';
          const autor: string = c.autor || c.author || 'Anónimo';
          const categoria: string = c.categoria || c.category || 'Sin categoría';
          const fecha: string | null = c.fechaPublicacion
            ? (typeof c.fechaPublicacion === 'string'
                ? c.fechaPublicacion
                : (c.fechaPublicacion?.toString?.() ?? null))
            : null;
          const destacado: boolean = !!(c.destacado ?? c.featured ?? false);
          const imagen: string | null = c.imagen ?? c.image ?? null;
          const visible: boolean = !(c.oculto ?? c.hidden ?? false);

          return {
            id,
            titulo,
            descripcion,
            autor,
            categoria,
            fecha,
            destacado,
            imagen,
            visible
          } as ContenidoFront;
        });

        // 2️⃣ Filtra o ajusta según tu lógica (ejemplo: solo visibles)
        this.contenidos = normalizados.filter(c => c.visible);

        // 3️⃣ Copia inicial para filtros
        this.contenidosFiltrados = [...this.contenidos];

        // 4️⃣ Aplica filtros o búsqueda si los tienes
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


  private mapearYAplicar(listInput: any[]) {
    const list = Array.isArray(listInput) ? listInput : [];

    const normalizados: ContenidoFront[] = list.map((c: any) => {
      return {
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
        tipo: (c.tipo ?? 'VIDEO')
      } as ContenidoFront;
    });

    this.contenidos = normalizados;
    this.contenidosFiltrados = [...this.contenidos];
    this.aplicarFiltros();
    this.loading = false;
  }

  get contenidosMostrar(): ContenidoFront[] {
    return this.contenidosFiltrados;
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }

  aplicarFiltros(): void {
    const { titulo, tipo, vip, visible, restringido, tagIncluye, ordenar } = this.filtros;

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
      const coincideRestr =
        restringido === '' ||
        (restringido === 'si' && c.restringidoEdad) ||
        (restringido === 'no' && !c.restringidoEdad);
      const coincideTag =
        !tagIncluye ||
        c.tags.some(t => t.toLowerCase().includes(tagIncluye.toLowerCase()));

      return coincideTitulo && coincideTipo && coincideVip && coincideVisible && coincideRestr && coincideTag;
    });

    switch (ordenar) {
      case 'titulo':
        lista = [...lista].sort((a, b) => a.titulo.localeCompare(b.titulo));
        break;
      case 'vip':
        lista = [...lista].sort((a, b) => Number(!!b.vip) - Number(!!a.vip));
        break;
      case 'visible':
        lista = [...lista].sort((a, b) => Number(!!b.visible) - Number(!!a.visible));
        break;
      case 'fecha':
      default:
        lista = [...lista].sort((a, b) => {
          const ta = a.fechaEstado ? Date.parse(a.fechaEstado) : NaN;
          const tb = b.fechaEstado ? Date.parse(b.fechaEstado) : NaN;
          if (isNaN(ta) && isNaN(tb)) return 0;
          if (isNaN(ta)) return 1;
          if (isNaN(tb)) return -1;
          return tb - ta; // desc
        });
        break;
    }

    this.contenidosFiltrados = lista;
  }

  consultar(contenido: ContenidoFront): void {
    this.contenidoSeleccionado = contenido;
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.contenidoSeleccionado = null;
  }

  publicar(contenido: ContenidoFront): void {
    contenido.visible = !contenido.visible;
    alert(`Contenido "${contenido.titulo}" ${contenido.visible ? 'publicado' : 'despublicado'}`);
  }

  editar(contenido: ContenidoFront | null): void {
    if (!contenido) return;
    alert(`Editar contenido: ${contenido.titulo}`);
  }

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
