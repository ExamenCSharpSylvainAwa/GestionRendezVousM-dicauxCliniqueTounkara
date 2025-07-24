import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  getMedecins() {
    throw new Error('Method not implemented.');
  }
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  login(credentials: { email: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/login`, credentials);
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/register`, userData);
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/logout`, {}, { headers: this.getHeaders() });
  }

  getAppointments(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/rendez-vous`, { headers: this.getHeaders() });
  }

  createAppointment(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/rendez-vous`, data, { headers: this.getHeaders() });
  }

  getMedicalRecords(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/dossier-medicals`, { headers: this.getHeaders() });
  }

  getInvoices(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/factures`, { headers: this.getHeaders() });
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/auth/profile`, { headers: this.getHeaders() });
  }

  // Nouvelle méthode pour récupérer les rôles
  getRoles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/roles`, { headers: this.getHeaders() });
  }

  // Méthodes supplémentaires pour la gestion des rôles et permissions
  getPermissions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/permissions`, { headers: this.getHeaders() });
  }

  createRole(roleData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/roles`, roleData, { headers: this.getHeaders() });
  }

  updateRole(roleId: number, roleData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/roles/${roleId}`, roleData, { headers: this.getHeaders() });
  }

  deleteRole(roleId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/roles/${roleId}`, { headers: this.getHeaders() });
  }

  assignRoleToUser(userId: number, roleId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/users/${userId}/roles`, { role_id: roleId }, { headers: this.getHeaders() });
  }

  removeRoleFromUser(userId: number, roleId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/users/${userId}/roles/${roleId}`, { headers: this.getHeaders() });
  }
}