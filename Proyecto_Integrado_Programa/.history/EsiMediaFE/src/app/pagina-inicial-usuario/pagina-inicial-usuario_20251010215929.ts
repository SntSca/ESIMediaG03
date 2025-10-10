import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario {
  // Info de usuario dummy (ajústalo si quieres)
  userName = 'Usuario';
  userEmail = 'usuario@ejemplo.com';
  userInitials = 'U';
  selectedTab: 'ALL' | 'AUDIO' | 'VIDEO' | 'HIST' | 'FAV' = 'ALL';
  showTodosConstruction = false;
  filtros = {
    titulo: '',
    tipo: '' as '' | 'AUDIO' | 'VIDEO',
    vip: '' as '' | 'si' | 'no',
    visible: '' as '' | 'si' | 'no',
    tagIncluye: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'vip' | 'visible'
  };
}
