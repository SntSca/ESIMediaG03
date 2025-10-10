import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Contenidos {

  constructor(private http: HttpClient) { }
      
  listarContenidos(filtros?: any): Observable<any> {
    return this.http.get('http://localhost:8081/contenidos/listarContenidos', { params: filtros });
  }
addFavorito(userId: string, contenidoId: string) {
  return this.http.post<void>(`${this.API}/users/${userId}/favoritos`, { contenidoId });
}

// Variante 1: DELETE con body (si tu backend lo acepta)
removeFavorito(userId: string, contenidoId: string) {
  return this.http.request<void>('DELETE', `${this.API}/users/${userId}/favoritos`, {
    body: { contenidoId }
  });
}
  
}
