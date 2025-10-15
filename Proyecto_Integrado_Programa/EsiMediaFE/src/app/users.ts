import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type RoleUI = 'usuario' | 'Gestor de Contenido' | 'Administrador';
export type TipoContenido = 'Audio' | 'Video';

export interface RegistroDatos {
  nombre: string;
  apellidos: string;
  email: string;
  alias: string;
  fechaNac: string;
  pwd: string;
  pwd2: string;
  vip?: boolean;
  foto: string;
  role: RoleUI;
  descripcion?: string;
  especialidad?: string;
  tipoContenido?: TipoContenido;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private readonly baseUrl = 'http://localhost:8081/users';
  private readonly registrarUrl = `${this.baseUrl}/Registrar`;
  private readonly crearCreadorUrl = `${this.baseUrl}/admin/creators`;
  private readonly forgotUrl = `${this.baseUrl}/forgot-password`;
  private readonly checkAliasUrl = `${this.baseUrl}/check-alias`;

  constructor(private http: HttpClient) {}

  private mapRoleToApi(role: RoleUI): 'USUARIO' | 'GESTOR DE CONTENIDO' | 'ADMINISTRADOR' {
    switch (role) {
      case 'usuario': return 'USUARIO';
      case 'Gestor de Contenido': return 'GESTOR DE CONTENIDO';
      case 'Administrador': return 'ADMINISTRADOR';
      default: return 'USUARIO';
    }
  }

  registrar(datos: RegistroDatos): Observable<string> {
    const payload: any = {
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      email: datos.email,
      alias: datos.alias,
      fechaNac: datos.fechaNac,
      pwd: datos.pwd,
      pwd2: datos.pwd2,
      vip: !!datos.vip,
      foto: datos.foto,
      role: this.mapRoleToApi(datos.role)
    };

    if (datos.role === 'Gestor de Contenido') {
      payload.descripcion = (datos.descripcion ?? '').trim();
      payload.especialidad = (datos.especialidad ?? '').trim();
      payload.tipoContenido = (datos.tipoContenido ?? '').toUpperCase();
    }

    return this.http.post(this.registrarUrl, payload, { responseType: 'text' });
  }

  /** Admin crea un Gestor de Contenido (no inicia sesión) */
  crearCreadorComoAdmin(dto: Partial<RegistroDatos>) {
    const payload: any = {
      nombre: dto.nombre,
      apellidos: dto.apellidos,
      email: dto.email,
      alias: dto.alias,
      // El backend tolera fechaNac omitida o le da por defecto
      fechaNac: dto.fechaNac,
      pwd: dto.pwd,
      pwd2: dto.pwd2 ?? dto.pwd, // por si tu BE exige igualdad
      foto: dto.foto,
      // En este endpoint el rol del BE ya fuerza GESTOR_CONTENIDO
      descripcion: (dto.descripcion ?? '').trim(),
      especialidad: (dto.especialidad ?? '').trim(),
      tipoContenido: (dto.tipoContenido ?? '') as any
    };
    return this.http.post(this.crearCreadorUrl, payload);
  }

  forgotPassword(data: { email: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.forgotUrl, data);
  }

  checkAlias(alias: string): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(
      `${this.checkAliasUrl}/${encodeURIComponent(alias)}`
    );
  }
}