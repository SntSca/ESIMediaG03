// pagina-inicial-usuario.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {
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

  readOnly = false;
  fromAdmin = false;

  constructor(private readonly router: Router, private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    const qModo = (this.route.snapshot.queryParamMap.get('modoLectura') || '').toLowerCase();
    const qFrom = (this.route.snapshot.queryParamMap.get('from') || '').toLowerCase();

    const stateFrom = (history.state?.fromAdmin === true);
    const lsReadOnly = localStorage.getItem('users_readonly_mode') === '1';
    const lsFromAdmin = localStorage.getItem('users_readonly_from_admin') === '1';

    this.readOnly =
      ['1', 'true', 'si', 'yes'].includes(qModo) ||
      lsReadOnly ||
      location.pathname.includes('/usuarioReadOnly');

    this.fromAdmin =
      qFrom === 'admin' ||
      stateFrom ||
      lsFromAdmin;

    if (this.readOnly && this.fromAdmin) {
      localStorage.setItem('users_readonly_mode', '1');
      localStorage.setItem('users_readonly_from_admin', '1');
    }
  }

  salirModoLectura(): void {
    localStorage.removeItem('users_readonly_mode');
    localStorage.removeItem('users_readonly_from_admin');
    this.router.navigateByUrl('/admin');
  }
  CerrarSesion(): void {
    localStorage.removeItem('users_readonly_mode');
    localStorage.removeItem('users_readonly_from_admin');
    this.router.navigateByUrl('/auth/login');
  }
}
