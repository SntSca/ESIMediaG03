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

}
