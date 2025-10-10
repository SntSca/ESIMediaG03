import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { UsersService } from '../users'; // ✅ asegúrate que el path sea correcto
// import { API_BASE_URL } from '../../app.config'; // ⬅️ si lo tienes, mejor usarlo

// 🔹 Definimos una interfaz local para el front
interface UserFront {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  bloqueado?: boolean;
  foto?: string | null;           // ✅ ruta que viene del backend
  vip?: boolean;                  // ✅ NUEVO
  alias?: string | null;          // ✅ NUEVO
  fechaNac?: string | null;       // ✅ NUEVO (ISO o 'YYYY-MM-DD')
}

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit {

  // 🔧 Base para ficheros/estáticos (ajusta a tu backend)
  // public readonly FILES_BASE = `${API_BASE_URL}`; // si tienes una constante global
  public readonly FILES_BASE = window.location.origin; // fallback: mismo host que el front

  // Datos del usuario logueado (navbar)
  userName = 'Admin Principal';
  userEmail = 'admin@netflixpanel.com';
  userRole = 'Administrador';
  userInitials = this.getInitials(this.userName);
  userFotoUrl: string | null = null; // ✅ si quieres mostrar foto del logueado

  // Estado del modal
  modalAbierto = false;
  usuarioSeleccionado: UserFront | null = null;

  // Filtros de búsqueda
  filtros = {
    fecha: '',
    nombre: '',
    tema: '',
    bloqueado: '',
    ordenar: 'fecha' // fecha | nombre | rol | vip
  };

  // Estado de carga y error
  loading = false;
  errorMsg = '';

  // Lista de usuarios
  usuarios: UserFront[] = [];
  usuariosFiltrados: UserFront[] = [];

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    // Si tienes la sesión guardada con foto del logueado, setéala aquí:
    const meRaw = localStorage.getItem('user');
    if (meRaw) {
      try {
        const me = JSON.parse(meRaw);
        if (me?.foto) this.userFotoUrl = this.getPhotoUrl(me.foto);
        if (me?.nombre) {
          this.userName = me.nombre;
          this.userInitials = this.getInitials(this.userName);
        }
        if (me?.email) this.userEmail = me.email;
        if (me?.role || me?.rol) this.userRole = (me.role || me.rol);
      } catch { /* noop */ }
    }
    this.cargarUsuarios();
  }

  /** 🔹 Carga los usuarios desde el backend */
  cargarUsuarios(): void {
    this.loading = true;
    this.errorMsg = '';

    this.usersService.listarUsuarios().subscribe({
      next: (data) => {
        // data debe ser un array de usuarios del backend
        console.log('Usuarios recibidos del backend:', data);

        // Normalizamos por si el backend tiene campos diferentes
        this.usuarios = (Array.isArray(data) ? data : []).map((u: any) => {
          const foto: string | null = u.foto ?? null; // ⬅️ tal cual venga del back
          const vip: boolean = !!u.vip;
          const alias: string | null = (u.alias ?? null);
          // admitir LocalDate, ISO o Date -> lo dejamos como string si existe
          const fechaNac: string | null = u.fechaNac
            ? (typeof u.fechaNac === 'string'
                ? u.fechaNac
                : (u.fechaNac?.toString?.() ?? null))
            : null;

          return {
            id: u.id,
            nombre: u.nombre || u.fullName || u.username || 'Sin nombre',
            email: u.email || 'Sin email',
            rol: u.role || u.rol || 'Desconocido',
            tema: u.tema || 'General',
            bloqueado: (u.bloqueado ?? u.blocked ?? false),
            foto,
            vip,
            alias,
            fechaNac
          } as UserFront;
        });

        this.usuariosFiltrados = [...this.usuarios];
        this.aplicarFiltros(); // aplica filtros + orden si hay valores
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al listar usuarios:', err);
        this.errorMsg = 'No se pudieron cargar los usuarios.';
        this.loading = false;
      }
    });
  }

  /** 🔹 Convierte rutas relativas a absolutas; si ya viene http/https o data: la deja tal cual */
  getPhotoUrl(path?: string | null): string | null {
    if (!path) return null;
    const p = String(path).trim();
    if (!p) return null;
    // Si es data URL o absoluta, se respeta
    if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://')) return p;
    // Si es relativa, la pegamos a la base (ajusta FILES_BASE según tu back: ej. `${API_BASE_URL}`)
    if (p.startsWith('/')) return `${this.FILES_BASE}${p}`;
    return `${this.FILES_BASE}/${p}`;
  }

  /** 🔹 Fallback de imagen: si falla la carga, ocultamos <img> y mostramos iniciales */
  onImgError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
      const holder = img.nextElementSibling as HTMLElement;
      if (holder) holder.style.display = 'grid';
    }
  }

  /** 🔹 Getter para mostrar usuarios filtrados */
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

    // 1) Filtrado básico
    let lista = this.usuarios.filter(u => {
      const coincideNombre = !nombre || u.nombre.toLowerCase().includes(nombre.toLowerCase());
      const coincideBloqueo =
        bloqueado === '' ||
        (bloqueado === 'si' && !!u.bloqueado) ||
        (bloqueado === 'no' && !u.bloqueado);
      return coincideNombre && coincideBloqueo;
    });

    // 2) Orden opcional
    switch (ordenar) {
      case 'nombre':
        lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case 'rol':
        lista = [...lista].sort((a, b) => (a.rol || '').localeCompare(b.rol || ''));
        break;
      case 'vip':
        // VIPs primero
        lista = [...lista].sort((a, b) => Number(!!b.vip) - Number(!!a.vip));
        break;
      case 'fecha':
      default:
        // Orden por fechaNac descendente si hay (más recientes primero), dejando vacíos al final
        lista = [...lista].sort((a, b) => {
          const ta = a.fechaNac ? Date.parse(a.fechaNac) : NaN;
          const tb = b.fechaNac ? Date.parse(b.fechaNac) : NaN;
          if (isNaN(ta) && isNaN(tb)) return 0;
          if (isNaN(ta)) return 1;
          if (isNaN(tb)) return -1;
          return tb - ta; // desc
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
      console.log('Sesión cerrada');
      alert('Sesión cerrada correctamente.');
    }
  }
}
