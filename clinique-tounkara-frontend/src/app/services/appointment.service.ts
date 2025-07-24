
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// Interface pour définir la structure d'un rendez-vous (ajustée selon votre modèle)
export interface Appointment {
  id?: number;
  date_heure: string;
  motif: string;
  statut: string;
  patient: {
    user: {
      prenom: string;
      nom: string;
    };
  };
  medecin: {
    user: {
      prenom: string;
      nom: string;
    };
  };
  tarif?: number;
}

// Interface pour la réponse paginée de Laravel
interface PaginatedResponse<T> {
  data: T[];
  // Ajoutez d'autres champs si nécessaire (links, meta, etc.)
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    console.log('Token utilisé:', token ? `Bearer ${token.substring(0, 20)}...` : 'Aucun token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Erreur API (Appointments):', error);
    let errorMessage = 'Une erreur inconnue s\'est produite';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erreur client: ${error.error.message}`;
    } else {
      errorMessage = `Erreur serveur: ${error.status} - ${error.message}`;
      if (error.error?.message) {
        errorMessage += ` - ${error.error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  getDoctorAppointments(): Observable<PaginatedResponse<Appointment>> {
    const url = `${this.baseUrl}/api/rendez-vous`;
    console.log('Appel API getDoctorAppointments vers:', url);

    return this.http.get<PaginatedResponse<Appointment>>(url, { headers: this.getHeaders() }).pipe(
      tap(response => console.log('Réponse getDoctorAppointments:', response)),
      catchError(this.handleError)
    );
  }
}