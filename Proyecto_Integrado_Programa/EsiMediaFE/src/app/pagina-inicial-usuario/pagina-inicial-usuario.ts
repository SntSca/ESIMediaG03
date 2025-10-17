import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto } from '../auth/models';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {

  // ======== SOLO LECTURA ========
  readOnly = false;
  fromAdmin = false;

  // ======== PERFIL/UI DATOS ========
  avatars: string[] = [
    'assets/avatars/avatar1.png',
    'assets/avatars/avatar2.png',
    'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png',
    'assets/avatars/avatar5.png',
    'assets/avatars/avatar6.png'
  ];

  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;

  userName = '';
  userEmail = '';
  userInitials = '';
  userAvatar: string | null = null;

  private loggedUser: UserDto | null = null;
  private userAliasActual = '';

  loading = false;
  errorMsg = '';
  okMsg: string | null = null;
  saving = false;
  editOpen = false;

  // ======== FORM MODEL ========
  model: {
    nombre?: string;
    apellidos?: string;
    alias?: string;
    fechaNac?: string;
    foto?: string;
    vip?: boolean;
  } = {};

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService
  ) {}

  // ===================== CICLO VIDA =====================
  ngOnInit(): void {
    // Solo-lectura (query params + localStorage + path)
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

    // Cargar usuario (state/localStorage) y luego perfil completo
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }

  // ===================== PERFIL =====================
  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;
    const nombre = user.nombre?.trim() || user.email.split('@')[0];
    this.userName = nombre;
    this.userEmail = user.email;

    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => {
        this.paintFromProfile(u);
        if (u.fotoUrl) {
          this.userAvatar = u.fotoUrl || null;
        } else {
          this.userInitials = this.getInitials(u.nombre);
        }
        this.cdr.markForCheck();
      },
      error: (_e: HttpErrorResponse) => {
        this.errorMsg = 'No se pudo cargar tu perfil';
        this.cdr.markForCheck();
      }
    });
  }

  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && parsed.role) return parsed as UserDto;
      return null;
    } catch {
      return null;
    }
  }

  private getLoggedUserId(): string | null {
    const u: any = this.loggedUser;
    return (u?.id ?? u?._id ?? null) as string | null;
  }

  salirModoLectura(): void {
    localStorage.removeItem('users_readonly_mode');
    localStorage.removeItem('users_readonly_from_admin');
    this.router.navigateByUrl('/admin');
  }

  // Nota: el HTML llama a "CerrarSesion()" (C mayúscula)
  CerrarSesion(): void {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      this.auth.logout?.();
      localStorage.removeItem('user');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  DarDeBaja(): void {
    if (confirm('¿Seguro que deseas darte de baja de la plataforma? Esta acción no se puede deshacer.')) {
      this.auth.darseBaja(this.userEmail).subscribe({
        next: (msg: string) => {
          alert(msg || 'Usuario eliminado correctamente');
          // Limpiar sesión
          this.auth.logout?.();
          localStorage.removeItem('user');
          sessionStorage.clear();
          this.router.navigateByUrl('/auth/login', { replaceUrl: true });
        },
        error: (err: any) => {
          console.error('Error al dar de baja:', err);
          const errorMsg = err?.error || err?.message || 'Error al eliminar usuario';
          alert(errorMsg);
        }
      });
    }
  }

  // ======== AVATARES / EDICIÓN PERFIL ========
  openAvatarModal() { 
    console.log('Opening avatar modal');
    this.showAvatarModal = true; 
  }
  
  closeAvatarModal() { 
    console.log('Closing avatar modal');
    this.showAvatarModal = false; 
  }

  selectAvatar(avatar: string) {
    console.log('Avatar selected:', avatar);
    this.selectedAvatar = avatar;
    this.foto = avatar;
    this.closeAvatarModal();
  }

  toggleEditar() {
    console.log('Toggle editar called, readOnly:', this.readOnly);
    if (this.readOnly) return;
    requestAnimationFrame(() => {
      this.editOpen = !this.editOpen;
      this.cdr.markForCheck();
    });
  }

  cancelarEditar() {
    console.log('Cancelar editar called');
    this.editOpen = false;
    this.cdr.markForCheck();
  }

  guardarCambios() {
    console.log('Guardar cambios called');
    if (this.readOnly) {
      console.log('Read-only mode, skipping save');
      return;
    }

    // Limpiar mensajes previos
    this.okMsg = null;
    this.errorMsg = '';
    this.saving = true;

    // 1) Alias: enviar solo si realmente cambió
    const aliasNuevo = (this.model?.alias ?? '').trim();
    const aliasAEnviar =
      this.userAliasActual &&
      aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, { sensitivity: 'accent' }) === 0
        ? undefined
        : (aliasNuevo || undefined);

    // 2) Foto priorizando avatar seleccionado
    const fotoSeleccionada = (this.selectedAvatar || this.foto || this.model?.foto || '').trim() || undefined;

    // 3) Construir payload
    const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
      email: this.userEmail,
      alias: aliasAEnviar,
      nombre: (this.model?.nombre ?? '').trim() || undefined,
      apellidos: (this.model?.apellidos ?? '').trim() || undefined,
      fechaNac: this.model?.fechaNac ? String(this.model.fechaNac).slice(0, 10) : undefined,
      vip: typeof this.model?.vip === 'boolean' ? this.model.vip : undefined,
      fotoUrl: fotoSeleccionada,
      foto: fotoSeleccionada
    };

    const payload = this.cleanPayload(raw);
    console.log('Payload to send:', payload);

    this.auth.putPerfil(payload).subscribe({
      next: (perfil: any) => {
        console.log('Profile updated successfully:', perfil);
        this.paintFromProfile(perfil);
        this.editOpen = false;
        this.okMsg = 'Perfil actualizado correctamente';
        this.errorMsg = '';
        this.saving = false;
        
        // Actualizar avatar si se seleccionó uno nuevo
        if (this.selectedAvatar) {
          this.userAvatar = this.selectedAvatar;
        }
        
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error updating profile:', err);
        this.errorMsg = err?.error?.message || err?.message || 'Error al actualizar el perfil';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Utilidad: elimina undefined y strings vacías
  private cleanPayload<T extends Record<string, any>>(obj: T): T {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      if (v === undefined) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      out[k] = v;
    }
    return out as T;
  }

  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;

    // Corregir interpolación de strings y referencias
    const nombre = (u?.nombre ?? '').trim();
    const apellidos = (u?.apellidos ?? '').trim();
    const fullName = `${nombre} ${apellidos}`.trim();

    this.userName = (u?.alias && u.alias.trim())
      ? u.alias.trim()
      : (fullName || u?.email || this.userName);

    const base = (u?.alias && u.alias.trim()) ? u.alias.trim() : (fullName || u?.email || '');
    this.userInitials = this.computeInitials(base);

    this.userAliasActual = (u?.alias ?? '').trim();

    // Formatear fecha de nacimiento a yyyy-MM-dd si es posible
    let fechaNac = '';
    if (u?.fechaNac) {
      const raw = String(u.fechaNac);
      // Si ya está en formato yyyy-MM-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        fechaNac = raw;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        // Si viene como dd/mm/yyyy
        const [d, m, y] = raw.split('/');
        fechaNac = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        // Intentar extraer los primeros 10 caracteres (caso ISO)
        fechaNac = raw.slice(0, 10);
      }
    }
    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      fechaNac,
      foto: u?.foto ?? u?.fotoUrl ?? '',
      vip: u?.vip ?? false
    };

    this.cdr.markForCheck();
  }

  private computeInitials(text: string): string {
    if (!text) return 'U';
    return text.split(/\s+/).slice(0, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
  }

  getInitials(nombre: string): string {
    const safe = (nombre || '').trim();
    if (!safe) return 'U';
    return safe.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
  }
}