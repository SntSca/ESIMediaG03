import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { UsersService } from '../users';
import { AuthService } from '../auth/auth.service';
import { UserDto } from '../auth/models';

// 🔹 Interfaz local para la tabla del front
interface UserFront {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  bloqueado?: boolean;
  foto?: string | null;
  vip?: boolean;
  alias?: string | null;
  fechaNac?: string | null; // ISO o 'YYYY-MM-DD'
}

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit {

  // 🔧 Base para ficheros/estáticos (ajusta a tu backend si procede)
  public readonly FILES_BASE = window.location.origin;

  // 🧑‍💼 Datos del usuario logueado (navbar)
  userName = 'Admin Principal';
  userEmail = 'admin@netflixpanel.com';
  userRole = 'Administrador';
  userInitials = this.getInitials(this.userName);
  userFotoUrl: string | null = null;

  // Referencia al usuario logueado en crudo (para exclusión en la tabla)
  private loggedUser: UserDto | null = null;

  // Estado del modal
  modalAbierto = false;
  usuarioSeleccionado: UserFront | null = null;

  // Filtros de búsqueda
  filtros = {
    fecha: '',
    nombre: '',
    bloqueado: '',
    ordenar: 'fecha' as 'fecha' | 'nombre' | 'rol' | 'vip'
  };

  // Estado de carga y error
  loading = false;
  errorMsg = '';

  // Lista de usuarios
  usuarios: UserFront[] = [];
  usuariosFiltrados: UserFront[] = [];

  // Servicios
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router); 


  ngOnInit(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();

    this.setLoggedUser(stateUser ?? sessionUser ?? null);
    this.cargarUsuarios();
  }

  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;

    if (!user) return;

    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;
    this.userRole = this.mapRoleToLabel(user.role);
    this.userInitials = this.getInitials(this.userName);


    const foto = (user as any)?.foto as string | null | undefined;
    if (foto) this.userFotoUrl = this.getPhotoUrl(foto);
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

  cargarUsuarios(): void {
    this.loading = true;
    this.errorMsg = '';

    this.usersService.listarUsuarios().subscribe({
      next: (data) => {
        const list: any[] = Array.isArray(data) ? data : [];

        // 1) Normaliza cada usuario
        const normalizados = list.map((u: any) => {
          const foto: string | null = u.foto ?? null;
          const vip: boolean = !!u.vip;
          const alias: string | null = u.alias ?? null;
          const fechaNac: string | null = u.fechaNac
            ? (typeof u.fechaNac === 'string' ? u.fechaNac : (u.fechaNac?.toString?.() ?? null))
            : null;

          const id: string = u.id ?? u._id ?? '';
          const nombre: string = u.nombre || u.fullName || u.username || 'Sin nombre';
          const email: string = u.email || 'Sin email';
          const rol: string = u.role || u.rol || 'Desconocido';
          const bloqueado: boolean = (u.bloqueado ?? u.blocked ?? false);

          return {
            id,
            nombre,
            email,
            rol,
            bloqueado,
            foto,
            vip,
            alias,
            fechaNac
          } as UserFront;
        });

        const myId = this.loggedUser?.id ?? null;
        const myEmail = (this.loggedUser?.email ?? '').toLowerCase();

        this.usuarios = normalizados.filter(u => {
          const idDiff = !myId || u.id !== myId;
          const emailDiff = !myEmail || (u.email || '').toLowerCase() !== myEmail;
          return idDiff && emailDiff;
        });

        this.usuariosFiltrados = [...this.usuarios];
        this.aplicarFiltros();

        this.loading = false;
      },
      error: (err) => {
        console.error('Error al listar usuarios:', err);
        this.errorMsg = 'No se pudieron cargar los usuarios.';
        this.loading = false;
      }
    });
  }

  getPhotoUrl(path?: string | null): string | null {
    if (!path) return null;
    const p = String(path).trim();
    if (!p) return null;
    if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://')) return p;
    if (p.startsWith('/')) return `${this.FILES_BASE}${p}`;
    return `${this.FILES_BASE}/${p}`;
  }

  onImgError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
      const holder = img.nextElementSibling as HTMLElement;
      if (holder) holder.style.display = 'grid';
    }
  }

  get usuariosMostrar(): UserFront[] {
    return this.usuariosFiltrados;
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe
      .split(/\s+/)
      .filter(Boolean)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }

  aplicarFiltros(): void {
    const { nombre, bloqueado, ordenar } = this.filtros;

    let lista = this.usuarios.filter(u => {
      const coincideNombre = !nombre || u.nombre.toLowerCase().includes(nombre.toLowerCase());
      const coincideBloqueo =
        bloqueado === '' ||
        (bloqueado === 'si' && !!u.bloqueado) ||
        (bloqueado === 'no' && !u.bloqueado);
      return coincideNombre && coincideBloqueo;
    });

    switch (ordenar) {
      case 'nombre':
        lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case 'rol':
        lista = [...lista].sort((a, b) => (a.rol || '').localeCompare(b.rol || ''));
        break;
      case 'vip':
        lista = [...lista].sort((a, b) => Number(!!b.vip) - Number(!!a.vip));
        break;
      case 'fecha':
      default:
        lista = [...lista].sort((a, b) => {
          const ta = a.fechaNac ? Date.parse(a.fechaNac) : NaN;
          const tb = b.fechaNac ? Date.parse(b.fechaNac) : NaN;
          if (isNaN(ta) && isNaN(tb)) return 0;
          if (isNaN(ta)) return 1;
          if (isNaN(tb)) return -1;
          return tb - ta;
        });
        break;
    }

    this.usuariosFiltrados = lista;
  }

  consultar(usuario: UserFront): void {
    this.usuarioSeleccionado = usuario;
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.usuarioSeleccionado = null;
  }

  bloquear(usuario: UserFront): void {
    usuario.bloqueado = !usuario.bloqueado;
    alert(`Usuario ${usuario.nombre} ${usuario.bloqueado ? 'bloqueado' : 'desbloqueado'}`);
  }

  editar(usuario: UserFront | null): void {
    if (!usuario) return;
    alert(`Editar usuario: ${usuario.nombre}`);
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
