import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, switchMap, map } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Interfaces
export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: 'patient' | 'medecin' | 'personnel' | 'administrateur';
  actif: boolean;
  date_creation?: string;
  email_verified_at?: string | null;
}

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

export interface Paiement {
  id: number;
  rendez_vous_id: number;
  date: string;
  montant: number;
  statut: 'en_attente' | 'paye' | 'annule';
  reference: string | null;
  paydunya_token: string | null;
  facture?: Facture | null;
}

export interface Facture {
  id: number;
  paiement_id: number;
  numero: string;
  date_emission: string;
  date_echeance: string;
  montant_total: number;
  tva: number;
  statut: 'brouillon' | 'envoyee' | 'payee';
 paiement?: {
    id: number;
    statut: string;
    montant: number;
    reference: string | null;
    paydunya_token: string | null;
    rendez_vous: {
      id: number;
      patient: {
        user: {
          nom: string;
          prenom: string;
        };
      };
      medecin?: {
        user?: {
          nom: string;
          prenom: string;
        };
        specialite?: string;
      };
      date_heure: string;
      motif: string;
      tarif: number;
      statut: string;
    };
  } | null;
  details_facture?: {
    rendez_vous_id: number;
    patient: string;
    medecin: string;
    specialite: string;
    date_heure: string;
    motif: string;
    montant: number;
  };
}
export interface ConfirmedAppointmentResponse {
  id: number;
  medecin: {
    id: number;
    nom: string;
    prenom: string;
    specialite: string;
  };
  date_heure: string;
  motif: string;
  tarif: number;
  statut: string;
  paiement?: {
    id: number;
    montant: number;
    statut: 'en_attente' | 'paye' | 'annule';
    reference: string | null;
    paydunya_token: string | null;
    facture?: {
      id: number;
      numero: string;
      date_emission: string;
      montant_total: number;
      statut: string;
    } | null;
  } | null;
}
export interface PaymentsApiResponse {
  data: ConfirmedAppointmentResponse[];
  message: string;
}
export interface Appointment {
  id: number;
  patient_id: number;
  medecin_id: number;
  date_heure: string;
  motif: string;
  tarif: number;
  statut: 'en_attente' | 'confirme' | 'annule' | 'termine';
  reason?: string;
  reschedule_reason?: string;
  old_date_heure?: string;
  // Ces propriétés sont maintenant obligatoires quand l'appointment est chargé avec ses relations
  medecin: {
    id: number;
    nom: string;
    prenom: string;
    specialite: string;
    user?: User;
  };
  patient?: Patient;
  paiement?: Paiement | null;
}

export interface AppointmentMinimal {
  id: number;
  patient_id: number;
  medecin_id: number;
  date_heure: string;
  motif: string;
  tarif: number;
  statut: 'en_attente' | 'confirme' | 'annule' | 'termine';
  reason?: string;
  reschedule_reason?: string;
  old_date_heure?: string;
  // Relations optionnelles
  medecin?: {
    id: number;
    nom: string;
    prenom: string;
    specialite: string;
    user?: User;
  };
  patient?: Patient;
  paiement?: Paiement | null;
}

// Interface pour la création d'appointments
export interface CreateAppointmentRequest {
  patient_id: number;
  medecin_id: number;
  date_heure: string;
  motif: string;
  tarif: number; // Obligatoire et non undefined
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
  prescriptions?: Prescription[];
}

export interface PaymentVerificationResponse {
  data: {
    paiement_id: number;
    statut: string;
    reference: string;
    paydunya_token: string;
    status_changed: boolean;
    previous_status: string;
    facture?: {
      id: number;
      numero: string;
      date_emission: string;
      montant_total: number;
      statut: string;
    };
  };
  message: string;
}

export interface SyncPendingPaymentsResponse {
  data: {
    updated_payments_count: number;
    updated_payments: Array<{
      paiement_id: number;
      rendez_vous_id: number;
      ancien_statut: string;
      nouveau_statut: string;
      facture_id: number;
    }>;
  };
  message: string;
}

export interface Prescription {
  id: number;
  consultation_id: number;
  date_emission: string;
  date_expiration: string;
  description: string;
  medicaments: { nom: string; posologie: string; duree: string; instructions?: string }[];
  created_at: string;
  updated_at: string;
  consultation?: {
    id: number;
    dossier_medical_id: number;
    dossier_medical: {
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
  };
}

export interface MedicalRecord {
  id: number;
  patient_id: number;
  date_creation: string;
  created_at: string;
  updated_at: string;
  patient: {
    id: number;
    user_id: number;
    numero_assurance: string | null;
    adresse: string | null;
    date_naissance: string;
    sexe: string | null;
    groupe_sanguin: string | null;
    antecedent_medicaux: string | null;
    user: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
      role: string;
    };
  };
  consultations: {
    id: number;
    dossier_medical_id: number;
    date: string;
    symptomes: string;
    diagnostic: string;
    recommandations: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    prescriptions: {
      id: number;
      consultation_id: number;
      date_emission: string;
      date_expiration: string;
      description: string;
      medicaments: {
        nom: string;
        posologie: string;
        duree: string;
        instructions?: string;
      }[];
      created_at: string;
      updated_at: string;
    }[];
  }[];
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
  poste?: string;
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
  type:
    | 'HTTP_ERROR'
    | 'VALIDATION_ERROR'
    | 'BUSINESS_ERROR'
    | 'AVAILABILITY_ERROR'
    | 'SLOT_OCCUPIED'
    | 'PATIENT_NOT_FOUND'
    | 'INVALID_TIME'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'PAYMENT_ALREADY_COMPLETED'
    | 'INVALID_APPOINTMENT'
    | 'PAYDUNYA_ERROR'
    | 'INVALID_TOKEN'
    | 'PAYMENT_NOT_FOUND'
    | 'PAYMENT_PENDING'
    | 'INVALID_IPN'
    | 'INVALID_STATUS';
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
            type: serverError.type || 'BUSINESS_ERROR',
            message: serverError.message || 'Une erreur métier est survenue (code 400)',
            code: serverError.error_code || 'BAD_REQUEST',
            errors: serverError.errors
          };
          if (['MEDECIN_NON_DISPONIBLE', 'CRENEAU_OCCUPE', 'HORAIRE_INVALIDE'].includes(serverError.error_code)) {
            customError.type = 'AVAILABILITY_ERROR';
            customError.shouldRefreshSchedule = true;
          } else if (serverError.error_code === 'PATIENT_NON_TROUVE') {
            customError.type = 'PATIENT_NOT_FOUND';
          } else if (serverError.error_code === 'INVALID_TIME') {
            customError.type = 'INVALID_TIME';
          } else if (serverError.type === 'PAYMENT_ALREADY_COMPLETED') {
            customError.type = 'PAYMENT_ALREADY_COMPLETED';
          } else if (serverError.type === 'INVALID_APPOINTMENT') {
            customError.type = 'INVALID_APPOINTMENT';
          } else if (serverError.type === 'PAYDUNYA_ERROR') {
            customError.type = 'PAYDUNYA_ERROR';
          } else if (serverError.type === 'INVALID_TOKEN') {
            customError.type = 'INVALID_TOKEN';
          } else if (serverError.type === 'PAYMENT_NOT_FOUND') {
            customError.type = 'PAYMENT_NOT_FOUND';
          } else if (serverError.type === 'PAYMENT_PENDING') {
            customError.type = 'PAYMENT_PENDING';
          } else if (serverError.type === 'INVALID_IPN') {
            customError.type = 'INVALID_IPN';
          } else if (serverError.type === 'INVALID_STATUS') {
            customError.type = 'INVALID_STATUS';
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
            code: 'FORBIDDEN',
            errors: serverError.errors
          };
          break;
        case 404:
          customError = {
            type: 'PATIENT_NOT_FOUND',
            message: serverError.message || 'Ressource non trouvée.',
            code: 'NOT_FOUND',
            errors: serverError.errors
          };
          break;
        case 409:
          customError = {
            type: 'SLOT_OCCUPIED',
            message: serverError.message || 'Le créneau est déjà occupé. Veuillez en choisir un autre.',
            code: 'CONFLICT',
            shouldRefreshSchedule: true,
            errors: serverError.errors
          };
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
            errors: validationErrors
          };
          break;
        case 500:
          customError = {
            type: 'HTTP_ERROR',
            message: serverError.message || serverError.error || 'Erreur interne du serveur. Veuillez réessayer plus tard.',
            code: 'INTERNAL_SERVER_ERROR',
            errors: serverError.errors
          };
          break;
        default:
          customError = {
            type: 'HTTP_ERROR',
            message: `Erreur serveur inattendue: ${error.status} - ${error.statusText || error.message}`,
            code: String(error.status),
            errors: serverError.errors
          };
          break;
      }
    }
    return throwError(() => customError);
  }

 private cleanUserData(user: UserFormData): any {
  const cleanedData: any = {};

  if (!user.nom?.trim()) throw new Error('Le nom est requis');
  if (!user.prenom?.trim()) throw new Error('Le prénom est requis');
  if (!user.email?.trim()) throw new Error('L\'email est requis');
  if (!user.role) throw new Error('Le rôle est requis');

  // Only require password for createUser, not updateUser
  if (!user.id && (user.password === undefined || user.password === null || user.password.trim() === '')) {
    throw new Error('Le mot de passe est requis pour la création d\'un utilisateur');
  }

  cleanedData.nom = user.nom.trim();
  cleanedData.prenom = user.prenom.trim();
  cleanedData.email = user.email.trim();
  cleanedData.role = user.role;
  if (user.password) {
    cleanedData.password = user.password.trim();
  }
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

  // Validation renforcée pour les patients
  if (user.role === 'patient') {
    if (!user.patient) {
      throw new Error('Les données patient sont requises pour un utilisateur de type patient');
    }

    const patientData: any = {};
    
    // Validation des champs obligatoires pour les patients
    if (!user.patient.adresse?.trim()) {
      throw new Error('L\'adresse est requise pour un patient');
    }
    if (!user.patient.date_naissance) {
      throw new Error('La date de naissance est requise pour un patient');
    }
    if (!user.patient.sexe || !['M', 'F', 'Autre'].includes(user.patient.sexe)) {
      throw new Error('Le sexe est requis pour un patient (M, F, ou Autre)');
    }

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

  createUser(user: UserFormData): Observable<{ id: number; prenom: string; nom: string; email: string; role: string; actif: boolean; telephone?: string }> {
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
        code: 'VALIDATION_FAILED',
        errors: { user: [validationError.message] }
      } as ApiError));
    }
  }

  updateUser(userId: number, user: UserFormData): Observable<User> {
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
        code: 'VALIDATION_FAILED',
        errors: { user: [validationError.message] }
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
  createAppointment(data: CreateAppointmentRequest): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;
    const medecinId = typeof data.medecin_id === 'string' ? parseInt(data.medecin_id, 10) : data.medecin_id;

    if (!patientId || isNaN(patientId) || patientId <= 0) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide', errors: { patient_id: ['ID patient invalide'] } } as ApiError));
    }
    if (!medecinId || isNaN(medecinId) || medecinId <= 0) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID médecin invalide', errors: { medecin_id: ['ID médecin invalide'] } } as ApiError));
    }
    if (!data.date_heure) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Date et heure requises', errors: { date_heure: ['Date et heure requises'] } } as ApiError));
    }
    if (!data.tarif || isNaN(data.tarif) || data.tarif <= 0) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Tarif invalide', errors: { tarif: ['Le tarif doit être un nombre positif'] } } as ApiError));
    }

    const dateTime = new Date(data.date_heure);
    if (isNaN(dateTime.getTime())) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Format de date invalide', errors: { date_heure: ['Format de date invalide'] } } as ApiError));
    }

    const appointmentData = {
      patient_id: patientId,
      medecin_id: medecinId,
      date_heure: dateTime.toISOString(),
      motif: data.motif || 'Consultation générale',
      tarif: data.tarif
    };

    console.log('Données formatées pour envoi à /api/rendez-vous:', appointmentData);

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

  createAppointmentWithDoubleCheck(data: CreateAppointmentRequest): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.checkDoctorAvailability(data.medecin_id, data.date_heure).pipe(
      switchMap(availabilityResult => {
        if (!availabilityResult.available) {
          return throwError(() => ({
            type: 'AVAILABILITY_ERROR',
            message: availabilityResult.message || 'Le médecin n\'est pas disponible à cette heure',
            code: 'MEDECIN_NON_DISPONIBLE',
            shouldRefreshSchedule: true,
            errors: { availability: [availabilityResult.message || 'Médecin non disponible'] }
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

  validateAndCreateAppointment(data: CreateAppointmentRequest): Observable<{ data: Appointment }> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;

    if (!patientId || isNaN(patientId)) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide pour validation.', errors: { patient_id: ['ID patient invalide'] } } as ApiError));
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
          code: 'VALIDATION_FAILED',
          errors: { general: [error.message || 'Erreur inconnue'] }
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
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide', errors: { patient_id: ['ID patient invalide'] } } as ApiError));
    }
    if (!data.date_creation) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'Date de création requise', errors: { date_creation: ['Date de création requise'] } } as ApiError));
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

  getMyMedicalRecord(): Observable<MedicalRecord> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<MedicalRecord>(`${this.apiUrl}/api/dossier-medicals-me`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getMyMedicalRecord response:', res)),
      catchError(this.handleError)
    );
  }

  updateMedicalRecord(recordId: number, data: Partial<MedicalRecord>): Observable<MedicalRecord> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));

    const patientId = typeof data.patient_id === 'string' ? parseInt(data.patient_id, 10) : data.patient_id;
    if (patientId && (isNaN(patientId) || patientId <= 0)) {
      return throwError(() => ({ type: 'VALIDATION_ERROR', message: 'ID patient invalide', errors: { patient_id: ['ID patient invalide'] } } as ApiError));
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

  // --- Consultations Endpoints ---
  getConsultations(): Observable<PaginatedResponse<Consultation>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Consultation>>(`${this.apiUrl}/api/consultations?include=dossier_medical.patient.user,prescriptions.medicaments`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getConsultations response:', res)),
      catchError(this.handleError)
    );
  }

  createConsultation(data: Partial<Consultation>): Observable<Consultation> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
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
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
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
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.delete<void>(`${this.apiUrl}/api/consultations/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => console.log(`deleteConsultation: Consultation ${id} deleted.`)),
      catchError(this.handleError)
    );
  }

  // --- Prescriptions Endpoints ---
  getPrescriptions(): Observable<PaginatedResponse<Prescription>> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get<PaginatedResponse<Prescription>>(`${this.apiUrl}/api/prescriptions?include=consultation.dossier_medical.patient.user,medicaments`, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('getPrescriptions response:', res)),
      catchError(this.handleError)
    );
  }

  createPrescription(data: Partial<Prescription>): Observable<Prescription> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    const prescriptionData = {
      consultation_id: data.consultation_id,
      date_emission: data.date_emission,
      date_expiration: data.date_expiration,
      description: data.description,
      medicaments: data.medicaments?.map(med => ({
        nom: med.nom,
        posologie: med.posologie,
        duree: med.duree,
        instructions: med.instructions
      }))
    };
    return this.http.post<Prescription>(`${this.apiUrl}/api/prescriptions`, prescriptionData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('createPrescription response:', res)),
      catchError(this.handleError)
    );
  }

  updatePrescription(id: number, data: Partial<Prescription>): Observable<Prescription> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    const prescriptionData = {
      consultation_id: data.consultation_id,
      date_emission: data.date_emission,
      date_expiration: data.date_expiration,
      description: data.description,
      medicaments: data.medicaments?.map(med => ({
        nom: med.nom,
        posologie: med.posologie,
        duree: med.duree,
        instructions: med.instructions
      }))
    };
    return this.http.put<Prescription>(`${this.apiUrl}/api/prescriptions/${id}`, prescriptionData, {
      headers: this.getHeaders()
    }).pipe(
      tap(res => console.log('updatePrescription response:', res)),
      catchError(this.handleError)
    );
  }

  deletePrescription(id: number): Observable<void> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.delete<void>(`${this.apiUrl}/api/prescriptions/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => console.log(`deletePrescription: Prescription ${id} deleted.`)),
      catchError(this.handleError)
    );
  }

  // --- Payment Endpoints ---
getConfirmedAppointments(): Observable<PaymentsApiResponse> {
  if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
  return this.http.get<PaymentsApiResponse>(`${this.apiUrl}/api/paiements`, {
    headers: this.getHeaders()
  }).pipe(
    tap(res => console.log('getConfirmedAppointments response:', res)),
    catchError(this.handleError)
  );
}

 createPayment(rendezVousId: number): Observable<{ data: { paiement_id: number; paydunya_url: string; paydunya_token: string; montant: number }; message: string }> {
  if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
  return this.http.post<{ data: { paiement_id: number; paydunya_url: string; paydunya_token: string; montant: number }; message: string }>(
    `${this.apiUrl}/api/paiements`,
    { rendez_vous_id: rendezVousId },
    { headers: this.getHeaders() }
  ).pipe(
    tap(res => console.log('createPayment response:', res)),
    catchError(this.handleError)
  );
}

getPayment(id: number): Observable<{ data: Paiement; message: string }> {
  if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
  return this.http.get<{ data: Paiement; message: string }>(`${this.apiUrl}/api/paiements/${id}`, {
    headers: this.getHeaders()
  }).pipe(
    tap(res => console.log('getPayment response:', res)),
    catchError(this.handleError)
  );
}

cancelPayment(id: number): Observable<{ message: string }> {
  if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
  return this.http.delete<{ message: string }>(`${this.apiUrl}/api/paiements/${id}`, {
    headers: this.getHeaders()
  }).pipe(
    tap(res => console.log(`cancelPayment: Paiement ${id} annulé.`, res)),
    catchError(this.handleError)
  );
}

markFactureAsPaid(factureId: number): Observable<Facture> {
  return this.updateFactureStatus(factureId, 'payee');
}

/**
 * Met à jour le statut d'une facture.
 * @param factureId L'identifiant de la facture.
 * @param statut Le nouveau statut ('brouillon' | 'envoyee' | 'payee').
 */
updateFactureStatus(factureId: number, statut: 'brouillon' | 'envoyee' | 'payee'): Observable<Facture> {
  if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
  return this.http.patch<Facture>(
    `${this.apiUrl}/api/factures/${factureId}/statut`,
    { statut },
    { headers: this.getHeaders() }
  ).pipe(
    tap(res => console.log(`updateFactureStatus: Facture ${factureId} mise à jour au statut ${statut}.`, res)),
    catchError(this.handleError)
  );
}

  downloadFacturePDF(factureId: number): Observable<Blob> {
    if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
    return this.http.get(`${this.apiUrl}/api/factures/${factureId}/pdf`, {
      headers: this.getHeaders(),
      responseType: 'blob'
    }).pipe(
      tap(() => console.log(`downloadFacturePDF: Téléchargement du PDF pour facture ${factureId}`)),
      catchError(this.handleError)
    );
  }

  // --- Invoices Endpoints ---
getInvoices(): Observable<PaginatedResponse<Facture>> {
  if (!this.http || !this.apiUrl) return throwError(() => ({ type: 'HTTP_ERROR', message: 'Service non configuré.' } as ApiError));
  
  const includeParams = 'include=paiement.rendez_vous.patient.user,paiement.rendez_vous.medecin.user,paiement.rendez_vous.medecin';
  
  return this.http.get<PaginatedResponse<Facture>>(`${this.apiUrl}/api/factures?${includeParams}`, {
    headers: this.getHeaders()
  }).pipe(
    tap(res => {
      console.log('Réponse brute de getInvoices:', JSON.stringify(res, null, 2));
      if (res.data && res.data.length > 0) {
        console.log('Structure de la première facture:', JSON.stringify(res.data[0], null, 2));
      }
    }),
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

  verifyPaymentStatus(rendezVousId: number): Observable<PaymentVerificationResponse> {
    return this.http.post<PaymentVerificationResponse>(
      `${this.apiUrl}/rendez-vous/${rendezVousId}/verify-payment`,
      {}
    );
  }

  syncPendingPayments(): Observable<SyncPendingPaymentsResponse> {
    return this.http.post<SyncPendingPaymentsResponse>(
      `${this.apiUrl}/paiements/sync-pending`,
      {}
    );
  }

  downloadInvoice(factureId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/factures/${factureId}/download`, {
      responseType: 'blob'
    });
  }
}