import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, switchMap, map } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Interfaces
export interface Medecin {
  id: number;
  user_id: number;
  specialite: string;
  numero_ordre: string;
  tarif_consultation: number;
  horaire_consultation: any;
  disponible: boolean;
  user?: User;
}

export interface Patient {
  id: number;
  user_id: number;
  numero_assurance: string;
  adresse: string;
  date_naissance: string;
  sexe: 'M' | 'F' | 'Autre';
  groupe_sanguin?: string;
  antecedent_medicaux?: string;
  user?: User;
}
export interface Consultation {
  id: number;
  dossier_medical_id: number;
  date: string;
  symptomes: string;
  diagnostic: string;
  recommandations?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  dossier_medical?: {
    id: number;
    patient_id: number;
    patient: {
      id: number;
      user_id: number;
      user: {
        id: number;
        nom: string;
        prenom: string;
        role?: string;
      };
    };
  };
}

export interface Appointment {
  id?: number;
  patient_id: number;
  medecin_id: number;
  date_heure: string;
  motif: string;
  tarif?: number;
  statut: 'en_attente' | 'confirme' | 'annule' | 'termine';
  reason?: string;
  reschedule_reason?: string;
  old_date_heure?: string;
  medecin?: Medecin;
  patient?: Patient;
}

export interface MedicalRecord {
  id: number;
  patient_id: number;
  date_creation: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  consultations?: any[];
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  last_page: number;
  total?: number;
  per_page?: number;
  from?: number;
  to?: number;
}

export interface Permission {
  id: number;
  name: string;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  permissions?: Permission[];
}

export interface User {
  id?: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  password?: string;
  role: 'patient' | 'medecin' | 'personnel' | 'administrateur';
  actif: boolean;
  date_creation?: string;
  email_verified_at?: string | null;
}

export interface UserFormData {
  id?: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  password?: string;
  role: 'patient' | 'medecin' | 'personnel' | 'administrateur';
  actif: boolean;
  adresse?: string;
  date_naissance?: string;
  sexe?: 'M' | 'F' | 'Autre';
  numero_assurance?: string;
  groupe_sanguin?: string;
  antecedent_medicaux?: string;
  specialite?: string;
  numero_ordre?: string;
  tarif_consultation?: number;
  horaire_consultation?: any;
  disponible?: boolean;
  medecin?: {
    specialite?: string;
    numero_ordre?: string;
    tarif_consultation?: number;
    horaire_consultation?: any;
    disponible?: boolean;
  };
  patient?: {
    numero_assurance?: string;
    adresse?: string;
    date_naissance?: string;
    sexe?: 'M' | 'F' | 'Autre';
    groupe_sanguin?: string;
    antecedent_medicaux?: string;
  };
}

export interface ApiError {
  type: 'HTTP_ERROR' | 'VALIDATION_ERROR' | 'BUSINESS_ERROR' | 'AVAILABILITY_ERROR' | 'SLOT_OCCUPIED' | 'PATIENT_NOT_FOUND' | 'INVALID_TIME' | 'UNAUTHORIZED' | 'FORBIDDEN';
  message: string;
  code?: string;
  shouldRefreshSchedule?: boolean;
  errors?: { [key: string]: string[] };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    console.log('ApiService initialisé, HttpClient:', !!this.http);
    if (!this.http) {
      console.error('HttpClient non injecté dans ApiService');
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Aucun token trouvé dans localStorage. La requête pourrait échouer si authentification requise.');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Erreur API détaillée:', error);
    let customError: ApiError;

    if (error.error instanceof ErrorEvent) {
      customError = {
        type: 'HTTP_ERROR',
        message: `Erreur client ou réseau: ${error.error.message}`
      };
    } else {
      const serverError = error.error;
      switch (error.status) {
        case 400:
          customError = {
            type: 'BUSINESS_ERROR',
            message: serverError.message || 'Une erreur métier est survenue (code 400)',
            code: serverError.error_code || 'BAD_REQUEST'
          };
          if (['MEDECIN_NON_DISPONIBLE', 'CRENEAU_OCCUPE', 'HORAIRE_INVALIDE'].includes(serverError.error_code)) {
            customError.type = 'AVAILABILITY_ERROR';
            customError.shouldRefreshSchedule = true;
          } else if (serverError.error_code === 'PATIENT_NON_TROUVE') {
            customError.type = 'PATIENT_NOT_FOUND';
          } else if (serverError.error_code === 'INVALID_TIME') {
            customError.type = 'INVALID_TIME';
          }
          break;
        case 401:
          customError = {
            type: 'UNAUTHORIZED',
            message: serverError.message || 'Non autorisé. Veuillez vous connecter.',
            code: 'UNAUTHORIZED'
          };
          break;
        case 403:
          customError = {
            type: 'FORBIDDEN',
            message: serverError.message || 'Accès refusé. Vous n\'avez pas la permission.',
            code: 'FORBIDDEN'
          };
          break;
        case 404:
          customError = {
            type: 'HTTP_ERROR',
            message: serverError.message || 'Ressource non trouvée.',
            code: 'NOT_FOUND'
          };
          break;
        case 409:
          customError = {
            type: 'SLOT_OCCUPIED',
            message: serverError.message || 'Le créneau est déjà occupé. Veuillez en choisir un autre.',
            code: 'CONFLICT'
          };
          customError.shouldRefreshSchedule = true;
          break;
        case 422:
          const validationErrors = serverError.errors;
          const errorMessages = Object.entries(validationErrors || {})
            .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
            .join('; ');
          customError = {
            type: 'VALIDATION_ERROR',
            message: `Erreurs de validation: ${errorMessages || serverError.message || 'Données invalides.'}`,
            code: 'VALIDATION_FAILED',
            errors: validationErrors as { [key: string]: string[] }
          };
          break;
        case 500:
          customError = {
            type: 'HTTP_ERROR',
            message: serverError.message || serverError.error || 'Erreur interne du serveur. Veuillez réessayer plus tard.',
            code: 'INTERNAL_SERVER_ERROR'
          };
          break;
        default:
          customError = {
            type: 'HTTP_ERROR',
            message: `Erreur serveur inattendue: ${error.status} - ${error.statusText || error.message}`,
            code: String(error.status)
          };
          break;
      }
    }
    return throwError(() => customError);
  }

  private cleanUserData(user: Partial<User> & { medecin?: Partial<Medecin>, patient?: Partial<Patient>, specialite?: string, numero_ordre?: string, tarif_consultation?: number, horaire_consultation?: any, disponible?: boolean }): any {
    const cleanedData: any = {};

    if (!user.nom?.trim()) throw new Error('Le nom est requis');
    if (!user.prenom?.trim()) throw new Error('Le prénom est requis');
    if (!user.email?.trim()) throw new Error('L\'email est requis');
    if (!user.role) throw new Error('Le rôle est requis');
    if (user.password === undefined || user.password === null || user.password.trim() === '') {
      throw new Error('Le mot de passe est requis');
    }

    cleanedData.nom = user.nom.trim();
    cleanedData.prenom = user.prenom.trim();
    cleanedData.email = user.email.trim();
    cleanedData.role = user.role;
    cleanedData.password = user.password.trim();
    cleanedData.actif = user.actif !== undefined ? user.actif : true;

    if (user.telephone?.trim()) {
      cleanedData.telephone = user.telephone.trim();
    }

    if (user.role === 'medecin') {
      const medecinData: any = {};
      const specialite = user.medecin?.specialite?.trim() || user.specialite?.trim();
      const numero_ordre = user.medecin?.numero_ordre?.trim() || user.numero_ordre?.trim();
      const tarif_consultation = user.medecin?.tarif_consultation ?? user.tarif_consultation;
      const horaire_consultation = user.medecin?.horaire_consultation ?? user.horaire_consultation;
      const disponible = user.medecin?.disponible ?? user.disponible ?? true;

      if (!specialite) throw new Error('La spécialité est requise pour un médecin');
      if (!numero_ordre) throw new Error('Le numéro d\'ordre est requis pour un médecin');
      if (tarif_consultation === undefined || tarif_consultation === null || isNaN(Number(tarif_consultation)) || Number(tarif_consultation) < 0) {
        throw new Error('Le tarif de consultation doit être un nombre positif');
      }

      medecinData.specialite = specialite;
      medecinData.numero_ordre = numero_ordre;
      medecinData.tarif_consultation = Number(tarif_consultation);

      if (horaire_consultation) {
        if (typeof horaire_consultation === 'string') {
          try {
            JSON.parse(horaire_consultation);
            medecinData.horaire_consultation = horaire_consultation;
          } catch (e) {
            throw new Error('Les horaires de consultation doivent être au format JSON valide');
          }
        } else if (typeof horaire_consultation === 'object') {
          try {
            medecinData.horaire_consultation = JSON.stringify(horaire_consultation);
          } catch (e) {
            throw new Error('Impossible de convertir les horaires de consultation en JSON');
          }
        } else {
          throw new Error('Les horaires de consultation doivent être un objet ou une chaîne JSON');
        }
      } else {
        const defaultHoraire = {
          lundi: { debut: '09:00', fin: '17:00' },
          mardi: { debut: '09:00', fin: '17:00' },
          mercredi: { debut: '09:00', fin: '17:00' },
          jeudi: { debut: '09:00', fin: '17:00' },
          vendredi: { debut: '09:00', fin: '17:00' }
        };
        medecinData.horaire_consultation = JSON.stringify(defaultHoraire);
      }

      medecinData.disponible = disponible;
      cleanedData.medecin = medecinData;
    }

    if (user.role === 'patient' && user.patient) {
      const patientData: any = {};
      if (!user.patient.adresse?.trim()) throw new Error('L\'adresse est requise pour un patient');
      if (!user.patient.date_naissance) throw new Error('La date de naissance est requise pour un patient');
      if (!user.patient.sexe) throw new Error('Le sexe est requis pour un patient');

      patientData.adresse = user.patient.adresse.trim();
      patientData.date_naissance = user.patient.date_naissance;
      patientData.sexe = user.patient.sexe;

      if (user.patient.numero_assurance?.trim()) {
        patientData.numero_assurance = user.patient.numero_assurance.trim();
      }
      if (user.patient.groupe_sanguin?.trim()) {
        patientData.groupe_sanguin = user.patient.groupe_sanguin.trim();
      }
      if (user.patient.antecedent_medicaux?.trim()) {
        patientData.antecedent_medicaux = user.patient.antecedent_medicaux.trim();
      }

      cleanedData.patient = patientData;
    }

    console.log('Données nettoyées et validées pour envoi à /api/users:', cleanedData);
    return cleanedData;
  }

  // --- User Endpoints ---
  getUsers(): Observable<PaginatedResponse<User>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/api/users`, { headers: this.getHeaders() }).pipe(
      tap(res => console.log('getUsers:', res)),
      catchError(this.handleError)
    );
  }

  createUser(user: Partial<User> & { medecin?: Partial<Medecin>, patient?: Partial<Patient>, specialite?: string, numero_ordre?: string, tarif_consultation?: number, horaire_consultation?: any, disponible?: boolean }): Observable<{ id: number; prenom: string; nom: string; email: string; role: string; actif: boolean; telephone?: string }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    try {
      const cleanUser = this.cleanUserData(user);
      console.log('Données nettoyées envoyées à l\'API /api/users:', cleanUser);
      return this.http.post<{ id: number; prenom: string; nom: string; email: string; role: string; actif: boolean; telephone?: string }>(
        `${this.apiUrl}/api/users`,
        cleanUser,
        { headers: this.getHeaders() }
      ).pipe(
        tap(res => console.log('createUser response:', res)),
        catchError(this.handleError)
      );
    } catch (validationError: any) {
      return throwError(() => ({
        type: 'VALIDATION_ERROR',
        message: validationError.message || 'Erreur de validation des données utilisateur',
        code: 'VALIDATION_FAILED'
      } as ApiError));
    }
  }

  updateUser(userId: number, user: Partial<User> & { medecin?: Partial<Medecin>, patient?: Partial<Patient>, specialite?: string, numero_ordre?: string, tarif_consultation?: number, horaire_consultation?: any, disponible?: boolean }): Observable<User> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    try {
      const cleanUser = this.cleanUserData(user);
      return this.http.put<User>(`${this.apiUrl}/api/users/${userId}`, cleanUser, { headers: this.getHeaders() }).pipe(
        tap(res => console.log('updateUser:', res)),
        catchError(this.handleError)
      );
    } catch (validationError: any) {
      return throwError(() => ({
        type: 'VALIDATION_ERROR',
        message: validationError.message || 'Erreur de validation des données utilisateur',
        code: 'VALIDATION_FAILED'
      } as ApiError));
    }
  }

  updateUserStatus(userId: number, actif: boolean): Observable<User> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const body = { actif };
    console.log(`Mise à jour du statut de l'utilisateur ${userId} vers ${actif}:`, body);

    return this.http.patch<User>(`${this.apiUrl}/api/users/${userId}/status`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('updateUserStatus response:', res)),
      catchError(this.handleError)
    );
  }

  deleteUser(userId: number): Observable<void> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.delete<void>(`${this.apiUrl}/api/users/${userId}`, { headers: this.getHeaders() }).pipe(
      tap(() => console.log(`deleteUser: User ${userId} deleted.`)),
      catchError(this.handleError)
    );
  }

  // --- Medecin Endpoints ---
  getMedecins(): Observable<PaginatedResponse<Medecin>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Medecin>>(`${this.apiUrl}/api/medecins?include=user`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getMedecins response:', res)),
      catchError(this.handleError)
    );
  }

  getMedecinById(medecinId: number): Observable<Medecin> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<Medecin>(`${this.apiUrl}/api/medecins/${medecinId}?include=user`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getMedecinById response:', res)),
      catchError(this.handleError)
    );
  }

  // --- Patient Endpoints ---
  getPatients(): Observable<PaginatedResponse<Patient>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Patient>>(`${this.apiUrl}/api/patients?include=user`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getPatients response:', res)),
      catchError(this.handleError)
    );
  }

  getPatientById(patientId: number): Observable<Patient> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<Patient>(`${this.apiUrl}/api/patients/${patientId}?include=user`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getPatientById response:', res)),
      catchError(this.handleError)
    );
  }

  // --- Auth Endpoints ---
  getProfile(): Observable<User> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<User>(`${this.apiUrl}/api/auth/profile`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getProfile response:', res)),
      catchError(this.handleError)
    );
  }

  login(credentials: { email: string, password: string }): Observable<any> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.post(`${this.apiUrl}/api/auth/login`, credentials).pipe(
      tap(res => console.log('login response:', res)),
      catchError(this.handleError)
    );
  }

  register(userData: any): Observable<any> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.post(`${this.apiUrl}/api/auth/register`, userData).pipe(
      tap(res => console.log('register response:', res)),
      catchError(this.handleError)
    );
  }

  logout(): Observable<any> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.post(`${this.apiUrl}/api/auth/logout`, {}, { headers: this.getHeaders() }).pipe(
      tap(res => console.log('logout response:', res)),
      catchError(this.handleError)
    );
  }

  // --- Appointment Endpoints ---
  getAppointments(): Observable<PaginatedResponse<Appointment>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Appointment>>(`${this.apiUrl}/api/rendez-vous?include=patient,medecin,patient.user,medecin.user`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getAppointments response:', res)),
      catchError(this.handleError)
    );
  }

  getAppointmentsForDoctorAndDate(medecinId: number, date: string): Observable<Appointment[]> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Appointment>>(`${this.apiUrl}/api/rendez-vous?include=patient.user,medecin.user`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data.filter(app => {
        const appointmentDate = new Date(app.date_heure).toISOString().split('T')[0];
        return app.medecin_id === medecinId && appointmentDate === date;
      })),
      tap(res => console.log(`getAppointmentsForDoctorAndDate (${medecinId}, ${date}) response:`, res)),
      catchError(this.handleError)
    );
  }

  checkDoctorAvailability(medecinId: number, dateTime: string): Observable<{ available: boolean; message?: string }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    const normalizedDateTime = new Date(dateTime).toISOString();
    return this.http.post<{ available: boolean; message?: string }>(`${this.apiUrl}/api/check-availability`, {
      medecin_id: medecinId,
      date_heure: normalizedDateTime
    }, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('checkDoctorAvailability response:', res)),
      catchError(this.handleError)
    );
  }

  createAppointment(data: Omit<Appointment, 'id' | 'statut'>): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;
    const medecinId = typeof data.medecin_id === 'string' ? parseInt(data.medecin_id, 10) : data.medecin_id;

    if (!patientId || isNaN(patientId) || patientId <= 0) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide' } as ApiError));
    }
    if (!medecinId || isNaN(medecinId) || medecinId <= 0) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID médecin invalide' } as ApiError));
    }
    if (!data.date_heure) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Date et heure requises' } as ApiError));
    }

    const dateTime = new Date(data.date_heure);
    if (isNaN(dateTime.getTime())) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Format de date invalide' } as ApiError));
    }

    const appointmentData: Appointment = {
      patient_id: patientId,
      medecin_id: medecinId,
      date_heure: dateTime.toISOString(),
      motif: data.motif,
      tarif: data.tarif,
      statut: 'en_attente'
    };

    console.log('Données formatées (avec statut par défaut) pour envoi:', appointmentData);

    return this.http.post<{ data: Appointment }>(`${this.apiUrl}/api/rendez-vous`, appointmentData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('createAppointment response:', res)),
      catchError(this.handleError)
    );
  }

  updateAppointmentStatut(appointmentId: number, statut: 'confirme' | 'annule' | 'termine', reason?: string): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const body: { statut: string; reason?: string } = { statut };
    if (statut === 'annule' && reason) {
      body.reason = reason;
    }

    console.log(`Mise à jour du statut du rendez-vous ${appointmentId} à ${statut} avec données:`, body);

    return this.http.patch<{ data: Appointment }>(`${this.apiUrl}/api/rendez-vous/${appointmentId}/statut`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log(`Statut du rendez-vous ${appointmentId} mis à jour à ${statut}:`, res)),
      catchError(this.handleError)
    );
  }

  cancelAppointment(appointmentId: number, reason: string = ''): Observable<{ data: Appointment }> {
    console.log(`Requête d'annulation de rendez-vous pour l'ID: ${appointmentId} avec motif: "${reason}"`);
    return this.updateAppointmentStatut(appointmentId, 'annule', reason);
  }

  createAppointmentWithDoubleCheck(data: Omit<Appointment, 'id' | 'statut'>): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.checkDoctorAvailability(data.medecin_id, data.date_heure).pipe(
      switchMap(availabilityResult => {
        if (!availabilityResult.available) {
          return throwError(() => ({
            type: 'AVAILABILITY_ERROR',
            message: availabilityResult.message || 'Le médecin n\'est pas disponible à cette heure',
            code: 'MEDECIN_NON_DISPONIBLE',
            shouldRefreshSchedule: true
          } as ApiError));
        }
        return this.createAppointment(data);
      }),
      catchError(error => {
        console.error('Erreur lors de la vérification/création:', error);
        return throwError(() => error);
      })
    );
  }

  validateAndCreateAppointment(data: Omit<Appointment, 'id' | 'statut'>): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;

    if (!patientId || isNaN(patientId)) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide pour validation.' } as ApiError));
    }

    return this.getPatientById(patientId).pipe(
      switchMap(patient => {
        console.log('Patient validé:', patient);
        return this.createAppointmentWithDoubleCheck(data);
      }),
      catchError(error => {
        console.error('Erreur de validation du patient ou de création:', error);
        if ((error as ApiError).type) {
          return throwError(() => error);
        }
        return throwError(() => ({
          type: 'BUSINESS_ERROR',
          message: `Impossible de créer le rendez-vous: ${error.message || 'Erreur inconnue'}`,
          code: 'VALIDATION_FAILED'
        } as ApiError));
      })
    );
  }

  rescheduleAppointment(appointmentId: number, data: {
    new_date_heure: string;
    reschedule_reason: string;
    patient_id: number;
    medecin_id: number;
    motif: string;
    tarif: number;
  }): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const dateObj = new Date(data.new_date_heure);
    const formattedDate = dateObj.getFullYear() + '-' +
                          (dateObj.getMonth() + 1).toString().padStart(2, '0') + '-' +
                          dateObj.getDate().toString().padStart(2, '0') + ' ' +
                          dateObj.getHours().toString().padStart(2, '0') + ':' +
                          dateObj.getMinutes().toString().padStart(2, '0') + ':' +
                          dateObj.getSeconds().toString().padStart(2, '0');

    const body = {
      new_date_heure: formattedDate,
      reschedule_reason: data.reschedule_reason,
      patient_id: data.patient_id,
      medecin_id: data.medecin_id,
      motif: data.motif,
      tarif: data.tarif
    };
    console.log(`Report du rendez-vous ${appointmentId} avec données:`, body);
    return this.http.patch<{ data: Appointment }>(`${this.apiUrl}/api/rendez-vous/${appointmentId}/reschedule`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log(`Rendez-vous ${appointmentId} reporté:`, res)),
      catchError(this.handleError)
    );
  }

  // --- Medical Records Endpoints ---
  getMedicalRecords(): Observable<PaginatedResponse<MedicalRecord>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<MedicalRecord>>(`${this.apiUrl}/api/dossier-medicals?include=patient.user,consultations`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getMedicalRecords response:', res)),
      catchError(this.handleError)
    );
  }

  createMedicalRecord(data: { patient_id: number, date_creation: string }): Observable<MedicalRecord> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;
    if (!patientId || isNaN(patientId) || patientId <= 0) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide' } as ApiError));
    }
    if (!data.date_creation) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Date de création requise' } as ApiError));
    }

    const medicalRecordData = { patient_id: patientId, date_creation: data.date_creation };
    return this.http.post<MedicalRecord>(`${this.apiUrl}/api/dossier-medicals`, medicalRecordData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('createMedicalRecord response:', res)),
      catchError(this.handleError)
    );
  }

  getMedicalRecordById(recordId: number): Observable<MedicalRecord> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<MedicalRecord>(`${this.apiUrl}/api/dossier-medicals/${recordId}?include=patient.user,consultations`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getMedicalRecordById response:', res)),
      catchError(this.handleError)
    );
  }

  updateMedicalRecord(recordId: number, data: Partial<MedicalRecord>): Observable<MedicalRecord> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;
    if (patientId && (isNaN(patientId) || patientId <= 0)) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide' } as ApiError));
    }

    const medicalRecordData = { patient_id: patientId, date_creation: data.date_creation };
    return this.http.put<MedicalRecord>(`${this.apiUrl}/api/dossier-medicals/${recordId}`, medicalRecordData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('updateMedicalRecord response:', res)),
      catchError(this.handleError)
    );
  }

  deleteMedicalRecord(recordId: number): Observable<void> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.delete<void>(`${this.apiUrl}/api/dossier-medicals/${recordId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => console.log(`deleteMedicalRecord: Record ${recordId} deleted.`)),
      catchError(this.handleError)
    );
  }

  // --- Invoices Endpoints ---
  getInvoices(): Observable<any> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get(`${this.apiUrl}/api/factures`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getInvoices response:', res)),
      catchError(this.handleError)
    );
  }

  // --- Role & Permission Endpoints ---
  getRoles(): Observable<PaginatedResponse<Role>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Role>>(`${this.apiUrl}/api/roles`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getRoles response:', res)),
      catchError(this.handleError)
    );
  }

  getPermissions(): Observable<PaginatedResponse<Permission>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Permission>>(`${this.apiUrl}/api/permissions`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getPermissions response:', res)),
      catchError(this.handleError)
    );
  }

  createRole(roleData: Omit<Role, 'id'>): Observable<{ data: Role }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.post<{ data: Role }>(`${this.apiUrl}/api/roles`, roleData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('createRole response:', res)),
      catchError(this.handleError)
    );
  }

  updateRole(roleId: number, roleData: Partial<Role>): Observable<{ data: Role }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.put<{ data: Role }>(`${this.apiUrl}/api/roles/${roleId}`, roleData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('updateRole response:', res)),
      catchError(this.handleError)
    );
  }

  deleteRole(roleId: number): Observable<void> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.delete<void>(`${this.apiUrl}/api/roles/${roleId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => console.log(`Rôle ${roleId} supprimé.`)),
      catchError(this.handleError)
    );
  }
  getConsultations(): Observable<PaginatedResponse<Consultation>> {
    return this.http.get<PaginatedResponse<Consultation>>(`${this.apiUrl}/api/consultations?include=dossier_medical.patient.user`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getConsultations response:', res)),
      catchError(this.handleError)
    );
  }

  createConsultation(data: Partial<Consultation>): Observable<Consultation> {
    const consultationData = {
      dossier_medical_id: data.dossier_medical_id,
      date: data.date,
      symptomes: data.symptomes,
      diagnostic: data.diagnostic,
      recommandations: data.recommandations,
      notes: data.notes
    };
    return this.http.post<Consultation>(`${this.apiUrl}/api/consultations`, consultationData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('createConsultation response:', res)),
      catchError(this.handleError)
    );
  }

  updateConsultation(id: number, data: Partial<Consultation>): Observable<Consultation> {
    const consultationData = {
      dossier_medical_id: data.dossier_medical_id,
      date: data.date,
      symptomes: data.symptomes,
      diagnostic: data.diagnostic,
      recommandations: data.recommandations,
      notes: data.notes
    };
    return this.http.put<Consultation>(`${this.apiUrl}/api/consultations/${id}`, consultationData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('updateConsultation response:', res)),
      catchError(this.handleError)
    );
  }

  deleteConsultation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/consultations/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => console.log(`deleteConsultation: Consultation ${id} deleted.`)),
      catchError(this.handleError)
    );
  }


  assignRoleToUser(userId: number, roleId: number): Observable<any> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.post(`${this.apiUrl}/api/users/${userId}/roles`, { role_id: roleId }, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('assignRoleToUser response:', res)),
      catchError(this.handleError)
    );
  }

  removeRoleFromUser(userId: number, roleId: number): Observable<any> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.delete(`${this.apiUrl}/api/users/${userId}/roles/${roleId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('removeRoleFromUser response:', res)),
      catchError(this.handleError)
    );
  }

  confirmAppointment(appointmentId: number): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    const body = { statut: 'confirme' };
    console.log(`Confirmation du rendez-vous ${appointmentId} avec données:`, body);
    return this.http.patch<{ data: Appointment }>(`${this.apiUrl}/api/rendez-vous/${appointmentId}/statut`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log(`Rendez-vous ${appointmentId} confirmé:`, res)),
      catchError(this.handleError)
    );
  }
}