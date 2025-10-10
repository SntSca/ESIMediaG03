import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';


interface Usuario {
  iniciales: string;
  nombre: string;
  email: string;
  rol: string;
  tema: string;
  bloqueado: boolean;
}

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin {
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

  // Lista base de usuarios simulados
  usuarios: Usuario[] = [
    { iniciales: 'JP', nombre: 'Juan Pérez', email: 'juan@correo.com', rol: 'Editor', tema: 'Tecnología', bloqueado: false },
    { iniciales: 'MS', nombre: 'María Sánchez', email: 'maria@correo.com', rol: 'Moderador', tema: 'Educación', bloqueado: false },
    { iniciales: 'LC', nombre: 'Luis Castillo', email: 'luis@correo.com', rol: 'Usuario', tema: 'Salud', bloqueado: true },
    { iniciales: 'AR', nombre: 'Ana Ruiz', email: 'ana@correo.com', rol: 'Usuario', tema: 'Tecnología', bloqueado: false },
  ];

  // Copia filtrada para mostrar en tabla
  usuariosFiltrados: Usuario[] = [...this.usuarios];

  constructor() {}
  
  getInitials(nombre: string): string {
    return nombre.split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }
  
  aplicarFiltros(form: any): void {
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

  /** Cierra el modal */
  cerrarModal(): void {
    this.modalAbierto = false;
    this.usuarioSeleccionado = null;
  }

  /** Bloquea o desbloquea un usuario */
  bloquear(usuario: Usuario): void {
    usuario.bloqueado = !usuario.bloqueado;
    alert(`Usuario ${usuario.nombre} ${usuario.bloqueado ? 'bloqueado' : 'desbloqueado'}`);
  }

  /** Edita un usuario (acción simulada) */
  editar(usuario: Usuario | null): void {
    if (!usuario) return;
    alert(`Editar usuario: ${usuario.nombre}`);
  }

  /** Cierra la sesión del usuario */
  cerrarSesion(): void {
    const confirmacion = confirm('¿Seguro que deseas cerrar sesión?');
    if (confirmacion) {
      // Aquí podrías limpiar tokens o redirigir
      console.log('Sesión cerrada');
      alert('Sesión cerrada correctamente.');
    }
  }

  /** Getter para que la tabla use la lista filtrada */
  get usuariosMostrar(): Usuario[] {
    return this.usuariosFiltrados;
  }
}
