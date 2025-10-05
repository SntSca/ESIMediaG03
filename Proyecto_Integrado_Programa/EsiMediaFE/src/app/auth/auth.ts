import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';  
import { Router } from '@angular/router';

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
export class Auth {
  fotos: string[] = [
    'assets/Hasta_el_ultimo_HOmbre.png',
    'assets/El_Joker.png',
    'assets/Piratas_del_caribe.png',
    'assets/Avatar.png',
    'assets/Garfield.png',
    'assets/Mikaela.jpeg'
  ];

  currentIndex = 0;
  menuOpen = false;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.fotos.length) % this.fotos.length;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.fotos.length;
  }

  //Luego cambiar a Login
  constructor(public router: Router) {}

  
}
