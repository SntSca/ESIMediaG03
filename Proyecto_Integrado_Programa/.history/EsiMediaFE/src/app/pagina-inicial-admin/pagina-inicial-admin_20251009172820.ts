import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { UsersService } from '../users'; // ✅ Asegúrate de que el path sea correcto
import { Usuario } from '../users'; // 

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin implements OnInit {

  // Datos del usuario logueado (navbar)
  userName = 'Admin Principal';
  userEmail = 'admin@netflixpanel.com';
  userRole = 'Administrador';
  userInitials = this.getInitials(this.userName);

  // Estado del modal
  modalAbierto = false;
  usuarioSeleccionado: Usuario | null = null;

  // Filtros de búsqueda
  filtros = {
    fecha: '',
    nombre: '',
    tema: '',
    bloqueado: '',
    ordenar: 'fecha'
  };

  // Estado de carga
  loading = false;
  errorMsg = '';

  // Lista de usuarios
  usuarios: Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  /** 🔹 Obtiene los usuarios desde el backend */
  cargarUsuarios(): void {
    this.loading = true;
    this.errorMsg = '';

    this.usersService.listarUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.usuariosFiltrados = [...this.usuarios];
        this.loading = false;
        console.log('Usuarios cargados:', data);
      },
      error: (err) => {
        console.error('Error al listar usuarios:', err);
        this.errorMsg = 'No se pudieron cargar los usuarios.';
        this.loading = false;
      }
    });
  }

  get usuariosMostrar(): Usuario[] {
    return this.usuariosFiltrados;
  }

  getInitials(nombre: string): string {
    return nombre.split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }

  aplicarFiltros(): void {
    const { nombre, tema, bloqueado } = this.filtros;
    this.usuariosFiltrados = this.usuarios.filter(u => {
      const coincideNombre = !nombre || u.nombre.toLowerCase().includes(nombre.toLowerCase());
      const coincideTema = !tema || u.tema.toLowerCase() === tema.toLowerCase();
      const coincideBloqueo =
        bloqueado === '' ||
        (bloqueado === 'si' && u.bloqueado) ||
        (bloqueado === 'no' && !u.bloqueado);
      return coincideNombre && coincideTema && coincideBloqueo;
    });
  }

  consultar(usuario: Usuario): void {
    this.usuarioSeleccionado = usuario;
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.usuarioSeleccionado = null;
  }

  bloquear(usuario: Usuario): void {
    usuario.bloqueado = !usuario.bloqueado;
    alert(`Usuario ${usuario.nombre} ${usuario.bloqueado ? 'bloqueado' : 'desbloqueado'}`);
  }

  editar(usuario: Usuario | null): void {
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
