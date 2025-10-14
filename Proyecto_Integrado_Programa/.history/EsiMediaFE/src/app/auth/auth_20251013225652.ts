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
    { src: 'assets/Garfield.png', titulo: 'Garfield', descripcion: 'Las divertidas aventuras del gato más famoso del mundo.' },
    { src: 'assets/Mikaela.jpeg', titulo: 'Mikaela', descripcion: 'Una historia conmovedora sobre amistad y superación.' }
  ];

  currentIndex = 0;
  menuOpen = false;
  private intervalId: any;

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.fotos.length) % this.fotos.length;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.fotos.length;
  }

  constructor(public router: Router) {
    // Autoplay cada 3 segundos
    this.intervalId = setInterval(() => this.next(), 3000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
