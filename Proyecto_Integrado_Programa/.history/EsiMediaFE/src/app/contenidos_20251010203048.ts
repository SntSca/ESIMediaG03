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
  setFavorito(idContenido: number, idUsuario: number): Observable<any> {
    return this.http.post('http://localhost:8081/contenidos/setFavorito', { idContenido, idUsuario });
  }

  addFavorito(idContenido: number, idUsuario: number): Observable<any> {
    return this.http.post('http://localhost:8081/contenidos/addFavorito', { idContenido, idUsuario });
  }
  
}
