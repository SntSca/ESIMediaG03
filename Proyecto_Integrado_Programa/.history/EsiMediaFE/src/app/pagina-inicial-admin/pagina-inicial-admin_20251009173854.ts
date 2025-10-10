import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { UsersService } from '../users'; // ✅ asegúrate que el path sea correcto

// 🔹 Definimos una interfaz local para el front
interface UserFront {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  tema?: string;
  bloqueado?: boolean;
  foto?: string | null;
}

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit {
  public readonly FILES_BASE = window.location.origin;
  userName = 'Admin Principal';
  userEmail = 'admin@netflixpanel.com';
  userRole = 'Administrador';
  userInitials = this.getInitials(this.userName);
  userFotoUrl: string | null = null;

  modalAbierto = false;
  usuarioSeleccionado: UserFront | null = null;

  // Filtros de búsqueda
  filtros = {
    fecha: '',
    nombre: '',
    tema: '',
    bloqueado: '',
    ordenar: 'fecha'
  };

  // Estado de carga y error
  loading = false;
  errorMsg = '';

  // Lista de usuarios
  usuarios: UserFront[] = [];
  usuariosFiltrados: UserFront[] = [];

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
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
        this.usuarios = data.map((u: any) => ({
          id: u.id,
          nombre: u.nombre || u.fullName || u.username || 'Sin nombre',
          email: u.email || 'Sin email',
          rol: u.role || u.rol || 'Desconocido',
          tema: u.tema || 'General',
          bloqueado: u.bloqueado ?? false
        }));

        this.usuariosFiltrados = [...this.usuarios];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al listar usuarios:', err);
        this.errorMsg = 'No se pudieron cargar los usuarios.';
        this.loading = false;
      }
    });
  }

  /** 🔹 Getter para mostrar usuarios filtrados */
  get usuariosMostrar(): UserFront[] {
    return this.usuariosFiltrados;
  }

  getInitials(nombre: string): string {
    return nombre
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }

  aplicarFiltros(): void {
    const { nombre, tema, bloqueado } = this.filtros;
    this.usuariosFiltrados = this.usuarios.filter(u => {
      const coincideNombre = !nombre || u.nombre.toLowerCase().includes(nombre.toLowerCase());
      const coincideBloqueo =
        bloqueado === '' ||
        (bloqueado === 'si' && u.bloqueado) ||
        (bloqueado === 'no' && !u.bloqueado);
      return coincideNombre  && coincideBloqueo;
    });
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
