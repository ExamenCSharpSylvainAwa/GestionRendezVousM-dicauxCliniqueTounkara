import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ApiService, Medecin, Appointment, PaginatedResponse, User } from '../../services/api.service';
import { ScheduleService } from '../../services/schedule.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { map, Observable, throwError } from 'rxjs';
import { forkJoin } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CancelAppointmentDialogComponent, CancelDialogResult, CancelDialogData } from '../cancel-appointment-dialog/cancel-appointment-dialog.component';

// Interfaces (inchangées)
interface AppointmentForm {
  patient_id: number;
  medecin_id: number;
  date: string;
  heure: string;
  motif: string;
  tarif?: number | null;
  statut?: 'en_attente' | 'confirme' | 'annule' | 'termine';
}

interface ProfileResponse {
  user: User;
}

interface Schedule {
  id: number;
  user_id: number;
  day_of_week: string;
  is_available: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  end_break: string | null;
  created_at?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    FormsModule,
    CommonModule,
    MatSnackBarModule
  ],
  templateUrl: './appointments.component.html',
  styleUrls: ['./appointments.component.scss']
})
export class AppointmentsComponent implements OnInit {
  medecins$: Observable<PaginatedResponse<Medecin>>;
  appointments: Appointment[] = [];
  selectedMedecinId: number = 0;
  selectedPatientId: number = 0;
  errorMessage: string = '';
  isLoading: boolean = false;
  currentUser$: Observable<any>;
  currentUser: User | null = null;
  isUserLoaded: boolean = false;
  isReady: boolean = false;

  selectedMedecinTarif: number | null = null;

  noServiceMessage: string = '';
  isCheckingSchedule: boolean = false;
  availabilityMessage: string = '';
  successMessage: string = '';

  private debounceTimer: any;

  minDate: Date;

  newAppointment: AppointmentForm = {
    patient_id: 0,
    medecin_id: 0,
    date: '',
    heure: '',
    motif: '',
    statut: 'en_attente'
  };

  availableHours: string[] = [];

  constructor(
    private apiService: ApiService,
    private scheduleService: ScheduleService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    console.log('ApiService injecté:', this.apiService);
    console.log('ScheduleService injecté:', this.scheduleService);
    if (!this.apiService) {
      console.error('ApiService non injecté');
    } else {
      console.log('HttpClient disponible dans ApiService:', !!this.apiService['http']);
    }
    this.medecins$ = this.apiService.getMedecins();
    this.currentUser$ = this.apiService.getProfile();
    this.minDate = new Date();
  }

  ngOnInit() {
    console.log('AppointmentsComponent initialized');
    console.log('ApiService available:', !!this.apiService);

    this.loadAppointments();
    this.currentUser$.subscribe({
      next: (response: any) => {
        console.log('User profile response:', response);
        let userData: User = response && response.user ? response.user : response;
        this.currentUser = userData;

        if (userData && userData.id) {
          if (userData.role === 'patient') {
            this.getPatientIdFromUser(userData.id);
          } else {
            this.newAppointment.patient_id = Number(userData.id);
            this.isUserLoaded = true;
            this.isReady = true;
          }
          console.log('User loaded - ID:', userData.id, 'Role:', userData.role);
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading user profile:', error);
        this.errorMessage = `Erreur: ${error.status} - ${error.message || 'Aucune description'}`;
        this.cdr.detectChanges();
      }
    });
  }

  private getPatientIdFromUser(userId: number) {
    this.apiService.getPatients().subscribe({
      next: (patientsResponse: PaginatedResponse<any>) => {
        const userPatient = patientsResponse.data.find((patient: any) =>
          patient.user && patient.user.id === userId
        );

        if (userPatient) {
          console.log('Patient trouvé:', userPatient);
          this.newAppointment.patient_id = userPatient.id;
          this.selectedPatientId = userPatient.id;
          this.isUserLoaded = true;
          this.isReady = true;
        } else {
          console.error('Aucun patient trouvé pour user_id:', userId);
          this.errorMessage = 'Aucun profil patient trouvé pour cet utilisateur';
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Erreur lors de la récupération des patients:', error);
        this.errorMessage = 'Erreur lors de la récupération des informations patient';
        this.cdr.detectChanges();
      }
    });
  }

  loadAppointments() {
    console.log('Appel à getAppointments');
    const appointmentsObservable = this.apiService.getAppointments();
    appointmentsObservable.subscribe({
      next: (response: PaginatedResponse<Appointment>) => {
        console.log('Réponse getAppointments:', response);
        this.appointments = response.data || [];
      },
      error: (error: HttpErrorResponse) => {
        console.error('Erreur dans getAppointments:', error);
        this.errorMessage = `Erreur: ${error.status} - ${error.message || 'Aucune description'}`;
      }
    });
  }

  private validateForm(): boolean {
    console.log('Validation - patient_id:', this.newAppointment.patient_id, 'isUserLoaded:', this.isUserLoaded);

    if (!this.newAppointment.patient_id || this.newAppointment.patient_id <= 0) {
      this.errorMessage = 'Aucun patient sélectionné ou ID invalide';
      return false;
    }

    if (!this.newAppointment.medecin_id || this.newAppointment.medecin_id <= 0) {
      this.errorMessage = 'Veuillez sélectionner un médecin';
      return false;
    }

    if (!this.newAppointment.date) {
      this.errorMessage = 'La date est requise';
      return false;
    }

    if (!this.newAppointment.heure) {
      this.errorMessage = 'L\'heure est requise';
      return false;
    }

    const appointmentDateTime = new Date(`${this.newAppointment.date}T${this.newAppointment.heure}`);
    const now = new Date();

    if (appointmentDateTime <= now) {
      this.errorMessage = 'La date et l\'heure du rendez-vous doivent être dans le futur';
      return false;
    }

    if (!this.newAppointment.motif.trim()) {
      this.errorMessage = 'Le motif est requis';
      return false;
    }

    if (this.selectedMedecinTarif === null || this.selectedMedecinTarif === undefined) {
      this.errorMessage = 'Impossible de récupérer le tarif du médecin';
      return false;
    }

    return true;
  }

  private resetForm() {
    let patientId = 0;
    if (this.currentUser) {
      if (this.currentUser.role === 'patient') {
        patientId = this.newAppointment.patient_id;
      } else {
        patientId = 0;
      }
    }

    this.newAppointment = {
      patient_id: patientId,
      medecin_id: 0,
      date: '',
      heure: '',
      motif: '',
      tarif: undefined,
      statut: 'en_attente'
    };
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedMedecinTarif = null;
  }

  getCurrentUserName(): string {
    console.log('getCurrentUserName called, currentUser:', this.currentUser);
    return this.currentUser ? `${this.currentUser.nom} ${this.currentUser.prenom}` : 'Utilisateur non connecté';
  }

  formatDate(date: string): string {
    if (!date) return '';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(dateTime: string): string {
    if (!dateTime) return '';
    const dateObj = new Date(dateTime);
    return dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  trackAppointmentById(index: number, appointment: Appointment): any {
    return appointment.id || index;
  }

  getAvailableHours(): Promise<void> {
    if (!this.newAppointment.medecin_id || !this.newAppointment.date) {
      this.availableHours = [];
      this.noServiceMessage = '';
      this.availabilityMessage = '';
      this.selectedMedecinTarif = null;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.isCheckingSchedule = true;
      this.availableHours = [];
      this.noServiceMessage = '';
      this.availabilityMessage = '';
      this.errorMessage = '';
      this.selectedMedecinTarif = null;

      this.medecins$.subscribe({
        next: (medecinsResponse) => {
          const selectedMedecin = medecinsResponse.data.find(m => m.id === this.newAppointment.medecin_id);

          if (!selectedMedecin || !selectedMedecin.user || !selectedMedecin.user.id) {
            console.error('Médecin sélectionné ou user_id non trouvé:', selectedMedecin);
            this.noServiceMessage = 'Erreur: informations du médecin non disponibles.';
            this.availableHours = [];
            this.availabilityMessage = '';
            this.isCheckingSchedule = false;
            this.cdr.detectChanges();
            resolve();
            return;
          }

          this.selectedMedecinTarif = selectedMedecin.tarif_consultation !== undefined ? selectedMedecin.tarif_consultation : null;
          console.log('Tarif du médecin sélectionné:', this.selectedMedecinTarif);

          const userId = selectedMedecin.user.id;
          const medecinName = `${selectedMedecin.user.nom} ${selectedMedecin.user.prenom}`;

          const timeoutDuration = 10000;
          const timeoutPromise = new Promise((_, timeoutReject) => {
            setTimeout(() => timeoutReject(new Error('Timeout')), timeoutDuration);
          });

          Promise.race([
            forkJoin({
              schedules: this.scheduleService.getScheduleByMedecinAndDate(userId, this.newAppointment.date),
              existingAppointments: this.getExistingAppointments(this.newAppointment.medecin_id, this.newAppointment.date)
            }).toPromise(),
            timeoutPromise
          ]).then((result: any) => {
            const { schedules, existingAppointments } = result;

            console.log('Schedules récupérés:', schedules);
            console.log('Rendez-vous existants:', existingAppointments);

            if (!schedules || schedules.length === 0) {
              this.noServiceMessage = `Le Dr ${medecinName} n'est pas en service le ${this.formatDate(this.newAppointment.date)}.`;
              this.availableHours = [];
              this.availabilityMessage = '';
              this.isCheckingSchedule = false;
              this.cdr.detectChanges();
              resolve();
              return;
            }

            const workingSchedules = schedules.filter((schedule: Schedule) => schedule.is_available);

            if (workingSchedules.length === 0) {
              this.noServiceMessage = `Le Dr ${medecinName} n'a pas d'horaires de travail disponibles le ${this.formatDate(this.newAppointment.date)}.`;
              this.availableHours = [];
              this.availabilityMessage = '';
              this.isCheckingSchedule = false;
              this.cdr.detectChanges();
              resolve();
              return;
            }

            this.processAvailableSlots(workingSchedules, existingAppointments, medecinName);

            this.isCheckingSchedule = false;
            this.cdr.detectChanges();
            resolve();

          }).catch((error) => {
            console.error('Erreur lors de la récupération des données:', error);

            if (error.message === 'Timeout') {
              this.noServiceMessage = `Délai d'attente dépassé lors de la vérification des horaires du Dr ${medecinName}.`;
            } else {
              this.noServiceMessage = `Impossible de vérifier les horaires du Dr ${medecinName} pour le ${this.formatDate(this.newAppointment.date)}. Veuillez réessayer.`;
            }

            this.availableHours = [];
            this.availabilityMessage = '';
            this.isCheckingSchedule = false;
            this.cdr.detectChanges();
            reject(error);
          });
        },
        error: (error) => {
          console.error('Erreur lors de la récupération des médecins:', error);
          this.noServiceMessage = 'Erreur lors de la récupération des informations des médecins.';
          this.availableHours = [];
          this.availabilityMessage = '';
          this.isCheckingSchedule = false;
          this.cdr.detectChanges();
          reject(error);
        }
      });
    });
  }

  private processAvailableSlots(workingSchedules: Schedule[], existingAppointments: Appointment[], medecinName: string) {
    const occupiedHours = existingAppointments
      .filter(appointment => appointment.statut === 'confirme' || appointment.statut === 'en_attente')
      .map(appointment => {
        const appointmentDate = new Date(appointment.date_heure);
        const timeString = appointmentDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        return timeString;
      });

    console.log('Heures occupées (statut "confirme" ou "en_attente"):', occupiedHours);

    const allSlots = this.generateHourSlots();
    console.log('Tous les créneaux:', allSlots);

    const slotsInWorkingTime = allSlots.filter(hour => this.isTimeInWorkingSchedule(hour, workingSchedules));
    const occupiedSlotsInWorkingTime = slotsInWorkingTime.filter(hour => occupiedHours.includes(hour));
    const availableSlotsInWorkingTime = slotsInWorkingTime.filter(hour => !occupiedHours.includes(hour));

    const today = new Date();
    const selectedDate = new Date(this.newAppointment.date);
    const isToday = selectedDate.toDateString() === today.toDateString();

    let finalAvailableSlots = availableSlotsInWorkingTime;

    if (isToday) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      finalAvailableSlots = availableSlotsInWorkingTime.filter(hour => {
        const [hourNum, minuteNum] = hour.split(':').map(Number);
        const slotTimeInMinutes = hourNum * 60 + minuteNum;
        return slotTimeInMinutes > currentTimeInMinutes + 30; // Laisser 30 minutes de marge
      });
    }

    console.log('Créneaux dans les horaires de travail:', slotsInWorkingTime);
    console.log('Créneaux occupés dans les horaires de travail:', occupiedSlotsInWorkingTime);
    console.log('Créneaux disponibles finaux:', finalAvailableSlots);

    this.availableHours = finalAvailableSlots;

    if (slotsInWorkingTime.length === 0) {
      this.noServiceMessage = `Le Dr ${medecinName} n'a pas d'horaires de travail le ${this.formatDate(this.newAppointment.date)}.`;
      this.availabilityMessage = '';
    } else if (finalAvailableSlots.length === 0) {
      if (occupiedSlotsInWorkingTime.length > 0) {
        const occupiedTimesText = occupiedSlotsInWorkingTime.join(', ');
        this.noServiceMessage = `Le Dr ${medecinName} n'a plus de créneaux disponibles le ${this.formatDate(this.newAppointment.date)}.`;
        this.availabilityMessage = `❌ Tous les créneaux sont pris : ${occupiedTimesText}`;
      } else {
        this.noServiceMessage = `Le Dr ${medecinName} n'a pas de créneaux disponibles le ${this.formatDate(this.newAppointment.date)}.`;
        this.availabilityMessage = isToday ? '⏰ Créneaux passés pour aujourd\'hui' : '';
      }
    } else {
      this.noServiceMessage = '';
      if (occupiedSlotsInWorkingTime.length > 0) {
        const occupiedTimesText = occupiedSlotsInWorkingTime.join(', ');
        this.availabilityMessage = `⚠️ Créneaux déjà pris : ${occupiedTimesText}`;
      } else {
        this.availabilityMessage = `✅ ${finalAvailableSlots.length} créneaux disponibles`;
      }
    }
  }

  private isTimeInWorkingSchedule(timeSlot: string, workingSchedules: Schedule[]): boolean {
    const [hourNum, minuteNum] = timeSlot.split(':').map(Number);

    return workingSchedules.some(schedule => {
      const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
      const [endHour, endMinute] = schedule.end_time.split(':').map(Number);

      const slotMinutes = hourNum * 60 + minuteNum;
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        if (schedule.break_start && schedule.end_break) {
          const [breakStartHour, breakStartMinute] = schedule.break_start.split(':').map(Number);
          const [breakEndHour, breakEndMinute] = schedule.end_break.split(':').map(Number);

          const breakStartMinutes = breakStartHour * 60 + breakStartMinute;
          const breakEndMinutes = breakEndHour * 60 + breakEndMinute;

          if (
            (slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes) ||
            ((slotMinutes + 30) > breakStartMinutes && (slotMinutes + 30) <= breakEndMinutes) ||
            (slotMinutes < breakStartMinutes && (slotMinutes + 30) > breakEndMinutes)
          ) {
            return false;
          }
        }
        return true;
      }
      return false;
    });
  }

  private generateHourSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        slots.push(`${hourStr}:${minuteStr}`);
      }
    }
    return slots;
  }

  onDateChange(event: any) {
    this.newAppointment.date = event.value.toISOString().split('T')[0];
    this.newAppointment.heure = '';
    this.availableHours = [];
    this.availabilityMessage = '';
    this.errorMessage = '';
    this.debounceGetAvailableHours();
  }

  async onSubmit() {
    console.log('🔥 1. onSubmit() APPELÉE !');
    console.log('🔥 2. Form data:', this.newAppointment);
    console.log('🔥 3. isReady:', this.isReady);

    if (!this.isReady) {
      console.log('❌ 4. Form not ready');
      this.errorMessage = 'Formulaire non prêt. Veuillez patienter.';
      return;
    }
    console.log('✅ 4. Form is ready');

    if (!this.validateForm()) {
      console.log('❌ 5. Form validation failed');
      console.log('❌ 5. ErrorMessage:', this.errorMessage);
      return;
    }
    console.log('✅ 5. Form validation passed');

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      console.log('🔄 6. Refreshing availability before submit...');

      await this.getAvailableHours();

      if (!this.availableHours.includes(this.newAppointment.heure)) {
        console.log('❌ 7. Selected hour no longer available after refresh');
        this.errorMessage = 'Le créneau sélectionné n\'est plus disponible. Veuillez sélectionner un nouveau créneau.';
        this.isLoading = false;
        return;
      }
      console.log('✅ 7. Selected hour is still available');

      console.log('🔄 8. Creating appointment datetime...');
      const appointmentDateTime = new Date(`${this.newAppointment.date}T${this.newAppointment.heure}`);

      if (isNaN(appointmentDateTime.getTime())) {
        throw new Error('Format de date et heure invalide');
      }
      console.log('✅ 8. DateTime created:', appointmentDateTime);

      const appointmentData = {
        patient_id: this.newAppointment.patient_id,
        medecin_id: this.newAppointment.medecin_id,
        date_heure: appointmentDateTime.toISOString(),
        motif: this.newAppointment.motif.trim(),
        tarif: this.selectedMedecinTarif !== null ? this.selectedMedecinTarif : undefined,
        statut: 'en_attente' as const
      };

      console.log('🚀 9. Sending appointment data:', appointmentData);

      this.apiService.createAppointment(appointmentData).subscribe({
        next: (response: any) => {
          console.log('✅ 10. SUCCESS - Response received:', response);
          this.handleSuccessfulCreation(response);
        },
        error: (error: any) => {
          console.log('❌ 10. ERROR - Error received:', error);
          this.handleCreationError(error);
        }
      });

    } catch (error) {
      console.error('❌ EXCEPTION in onSubmit:', error);
      this.errorMessage = 'Erreur lors de la préparation des données';
      this.isLoading = false;
    }
  }

  private handleSuccessfulCreation(response: any) {
    console.log('Appointment created successfully:', response);
    this.resetForm();
    this.loadAppointments();
    this.isLoading = false;
    this.errorMessage = '';
    this.showSnackBar('Rendez-vous créé avec succès ! 🎉', 'success');
  }

  private handleCreationError(error: any) {
    console.error('Creation error:', error);
    this.isLoading = false;

    if (error.shouldRefreshSchedule) {
      console.log('🔄 Refreshing schedule due to error...');
      this.refreshAvailableHours();
    }

    // Réinitialiser les champs date, heure et motif en cas d'erreur spécifique
    if (error.status === 422 || error.status === 409 || (error.status === 400 && error.error?.error_code === 'MEDECIN_NON_DISPONIBLE')) {
      this.newAppointment.date = '';
      this.newAppointment.heure = '';
      this.newAppointment.motif = '';
      this.availableHours = []; // Vider les heures disponibles
      this.availabilityMessage = ''; // Vider le message de disponibilité
      this.noServiceMessage = ''; // Vider le message de non-service
      this.cdr.detectChanges(); // Forcer la détection des changements pour rafraîchir l'UI
    }


    if (error.status === 422) {
      if (error.error && error.error.message) {
        this.errorMessage = error.error.message;
      } else if (error.error && error.error.errors) {
        const validationErrors = Object.values(error.error.errors).flat();
        this.errorMessage = validationErrors.join(', ');
      } else {
        this.errorMessage = 'Données invalides. Veuillez vérifier les informations saisies.';
      }
    } else if (error.status === 409) {
      this.errorMessage = 'Ce créneau a déjà été pris par un autre patient. Veuillez sélectionner un autre créneau.';
    } else if (error.status === 400) {
      if (error.error && error.error.error_code === 'MEDECIN_NON_DISPONIBLE') {
        this.errorMessage = 'Le créneau sélectionné n\'est plus disponible. Veuillez sélectionner un nouveau créneau.';
      } else {
        this.errorMessage = error.error?.message || 'Requête invalide.';
      }
    } else if (error.status === 500) {
      this.errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    } else {
      this.errorMessage = error.message || 'Erreur lors de la création du rendez-vous';
    }

    this.showSnackBar(this.errorMessage, 'error');
    console.error('Erreur détaillée:', error);
  }

  private showSnackBar(message: string, panelClass: string = 'info') {
    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: [`snackbar-${panelClass}`]
    });
  }

  onMedecinChange() {
    this.newAppointment.heure = '';
    this.availableHours = [];
    this.availabilityMessage = '';
    this.errorMessage = '';

    this.debounceGetAvailableHours();
  }

  private debounceGetAvailableHours() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.getAvailableHours();
    }, 300);
  }

  refreshAvailableHours() {
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.errorMessage = '';
    this.getAvailableHours();
  }

  getExistingAppointments(medecinId: number, date: string): Observable<Appointment[]> {
    return this.apiService.getAppointments().pipe(
      map((response: PaginatedResponse<Appointment>) => {
        const filteredAppointments = response.data.filter(appointment => {
          const appointmentDate = new Date(appointment.date_heure);
          const appointmentDateString = appointmentDate.toISOString().split('T')[0];
          const isMatch = appointment.medecin_id === medecinId && appointmentDateString === date;

          console.log(`Appointment ${appointment.id}: medecin_id=${appointment.medecin_id}, date=${appointmentDateString}, statut=${appointment.statut}, match=${isMatch}`);

          return isMatch;
        });

        console.log('Filtered existing appointments:', filteredAppointments);
        return filteredAppointments;
      }),
      catchError(error => {
        console.error('Error fetching existing appointments:', error);
        return throwError(() => new Error('Could not fetch existing appointments.'));
      })
    );
  }

  viewAppointmentDetails(appointmentId: number): void {
    console.log(`Voir les détails du rendez-vous avec l'ID: ${appointmentId}`);
    this.showSnackBar(`Détails du rendez-vous ${appointmentId} (fonction à implémenter)`, 'info');
  }

  /**
   * Annule un rendez-vous spécifique.
   * @param appointment L'objet rendez-vous complet à annuler.
   */
  cancelAppointment(appointment: Appointment): void {
    console.log(`Tentative d'annulation du rendez-vous avec l'ID: ${appointment.id}`);
    this.isLoading = true;
    this.errorMessage = '';

    // Préparer les données pour la modale
    const dialogData: CancelDialogData = {
      appointmentId: appointment.id!,
      // CORRECTION ICI : Accès aux noms via l'objet 'user' imbriqué
      patientName: appointment.patient?.user ? `${appointment.patient.user.prenom} ${appointment.patient.user.nom}` : 'N/A',
      doctorName: appointment.medecin?.user ? `Dr. ${appointment.medecin.user.prenom} ${appointment.medecin.user.nom}` : 'N/A',
      appointmentDate: this.formatDateTime(appointment.date_heure) // Formater la date et l'heure
    };

    const dialogRef = this.dialog.open(CancelAppointmentDialogComponent, {
      width: '400px',
      data: dialogData // Passez l'objet dialogData préparé
    });

    dialogRef.afterClosed().subscribe((result: CancelDialogResult | undefined) => {
      if (result && result.confirmed) {
        const reason = result.reason || 'Annulé par l\'utilisateur';

        this.apiService.cancelAppointment(appointment.id!, reason).subscribe({
          next: (response) => {
            console.log('Rendez-vous annulé avec succès:', response);
            this.showSnackBar('Rendez-vous annulé et créneau libéré !', 'success');
            this.loadAppointments();
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Erreur lors de l\'annulation du rendez-vous:', error);
            let errorMessage = 'Impossible d\'annuler le rendez-vous. Veuillez réessayer.';
            if (error.type === 'NOT_FOUND') {
              errorMessage = 'Rendez-vous non trouvé.';
            } else if (error.message) {
              errorMessage = error.message;
            }
            this.showSnackBar(errorMessage, 'error');
            this.isLoading = false;
          }
        });
      } else {
        console.log('Annulation du rendez-vous annulée par l\'utilisateur.');
        this.isLoading = false;
      }
    });
  }

  getAppointmentStatusClass(statut: 'en_attente' | 'confirme' | 'annule' | 'termine'): string {
    switch (statut) {
      case 'en_attente':
        return 'status-en_attente';
      case 'confirme':
        return 'status-confirme';
      case 'annule':
        return 'status-annule';
      case 'termine':
        return 'status-termine';
      default:
        return '';
    }
  }

  getAppointmentStatusLabel(statut: 'en_attente' | 'confirme' | 'annule' | 'termine'): string {
    switch (statut) {
      case 'en_attente':
        return 'En attente';
      case 'confirme':
        return 'Confirmé';
      case 'annule':
        return 'Annulé';
      case 'termine':
        return 'Terminé';
      default:
        return 'Inconnu';
    }
  }
}
