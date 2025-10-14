import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  nombre: string = '';
  apellidos: string = '';
  email: string = '';
  alias: string = '';
  fechaNac: string = '';
  role: string = '';
  pwd: string = '';
  pwd2: string = '';
  vip: boolean = false;
  termsAccepted: boolean = false;
  fechaInvalida: boolean = false;
  pwdMismatch: boolean = false;
  pwdIssues: string[] = [];
  pwdScore: number = 0;
  pwdStrengthLabel: string = '';
  isLoading: boolean = false;
  showPwd: boolean = false;
  showPwd2: boolean = false;

  showAvatarModal: boolean = false;
  selectedAvatar: string | null = null;

  emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  avatars: string[] = [
    'assets/Hasta_el_ultimo_HOmbre.png',
    'assets/El_Joker.png',
    'assets/Piratas_del_caribe.png',
    'assets/Avatar.png',
    'assets/Garfield.png',
    'assets/Mikaela.jpeg'
  ];

  /** ---------- MÉTODOS DE VALIDACIÓN ---------- */

  onSubmit(form: NgForm) {
    if (form.invalid || this.hasErrors()) return;

    this.isLoading = true;

    setTimeout(() => {
      this.isLoading = false;
      alert(`✅ Usuario ${this.nombre} registrado correctamente.`);
      form.resetForm();
      this.selectedAvatar = null;
      this.pwdIssues = [];
      this.pwdStrengthLabel = '';
      this.pwdScore = 0;
    }, 1500);
  }

  hasErrors(): boolean {
    this.validateDate();
    this.checkPasswords();
    this.evaluatePasswordStrength();
    return (
      this.fechaInvalida ||
      this.pwdMismatch ||
      this.pwdIssues.length > 0 ||
      !this.termsAccepted
    );
  }

  /** ---------- FECHA ---------- */
  validateDate() {
    if (!this.fechaNac) {
      this.fechaInvalida = false;
      return;
    }
    const hoy = new Date();
    const fecha = new Date(this.fechaNac);
    this.fechaInvalida = fecha > hoy;
  }

  /** ---------- CONTRASEÑAS ---------- */
  checkPasswords() {
    this.pwdMismatch = this.pwd !== this.pwd2 && this.pwd2.length > 0;
    this.evaluatePasswordStrength();
  }

  evaluatePasswordStrength() {
    const p = this.pwd;
    this.pwdIssues = [];
    this.pwdScore = 0;

    if (p.length < 8) this.pwdIssues.push('Debe tener al menos 8 caracteres');
    if (!/[A-Z]/.test(p)) this.pwdIssues.push('Debe incluir una letra mayúscula');
    if (!/[a-z]/.test(p)) this.pwdIssues.push('Debe incluir una letra minúscula');
    if (!/[0-9]/.test(p)) this.pwdIssues.push('Debe incluir un número');
    if (!/[\W_]/.test(p)) this.pwdIssues.push('Debe incluir un símbolo');

    const score = 5 - this.pwdIssues.length;
    this.pwdScore = Math.max(1, score);

    const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
    this.pwdStrengthLabel = labels[this.pwdScore - 1];
  }

  /** ---------- VISIBILIDAD ---------- */
  togglePwd() {
    this.showPwd = !this.showPwd;
  }

  togglePwd2() {
    this.showPwd2 = !this.showPwd2;
  }

  /** ---------- AVATARES ---------- */
  toggleAvatarModal() {
    this.showAvatarModal = !this.showAvatarModal;
  }

  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.showAvatarModal = false;
  }
}
