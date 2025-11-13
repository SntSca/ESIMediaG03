import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from './environments/environment';

export type TipoContenido = 'AUDIO' | 'VIDEO';

export interface Contenido {
  id: string;
  userEmail: string;
  titulo: string;
  descripcion?: string;
  ficheroAudio?: string | null;
  urlAudio?: string | null;
  urlVideo?: string | null;
  tags: string[];
  duracionMinutos: number;
  resolucion?: string | null;
  vip: boolean;
  visible: boolean;
  fechaEstado?: string | null;
  disponibleHasta?: string | null;
  restringidoEdad: number;
  tipo: TipoContenido;
  imagen?: string | null;
  numReproducciones?: number; 
  ratingAvg?: number;

}

export interface ModificarContenidoRequest {
  titulo?: string;
  descripcion?: string;
  ficheroAudio?: string | null;
  urlVideo?: string | null;
  resolucion?: string | null;
  tags?: string[];
  duracionMinutos?: number;
  vip?: boolean;
  visible?: boolean;
  disponibleHasta?: string | null;
  restringidoEdad?: number;
  imagen?: string | null;
}

@Injectable({ providedIn: 'root' })
export class Contenidos {
  private http = inject(HttpClient);
  private readonly BASE = `${environment.API_BASE}/Contenidos`;
  listar(): Observable<Contenido[]> {
    return this.http.get<any[]>(`${this.BASE}/ListarContenidos`).pipe(
      map(arr => (arr ?? []).map((c: any) => ({
        id: c.id ?? c._id ?? '',
        userEmail: c.userEmail,
        titulo: c.titulo,
        descripcion: c.descripcion,
        ficheroAudio: c.ficheroAudio ?? null,
        urlVideo: c.urlVideo ?? null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        duracionMinutos: Number(c.duracionMinutos ?? 0),
        resolucion: c.resolucion ?? null,
        vip: !!c.vip,
        visible: !!c.visible,
        fechaEstado: c.fechaEstado ?? null,
        disponibleHasta: c.disponibleHasta ?? null,
        restringidoEdad: Number(c.restringidoEdad ?? 0),
        tipo: (c.tipo as TipoContenido),
        imagen: c.imagen ?? null,
        numReproducciones: Number(c.numReproducciones ?? c.reproducciones ?? 0),
        ratingAvg: c.ratingAvg !== undefined ? Number(c.ratingAvg) : undefined,
      }) as Contenido))
    );
  }

  /** Convierte "YYYY-MM-DD" a "YYYY-MM-DDT00:00:00".
 *  También acepta "YYYY-MM-DDTHH:mm" y le añade ":00".
 */
  private coerceLocalDateTimeIso(value?: string | null, defaultTime = '00:00:00'): string | null {
    if (!value) return null;

    // Solo fecha
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T${defaultTime}`;
    }

    // Fecha + hora sin segundos
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return `${value}:00`;
    }

    // Fecha + hora con segundos -> tal cual
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
      return value;
    }

    // Si llega en otro formato, devuélvelo igual (o lanza error si prefieres)
    return value;
  }

  subirContenido(payload: Partial<Contenido>): Observable<Contenido> {
  // Normaliza fechas que el backend espera como LocalDateTime
    const body: any = { ...payload };

    // Si en el form usas un campo solo-fecha (ej. "disponibilidadContenido"),
    // conviértelo a disponibleHasta (LDT) y quita el campo solo-fecha
    if (body.disponibilidadContenido) {
      body.disponibleHasta = this.coerceLocalDateTimeIso(body.disponibilidadContenido);
      delete body.disponibilidadContenido;
    } else if (body.disponibleHasta) {
      body.disponibleHasta = this.coerceLocalDateTimeIso(body.disponibleHasta);
    }

    // (Opcional) Si tienes más campos fecha → LDT, normalízalos igual:
    // if (body.fechaEstado) body.fechaEstado = this.coerceLocalDateTimeIso(body.fechaEstado);

    return this.http.post<Contenido>(`${this.BASE}/AnadirContenido`, body);
  }

  modificar(id: string, cambios: ModificarContenidoRequest, creatorTipo: TipoContenido): Observable<Contenido> {
    const headers = new HttpHeaders({ 'X-Creator-Tipo': creatorTipo });

    // Igual que en subir: normalizamos antes de enviar
    const body: any = { ...cambios };

    if (body.disponibilidadContenido) {
      body.disponibleHasta = this.coerceLocalDateTimeIso(body.disponibilidadContenido);
      delete body.disponibilidadContenido;
    } else if (body.disponibleHasta) {
      body.disponibleHasta = this.coerceLocalDateTimeIso(body.disponibleHasta);
    }

    // (Opcional) otros campos fecha → LDT:
    // if (body.fechaEstado) body.fechaEstado = this.coerceLocalDateTimeIso(body.fechaEstado);

    return this.http.put<Contenido>(`${this.BASE}/ModificarContenido/${encodeURIComponent(id)}`, body, { headers });
  }


 
  subirContenido1(payload: Partial<Contenido>): Observable<Contenido> {
    return this.http.post<Contenido>(`${this.BASE}/AnadirContenido`, payload);
  }
 
  modificar2(id: string, cambios: ModificarContenidoRequest, creatorTipo: TipoContenido): Observable<Contenido> {
    const headers = new HttpHeaders({ 'X-Creator-Tipo': creatorTipo });
    return this.http.put<Contenido>(`${this.BASE}/ModificarContenido/${encodeURIComponent(id)}`, cambios, { headers });
  }
  eliminar(id: string, creatorTipo: TipoContenido): Observable<void> {
    const headers = new HttpHeaders({ 'X-Creator-Tipo': creatorTipo });
    return this.http.delete<void>(`${this.BASE}/EliminarContenido/${encodeURIComponent(id)}`, { headers });
  }
}
