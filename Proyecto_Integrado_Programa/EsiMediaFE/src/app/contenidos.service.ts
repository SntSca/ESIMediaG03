import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Contenidos } from './contenidos'; 
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ContenidosService {
  private http = inject(HttpClient);
  private readonly BASE = '/Contenidos';

    getAll(): Observable<Contenidos[]> {
    return this.http.get<Contenidos[]>(`${this.BASE}/ListarContenidos`).pipe(
      map(arr => arr.map((c: any) => ({

        id: c.id ?? c._id ?? '',
        ...c,
      })))
    );
  }
}
