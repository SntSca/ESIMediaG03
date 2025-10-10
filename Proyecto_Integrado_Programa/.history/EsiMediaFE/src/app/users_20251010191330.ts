import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
 

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private url = 'http://localhost:8081/users/Registrar';

  constructor(private http: HttpClient) { }

  registrar(datos: {
    nombre: string;
    apellidos: string;
    email?: string;
    alias?: string;
    fechaNac?: string;
    pwd?: string;
    pwd2?: string;
    vip?: boolean;
    foto?: any;
    role: string;   
  }): Observable<string> {
    return this.http.post(this.url, datos, { responseType: 'text' });
  }

  forgotPassword(data: { email: string }): Observable<any> {
      return this.http.post('http://localhost:8081/users/forgot-password', data);
  }
  
  listarUsuarios(filtros?: any): Observable<any> {
    return this.http.get('http://localhost:8081/users/listarUsuarios', { params: filtros });
  }
    listarContenidos(filtros?: any): Observable<any> {
    return this.http.get('http://localhost:8081/users/listarUsuarios', { params: filtros });
  }
  

}
