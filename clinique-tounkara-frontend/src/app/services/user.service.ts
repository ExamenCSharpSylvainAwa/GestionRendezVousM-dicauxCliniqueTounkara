import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUserProfile(userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/users/${userId}?include=patient,medecin,personnel,administrateur`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  updateUserProfile(userId: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/users/${userId}`, data, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Une erreur s\'est produite:', error);
    return throwError(() => new Error('Erreur lors de la requête'));
  }
}