import { Component, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.html',
  styleUrls: ['./auth.css'],
  imports: [
    RouterModule,
    CommonModule,
    FormsModule
  ]
})
export class Auth implements OnDestroy {

  fotos: { src: string; titulo: string; descripcion: string }[] = [
    { src: 'assets/Hasta_el_ultimo_HOmbre.png', titulo: 'Hasta el Último Hombre', descripcion: 'Historia de valentía y sacrificio en la Segunda Guerra Mundial.' },
    { src: 'assets/El_Joker.png', titulo: 'Joker', descripcion: 'Un estudio profundo sobre el origen de un villano icónico.' },
    { src: 'assets/Piratas_del_caribe.png', titulo: 'Piratas del Caribe', descripcion: 'Aventuras épicas y piratas carismáticos en los mares del Caribe.' },
    { src: 'assets/Avatar.png', titulo: 'Avatar', descripcion: 'Un viaje visual al mundo de Pandora y su cultura Na’vi.' },
    { src: 'assets/Interstellar.png', titulo: 'Interstellar', descripcion: 'Exploración espacial y los límites del amor y el tiempo.' },
    { src: 'assets/Inception.png', titulo: 'Inception', descripcion: 'Sueños dentro de sueños y la mente humana como escenario.' },
    { src: 'assets/Avengers_Endgame.png', titulo: 'Avengers: Endgame', descripcion: 'La épica culminación de los héroes de Marvel.' },
    { src: 'assets/Titanic.png', titulo: 'Titanic', descripcion: 'Un romance imposible en medio del desastre histórico del Titanic.' }
  ];

  currentIndex = 0;
  menuOpen = false;

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.fotos.length) % this.fotos.length;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.fotos.length;
  }

  // Autoplay del carrusel
  constructor(public router: Router) {
    setInterval(() => this.next(), 5000); // Cambia cada 5 segundos
  }
}