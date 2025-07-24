import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer, of } from 'rxjs';
import { map, catchError, tap, retry, retryWhen, delayWhen, scan } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Interface pour les horaires par date spécifique
export interface DateSchedule {
  id?: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  is_break?: boolean;
  is_available?: boolean;
  status?: string;
}

// Interface pour les horaires par jour de la semaine
export interface DaySchedule {
  id?: number;
  user_id: number;
  is_available: boolean;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  end_break: string | null;
  // Potentiellement, si l'API retourne des dates spécifiques pour des DaySchedule,
  // vous pouvez ajouter 'date?: string;' ici, mais pour l'instant ce n'est pas le cas.
}

// Interface pour la réponse de l'API avec créneaux disponibles
export interface AvailableScheduleResponse {
  doctor_id: number;
  day_of_week: string;
  date?: string;
  is_available: boolean;
  total_slots?: number;
  work_hours?: {
    start: string;
    end: string;
    break_start: string;
    break_end: string;
  };
  work_schedule?: {
    start_time: string;
    end_time: string;
    break_start: string;
    break_end: string;
  };
  total_available_slots?: number;
  available_slots: DateSchedule[]; // Still DateSchedule as these are specific time slots
  message?: string;
}

export interface ScheduleResponse {
  success: boolean;
  message?: string;
  data?: DateSchedule[] | DaySchedule[] | DateSchedule | DaySchedule;
  errors?: { [key: string]: string[] };
}

export interface ErrorDetails {
  type: 'network' | 'server' | 'client' | 'timeout' | 'empty_response';
  message: string;
  canRetry: boolean;
  suggestedAction: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private apiUrl = environment.apiUrl;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly TIMEOUT_DURATION = 10000;

  private readonly dayOfWeekMap: string[] = [
    'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'
  ];

  constructor(private http: HttpClient) {
    console.log('ScheduleService initialisé, HttpClient:', !!this.http);
    console.log('API URL:', this.apiUrl);
    if (!this.http) {
      console.error('HttpClient non injecté dans ScheduleService');
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    console.log('Token récupéré:', token ? 'Présent' : 'Absent');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private classifyError(error: HttpErrorResponse, responseData?: any): ErrorDetails {
    console.log('Classification de l\'erreur:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      responseData
    });

    // Vérifier si c'est une réponse vide mais valide
    if (responseData && typeof responseData === 'object') {
      if (Array.isArray(responseData) && responseData.length === 0) {
        return {
          type: 'empty_response',
          message: 'Aucun horaire trouvé pour cette période.',
          canRetry: false,
          suggestedAction: 'Vérifiez que l\'utilisateur a des horaires configurés'
        };
      }
      if (responseData.available_slots && Array.isArray(responseData.available_slots) && responseData.available_slots.length === 0) {
        return {
          type: 'empty_response',
          message: 'Aucun créneau disponible trouvé.',
          canRetry: false,
          suggestedAction: 'Le médecin n\'est pas disponible à cette date'
        };
      }
    }

    if (error.status === 0) {
      return {
        type: 'network',
        message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et que le serveur est démarré.',
        canRetry: true,
        suggestedAction: 'Vérifiez que votre serveur backend est en cours d\'exécution sur le port 8000'
      };
    } else if (error.status === 401) {
      return {
        type: 'client',
        message: 'Session expirée ou token invalide. Veuillez vous reconnecter.',
        canRetry: false,
        suggestedAction: 'Reconnectez-vous à l\'application'
      };
    } else if (error.status === 404) {
      return {
        type: 'client',
        message: 'Endpoint non trouvé. Vérifiez l\'URL de l\'API.',
        canRetry: false,
        suggestedAction: 'Vérifiez la configuration de l\'API et les routes'
      };
    } else if (error.status === 422) {
      const errorMessage = responseData?.errors ? Object.values(responseData.errors).flat().join(', ') : 'Données invalides';
      return {
        type: 'client',
        message: `Erreur de validation: ${error.status} - ${errorMessage}`,
        canRetry: false,
        suggestedAction: 'Vérifiez les données envoyées et corrigez les erreurs de validation'
      };
    } else if (error.status >= 500) {
      return {
        type: 'server',
        message: `Erreur du serveur (${error.status}). Veuillez réessayer plus tard.`,
        canRetry: true,
        suggestedAction: 'Contactez l\'administrateur système'
      };
    } else {
      return {
        type: 'network',
        message: 'Erreur inconnue',
        canRetry: true,
        suggestedAction: 'Contactez le support technique'
      };
    }
  }

  private intelligentRetry<T>(maxRetries: number) {
    return retryWhen<T>(errors =>
      errors.pipe(
        scan((retryCount: number, error: HttpErrorResponse) => {
          const errorDetails = this.classifyError(error);
          if (!errorDetails.canRetry || retryCount >= maxRetries) {
            console.log(`Arrêt des tentatives après ${retryCount} essais`);
            throw error;
          }
          console.log(`Tentative ${retryCount + 1}/${maxRetries} - ${errorDetails.message}`);
          return retryCount + 1;
        }, 0),
        delayWhen((retryCount: number) => {
          const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);
          console.log(`Attente de ${delay}ms avant la prochaine tentative...`);
          return timer(delay);
        })
      )
    );
  }

  private checkConnectivity(): Observable<boolean> {
    console.log('Vérification de la connectivité...');
    return this.http.get(`${this.apiUrl}/api/health`, {
      headers: this.getHeaders()
    }).pipe(
      map(() => true),
      catchError((error) => {
        console.log('Connectivité échouée:', error);
        return of(false);
      })
    );
  }

  /**
   * Récupère les créneaux horaires pour un utilisateur à une date donnée.
   * Modifié pour retourner DaySchedule[] pour inclure day_of_week, break_start, end_break.
   * Cela suppose que l'API peut retourner les informations complètes du planning pour un jour donné,
   * même si c'est une requête par date. Si l'API renvoie uniquement DateSchedule,
   * il faudra adapter l'interface Schedule dans appointments.component.ts.
   */
  getScheduleByMedecinAndDate(userId: number, date: string): Observable<DaySchedule[]> { // Changed return type to DaySchedule[]
    if (!this.http) {
      console.error('HttpClient non disponible');
      return throwError(() => new Error('HttpClient non injecté'));
    }
    if (!this.apiUrl) {
      console.error('apiUrl non défini dans environment');
      return throwError(() => new Error('URL de base non configurée'));
    }

    console.log(`Récupération des horaires pour l'utilisateur ${userId} à la date ${date}`);
    const url = `${this.apiUrl}/api/schedules?user_id=${userId}&date=${date}`;
    console.log('URL de requête:', url);

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      tap(rawResponse => {
        console.log('Réponse brute reçue:', rawResponse);
        console.log('Type de réponse:', typeof rawResponse);
        console.log('Est un tableau:', Array.isArray(rawResponse));
      }),
      map(response => {
        let schedules: any[] = [];

        // Tentative d'extraction des données selon différents formats de réponse
        if (Array.isArray(response)) {
          schedules = response;
        } else if (response && typeof response === 'object' && Array.isArray(response.data)) {
          schedules = response.data;
        } else if (response && typeof response === 'object' && response.available_slots && Array.isArray(response.available_slots)) {
          // Si l'API retourne des créneaux disponibles, on les transforme en DaySchedule
          // ATTENTION: Les propriétés day_of_week, break_start, end_break pourraient être manquantes
          // et devront être déduites ou ajoutées si l'API ne les fournit pas.
          // Pour l'instant, nous allons les simuler ou les laisser null si absents.
          schedules = response.available_slots.map((slot: DateSchedule) => ({
            id: slot.id,
            user_id: slot.user_id,
            is_available: slot.is_available ?? true, // Assume available if not specified
            day_of_week: this.dayOfWeekMap[new Date(slot.date).getDay()], // Deduce day_of_week from date
            start_time: slot.start_time,
            end_time: slot.end_time,
            break_start: null, // API might not provide this in DateSchedule
            end_break: null // API might not provide this in DateSchedule
          }));
        } else if (response.is_available === false) {
          console.log('Médecin non disponible à cette date');
          return [];
        }

        if (schedules.length === 0) {
          console.warn('Aucun horaire trouvé pour la date et le médecin spécifiés, retournant un tableau vide.');
          return [];
        }

        // Normalisation vers DaySchedule, en ajoutant les champs manquants si nécessaire
        return schedules.map(schedule => ({
          id: schedule.id,
          user_id: schedule.user_id || userId,
          is_available: schedule.is_available !== undefined ? schedule.is_available : true,
          day_of_week: schedule.day_of_week || this.dayOfWeekMap[new Date(date).getDay()], // Ensure day_of_week exists
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_start: schedule.break_start || null, // Ensure break_start exists
          end_break: schedule.end_break || null // Ensure end_break exists
        })) as DaySchedule[]; // Cast to DaySchedule[]
      }),
      this.intelligentRetry<DaySchedule[]>(this.MAX_RETRIES), // Type changed here
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur dans getScheduleByMedecinAndDate:', {
          error: error.message,
          status: error.status,
          url: error.url,
          details: this.classifyError(error, error.error)
        });
        return of([]); // Retourne un tableau vide en cas d'erreur
      })
    );
  }

  /**
   * Récupère uniquement les créneaux disponibles (sans les pauses)
   */
  getAvailableSlots(userId: number, date: string): Observable<DateSchedule[]> {
    console.log(`Récupération des créneaux disponibles pour l'utilisateur ${userId} à la date ${date}`);
    const url = `${this.apiUrl}/api/schedules/available?user_id=${userId}&date=${date}`;
    console.log('URL de requête:', url);

    return this.http.get<AvailableScheduleResponse>(url, { headers: this.getHeaders() }).pipe(
      tap(rawResponse => {
        console.log('Réponse brute getAvailableSlots:', rawResponse);
      }),
      map(response => {
        if (!response.is_available) {
          console.log('Médecin non disponible:', response.message);
          return [];
        }

        if (response.available_slots && Array.isArray(response.available_slots)) {
          return response.available_slots.map(slot => ({
            id: slot.id,
            user_id: slot.user_id || userId,
            date: slot.date || date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_break: false,
            is_available: true,
            status: slot.status || 'available'
          }));
        }

        return [];
      }),
      this.intelligentRetry<DateSchedule[]>(this.MAX_RETRIES),
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur dans getAvailableSlots:', {
          error: error.message,
          status: error.status,
          url: error.url,
          details: this.classifyError(error, error.error)
        });
        return of([]);
      })
    );
  }

  /**
   * Récupère les créneaux par jour de la semaine
   */
  getScheduleByDay(userId: number, dayOfWeek: string): Observable<DateSchedule[]> {
    console.log(`Récupération des horaires pour l'utilisateur ${userId} le ${dayOfWeek}`);
    const url = `${this.apiUrl}/api/schedules?user_id=${userId}&day_of_week=${dayOfWeek}`;
    console.log('URL de requête:', url);

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      tap(rawResponse => {
        console.log('Réponse brute getScheduleByDay:', rawResponse);
      }),
      map(response => {
        if (Array.isArray(response)) {
          return this.normalizeScheduleArray(response, userId);
        } else if (response && typeof response === 'object') {
          if (response.available_slots && Array.isArray(response.available_slots)) {
            return this.normalizeScheduleArray(response.available_slots, userId);
          } else if (response.is_available === false) {
            console.log('Médecin non disponible ce jour');
            return [];
          }
        }

        console.warn('Format de réponse inattendu pour getScheduleByDay:', response);
        return [];
      }),
      this.intelligentRetry<DateSchedule[]>(this.MAX_RETRIES),
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur dans getScheduleByDay:', {
          error: error.message,
          status: error.status,
          url: error.url,
          details: this.classifyError(error, error.error)
        });
        return of([]);
      })
    );
  }

  /**
   * Normalise un tableau de créneaux horaires
   */
  private normalizeScheduleArray(schedules: any[], userId: number): DateSchedule[] {
    if (!Array.isArray(schedules)) {
      return [];
    }

    return schedules.map(schedule => ({
      id: schedule.id,
      user_id: schedule.user_id || userId,
      date: schedule.date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      is_break: schedule.is_break || false,
      is_available: schedule.is_available !== false,
      status: schedule.status || (schedule.is_break ? 'break' : 'available')
    }));
  }

  /**
   * Récupère les horaires hebdomadaires
   */
  getSchedule(userId: number): Observable<DaySchedule[]> {
    if (!this.http) {
      console.error('HttpClient non disponible');
      return throwError(() => new Error('HttpClient non injecté'));
    }
    if (!this.apiUrl) {
      console.error('apiUrl non défini dans environment');
      return throwError(() => new Error('URL de base non configurée'));
    }

    console.log(`Récupération des horaires hebdomadaires pour l'utilisateur ${userId}`);
    const url = `${this.apiUrl}/api/schedules?user_id=${userId}`;
    console.log('URL de requête:', url);

    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      tap(rawResponse => {
        console.log('Réponse brute getSchedule:', rawResponse);
        console.log('Type de réponse:', typeof rawResponse);
        console.log('Est un tableau:', Array.isArray(rawResponse));
      }),
      map(response => {
        let dataToValidate: any[] = [];

        if (Array.isArray(response)) {
          dataToValidate = response;
        } else if (response && typeof response === 'object' && Array.isArray(response.data)) {
          dataToValidate = response.data;
        } else {
          console.warn('Format de réponse inattendu pour getSchedule, utilisation des données par défaut.');
          return this.getDefaultSchedule(userId);
        }

        if (dataToValidate.length === 0) {
          console.warn('Tableau vide reçu, utilisation des données par défaut');
          return this.getDefaultSchedule(userId);
        }

        return this.validateSchedule(dataToValidate.map(s => ({
          id: s.id,
          user_id: s.user_id || userId,
          is_available: s.is_available,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          break_start: s.break_start,
          end_break: s.end_break
        })));
      }),
      this.intelligentRetry<DaySchedule[]>(this.MAX_RETRIES),
      catchError((error: HttpErrorResponse) => {
        const errorDetails = this.classifyError(error, error.error);
        console.error('Erreur dans getSchedule:', {
          error: error.message,
          status: error.status,
          url: error.url,
          details: errorDetails
        });

        const cachedData = this.getFromLocalCache(userId);
        if (cachedData) {
          console.log('Utilisation des données en cache');
          return of(cachedData);
        }

        if (errorDetails.type === 'network' || errorDetails.type === 'empty_response') {
          console.log('Utilisation des données par défaut en raison d\'une erreur réseau');
          return of(this.getDefaultSchedule(userId));
        }

        return throwError(() => new Error(`${errorDetails.message} - ${errorDetails.suggestedAction}`));
      })
    );
  }

  saveSchedule(scheduleData: DaySchedule): Observable<ScheduleResponse> {
    if (!this.http) {
      console.error('HttpClient non disponible');
      return throwError(() => new Error('HttpClient non injecté'));
    }
    if (!this.apiUrl) {
      console.error('apiUrl non défini dans environment');
      return throwError(() => new Error('URL de base non configurée'));
    }

    if (!this.isValidDaySchedule(scheduleData)) {
      console.error('Données d\'horaire d\'un jour invalides:', scheduleData);
      return throwError(() => new Error('Données d\'horaire d\'un jour invalides. Vérifiez les champs.'));
    }

    const payload = {
      user_id: scheduleData.user_id,
      day_of_week: scheduleData.day_of_week,
      is_available: scheduleData.is_available,
      start_time: scheduleData.is_available ? scheduleData.start_time : null,
      end_time: scheduleData.is_available ? scheduleData.end_time : null,
      break_start: scheduleData.is_available ? scheduleData.break_start : null,
      end_break: scheduleData.is_available ? scheduleData.end_break : null
    };

    let url: string;
    let method: string;
    if (scheduleData.id) {
      url = `${this.apiUrl}/api/schedules/${scheduleData.id}`;
      method = 'PUT';
    } else {
      url = `${this.apiUrl}/api/schedules`;
      method = 'POST';
    }

    console.log(`Tentative de sauvegarde (${method}) vers ${url} avec payload:`, payload);

    const request = scheduleData.id
      ? this.http.put<ScheduleResponse>(url, payload, { headers: this.getHeaders() })
      : this.http.post<ScheduleResponse>(url, payload, { headers: this.getHeaders() });

    return request.pipe(
      tap(res => console.log('Réponse de sauvegarde:', res)),
      this.intelligentRetry<ScheduleResponse>(this.MAX_RETRIES),
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur brute:', error);
        const errorDetails = this.classifyError(error, error.error);
        console.error('Erreur dans saveSchedule:', {
          error: error.message,
          status: error.status,
          url: error.url,
          details: errorDetails,
          errorData: error.error
        });
        return throwError(() => new Error(`${errorDetails.message} - ${errorDetails.suggestedAction}`));
      })
    );
  }

  private getDefaultSchedule(userId: number): DaySchedule[] {
    console.log('Génération d\'un horaire par défaut');
    return Array.from({ length: 7 }, (_, index) => ({
      id: undefined,
      user_id: userId,
      is_available: index >= 1 && index <= 5,
      day_of_week: this.dayOfWeekMap[index],
      start_time: '08:00',
      end_time: '17:00',
      break_start: '12:00',
      end_break: '13:00'
    }));
  }

  private saveToLocalCache(userId: number, schedule: DaySchedule[]): void {
    try {
      const cacheKey = `schedule_${userId}`;
      const cacheData = {
        schedule,
        timestamp: new Date().toISOString(),
        needsSync: true
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('Données sauvegardées en cache local');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde en cache local:', error);
    }
  }

  private getFromLocalCache(userId: number): DaySchedule[] | null {
    try {
      const cacheKey = `schedule_${userId}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        console.log('Données récupérées du cache local:', parsed);
        return parsed.schedule;
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du cache local:', error);
    }
    return null;
  }

  diagnoseApiConnection(userId: number): Observable<any> {
    const diagnosticInfo = {
      apiUrl: this.apiUrl,
      hasToken: !!localStorage.getItem('token'),
      timestamp: new Date().toISOString()
    };

    console.log('Diagnostic de la connexion API:', diagnosticInfo);

    return this.http.get(`${this.apiUrl}/api/schedules?user_id=${userId}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => ({
        ...diagnosticInfo,
        success: true,
        response,
        responseType: typeof response,
        isArray: Array.isArray(response)
      })),
      catchError(error => {
        return of({
          ...diagnosticInfo,
          success: false,
          error: error.message,
          status: error.status,
          statusText: error.statusText
        });
      })
    );
  }

  private isValidSchedule(schedule: DaySchedule[]): boolean {
    if (!Array.isArray(schedule) || schedule.length !== 7) {
      console.error('Format d\'horaire invalide: pas un tableau de 7 éléments');
      return false;
    }
    return schedule.every((day, index) => {
      const isValid = this.isValidDaySchedule(day);
      if (!isValid) {
        console.error(`Jour ${index} invalide:`, day);
      }
      return isValid;
    });
  }

  private isValidDaySchedule(day: DaySchedule): boolean {
    if (!day || typeof day !== 'object') {
      return false;
    }

    const { user_id, is_available, day_of_week, start_time, end_time, break_start, end_break } = day;

    if (typeof user_id !== 'number' || user_id <= 0) {
      console.error('Validation échouée: user_id manquant ou invalide.');
      return false;
    }
    if (typeof is_available !== 'boolean') {
      console.error('Validation échouée: is_available manquant ou invalide.');
      return false;
    }
    if (typeof day_of_week !== 'string' || !this.dayOfWeekMap.includes(day_of_week)) {
      console.error('Validation échouée: day_of_week manquant ou invalide.');
      return false;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (is_available) {
      if (!start_time || typeof start_time !== 'string' || !timeRegex.test(start_time)) {
        console.error('Validation échouée: start_time manquant ou invalide:', start_time);
        return false;
      }
      if (!end_time || typeof end_time !== 'string' || !timeRegex.test(end_time)) {
        console.error('Validation échouée: end_time manquant ou invalide:', end_time);
        return false;
      }
      if (break_start !== null && (typeof break_start !== 'string' || !timeRegex.test(break_start))) {
        console.error('Validation échouée: break_start invalide:', break_start);
        return false;
      }
      if (end_break !== null && (typeof end_break !== 'string' || !timeRegex.test(end_break))) {
        console.error('Validation échouée: end_break invalide:', end_break);
        return false;
      }

      const start = this.timeToMinutes(start_time);
      const end = this.timeToMinutes(end_time);
      const breakStartMin = break_start ? this.timeToMinutes(break_start) : null;
      const breakEndMin = end_break ? this.timeToMinutes(end_break) : null;

      if (end <= start) {
        console.error('Validation échouée: L\'heure de fin doit être après l\'heure de début.');
        return false;
      }

      if (breakStartMin !== null && breakEndMin !== null) {
        if (breakStartMin < start || breakEndMin > end || breakEndMin <= breakStartMin) {
          console.error('Validation échouée: La pause doit être à l\'intérieur des heures de travail et la fin de la pause doit être après le début de la pause.');
          return false;
        }
      } else if ((breakStartMin === null && breakEndMin !== null) || (breakStartMin !== null && breakEndMin === null)) {
        console.error('Validation échouée: break_start et end_break doivent être tous les deux null ou tous les deux des chaînes de temps valides.');
        return false;
      }

    } else if (start_time !== null || end_time !== null || break_start !== null || end_break !== null) {
      console.error('Validation échouée: Les heures doivent être null pour un jour non disponible.');
      return false;
    }

    return true;
  }

  private validateSchedule(schedule: DaySchedule[]): DaySchedule[] {
    if (!Array.isArray(schedule)) {
      console.warn('Données d\'horaire non valides (non un tableau), utilisation des données par défaut.');
      return this.getDefaultSchedule(0);
    }

    return schedule.map(day => ({
      id: day.id,
      user_id: day.user_id,
      is_available: Boolean(day.is_available),
      day_of_week: day.day_of_week,
      start_time: day.is_available ? (day.start_time || '08:00') : null,
      end_time: day.is_available ? (day.end_time || '17:00') : null,
      break_start: day.is_available ? (day.break_start || '12:00') : null,
      end_break: day.is_available ? (day.end_break || '13:00') : null
    }));
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
