import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-pagina-inicial-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './pagina-inicial-admin.html',
  styleUrls: ['./pagina-inicial-admin.css']
})
export class PaginaInicialAdmin {
  public readonly FILES_BASE = window.location.origin;

  userName = 'Admin Principal';
  userEmail = 'esiMedia@esimedia.com';
  userRole = 'Administrador';
  userInitials = 'AP';
  userFotoUrl: string | null = null;
  selectedTab: 'ALL' | 'USUARIOS' = 'ALL';
  showTodosConstruction = false;
  filtros = {
    nombre: '',
    bloqueado: '',
    ordenar: 'fecha' as 'fecha' | 'nombre' | 'rol' | 'vip'
  };
}
