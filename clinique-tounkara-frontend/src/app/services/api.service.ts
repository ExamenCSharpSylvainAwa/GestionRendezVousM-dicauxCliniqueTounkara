import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getData(): Observable<any> {
    return this.http.get(`${this.baseUrl}/data`);
  }

  postData(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/data`, data);
  }
}