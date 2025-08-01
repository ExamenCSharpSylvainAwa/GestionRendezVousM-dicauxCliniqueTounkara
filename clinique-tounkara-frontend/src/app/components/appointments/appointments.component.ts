import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ApiService, Medecin, Appointment, PaginatedResponse, User, CreateAppointmentRequest } from '../../services/api.service';
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
import { animate, style, transition, trigger, stagger, query } from '@angular/animations';

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
    MatSnackBarModule,
  ],
  templateUrl: './appointments.component.html',
  styleUrls: ['./appointments.component.scss'],
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('800ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('slideInLeft', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-30px)' }),
        animate('800ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
    trigger('slideInRight', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(30px)' }),
        animate('800ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
    trigger('slideInDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('800ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('slideInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('400ms ease-in', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('400ms ease-out', style({ opacity: 0 })),
      ]),
    ]),
    trigger('pulse', [
      transition('* => *', [
        animate('600ms ease-in-out', style({ transform: 'scale(1.02)' })),
        animate('600ms ease-in-out', style({ transform: 'scale(1)' })),
      ]),
    ]),
    trigger('shakeAnimation', [
      transition(':enter', [
        style({ transform: 'translateX(0)' }),
        animate('500ms ease', style({ transform: 'translateX(5px)' })),
        animate('500ms ease', style({ transform: 'translateX(-5px)' })),
        animate('500ms ease', style({ transform: 'translateX(0)' })),
      ]),
    ]),
    trigger('floatAnimation', [
      transition('* => *', [
        animate('3000ms ease-in-out', style({ transform: 'translateY(-10px)' })),
        animate('3000ms ease-in-out', style({ transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('staggerAnimation', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('100ms', [
            animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
    trigger('listItemAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('buttonScale', [
      transition(':enter', [
        style({ transform: 'scale(1)' }),
        animate('300ms ease', style({ transform: 'scale(1.05)' })),
      ]),
      transition(':leave', [
        animate('300ms ease', style({ transform: 'scale(1)' })),
      ]),
    ]),
    trigger('buttonHover', [
      transition(':enter', [
        style({ transform: 'scale(1)' }),
        animate('300ms ease', style({ transform: 'scale(1.05)' })),
      ]),
      transition(':leave', [
        animate('300ms ease', style({ transform: 'scale(1)' })),
      ]),
    ]),
  ],
})
export class AppointmentsComponent implements OnInit {
  medecins$: Observable<PaginatedResponse<Medecin>>;
  appointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  selectedFilterDate: string | null = null;
  selectedStatusFilter: string = '';
  selectedDoctorFilter: string = '';
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
  appointmentStats: { icon: string; count: number; label: string; class: string }[] = [];

  newAppointment: AppointmentForm = {
    patient_id: 0,
    medecin_id: 0,
    date: '',
    heure: '',
    motif: '',
    statut: 'en_attente',
  };

  availableHours: string[] = [];

  constructor(
    private apiService: ApiService,
    private scheduleService: ScheduleService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.medecins$ = this.apiService.getMedecins();
    this.currentUser$ = this.apiService.getProfile();
    this.minDate = new Date();
  }

  ngOnInit() {
    this.loadAppointments();
    this.currentUser$.subscribe({
      next: (response: any) => {
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
          this.cdr.detectChanges();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = `Erreur: ${error.status} - ${error.message || 'Aucune description'}`;
        this.cdr.detectChanges();
      },
    });
  }

  private getPatientIdFromUser(userId: number) {
    this.apiService.getPatients().subscribe({
      next: (patientsResponse: PaginatedResponse<any>) => {
        const userPatient = patientsResponse.data.find((patient: any) =>
          patient.user && patient.user.id === userId
        );
        if (userPatient) {
          this.newAppointment.patient_id = userPatient.id;
          this.selectedPatientId = userPatient.id;
          this.isUserLoaded = true;
          this.isReady = true;
        } else {
          this.errorMessage = 'Aucun profil patient trouvé pour cet utilisateur';
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = 'Erreur lors de la récupération des informations patient';
        this.cdr.detectChanges();
      },
    });
  }

  loadAppointments() {
    this.apiService.getAppointments().subscribe({
      next: (response: PaginatedResponse<Appointment>) => {
        this.appointments = (response.data || []).sort((a, b) => {
          return new Date(b.date_heure).getTime() - new Date(a.date_heure).getTime();
        });
        this.filteredAppointments = this.appointments.length > 0 ? [this.appointments[0]] : [];
        this.initializeStats();
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = `Erreur: ${error.status} - ${error.message || 'Aucune description'}`;
        this.cdr.detectChanges();
      },
    });
  }

  private initializeStats() {
    this.appointmentStats = [
      {
        icon: 'hourglass_empty',
        count: this.appointments.filter(a => a.statut === 'en_attente').length,
        label: 'En attente',
        class: 'status-en_attente',
      },
      {
        icon: 'check_circle',
        count: this.appointments.filter(a => a.statut === 'confirme').length,
        label: 'Confirmés',
        class: 'status-confirme',
      },
      {
        icon: 'cancel',
        count: this.appointments.filter(a => a.statut === 'annule').length,
        label: 'Annulés',
        class: 'status-annule',
      },
      {
        icon: 'done_all',
        count: this.appointments.filter(a => a.statut === 'termine').length,
        label: 'Terminés',
        class: 'status-termine',
      },
    ];
  }

  onFilterDateChange(event: any) {
    this.selectedFilterDate = event.value ? event.value.toISOString().split('T')[0] : null;
    this.filterAppointments();
  }

  onStatusFilterChange() {
    this.filterAppointments();
  }

  onDoctorFilterChange() {
    this.filterAppointments();
  }

  private filterAppointments() {
    let filtered = this.appointments;

    if (this.selectedFilterDate) {
      filtered = filtered.filter(appointment => {
        const appointmentDate = new Date(appointment.date_heure).toISOString().split('T')[0];
        return appointmentDate === this.selectedFilterDate;
      });
    }

    if (this.selectedStatusFilter) {
      filtered = filtered.filter(appointment => appointment.statut === this.selectedStatusFilter);
    }

    if (this.selectedDoctorFilter) {
      filtered = filtered.filter(appointment => appointment.medecin_id === +this.selectedDoctorFilter);
    }

    this.filteredAppointments = filtered.sort((a, b) => {
      return new Date(b.date_heure).getTime() - new Date(a.date_heure).getTime();
    });

    this.cdr.detectChanges();
  }

  resetAllFilters() {
    this.selectedFilterDate = null;
    this.selectedStatusFilter = '';
    this.selectedDoctorFilter = '';
    this.filterAppointments();
  }

  hasActiveFilters(): boolean {
    return !!this.selectedFilterDate || !!this.selectedStatusFilter || !!this.selectedDoctorFilter;
  }

  getEmptyStateMessage(): string {
    if (this.hasActiveFilters()) {
      return 'Aucun rendez-vous ne correspond aux filtres sélectionnés. Essayez de modifier ou réinitialiser les filtres.';
    }
    return 'Vous n\'avez aucun rendez-vous planifié pour le moment.';
  }

  getStatusIcon(status: string): string {
    if (status.includes('⚠️') || status === 'en_attente') {
      return 'warning';
    } else if (status.includes('❌') || status === 'annule') {
      return 'error';
    } else if (status.includes('✅') || status === 'confirme' || status === 'termine') {
      return 'check_circle';
    }
    return 'info';
  }

  private validateForm(): boolean {
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
      }
    }
    this.newAppointment = {
      patient_id: patientId,
      medecin_id: 0,
      date: '',
      heure: '',
      motif: '',
      statut: 'en_attente',
    };
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedMedecinTarif = null;
  }

  getCurrentUserName(): string {
    return this.currentUser ? `${this.currentUser.nom} ${this.currentUser.prenom}` : 'Utilisateur non connecté';
  }

  formatDate(date: string): string {
    if (!date) return '';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
      minute: '2-digit',
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
            this.noServiceMessage = 'Erreur: informations du médecin non disponibles.';
            this.availableHours = [];
            this.availabilityMessage = '';
            this.isCheckingSchedule = false;
            this.cdr.detectChanges();
            resolve();
            return;
          }
          this.selectedMedecinTarif = selectedMedecin.tarif_consultation !== undefined ? selectedMedecin.tarif_consultation : null;
          const userId = selectedMedecin.user.id;
          const medecinName = `${selectedMedecin.user.nom} ${selectedMedecin.user.prenom}`;
          const timeoutDuration = 10000;
          const timeoutPromise = new Promise((_, timeoutReject) => {
            setTimeout(() => timeoutReject(new Error('Timeout')), timeoutDuration);
          });
          Promise.race([
            forkJoin({
              schedules: this.scheduleService.getScheduleByMedecinAndDate(userId, this.newAppointment.date),
              existingAppointments: this.getExistingAppointments(this.newAppointment.medecin_id, this.newAppointment.date),
            }).toPromise(),
            timeoutPromise,
          ])
            .then((result: any) => {
              const { schedules, existingAppointments } = result;
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
            })
            .catch((error) => {
              this.noServiceMessage =
                error.message === 'Timeout'
                  ? `Délai d'attente dépassé lors de la vérification des horaires du Dr ${medecinName}.`
                  : `Impossible de vérifier les horaires du Dr ${medecinName} pour le ${this.formatDate(this.newAppointment.date)}. Veuillez réessayer.`;
              this.availableHours = [];
              this.availabilityMessage = '';
              this.isCheckingSchedule = false;
              this.cdr.detectChanges();
              reject(error);
            });
        },
        error: (error) => {
          this.noServiceMessage = 'Erreur lors de la récupération des informations des médecins.';
          this.availableHours = [];
          this.availabilityMessage = '';
          this.isCheckingSchedule = false;
          this.cdr.detectChanges();
          reject(error);
        },
      });
    });
  }

  private processAvailableSlots(workingSchedules: Schedule[], existingAppointments: Appointment[], medecinName: string) {
    const occupiedHours = existingAppointments
      .filter(appointment => appointment.statut === 'confirme' || appointment.statut === 'en_attente')
      .map(appointment => {
        const appointmentDate = new Date(appointment.date_heure);
        return appointmentDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      });

    console.log('Créneaux occupés pour cette date:', occupiedHours);

    const allSlots = this.generateHourSlots();
    const slotsInWorkingTime = allSlots.filter(hour => this.isTimeInWorkingSchedule(hour, workingSchedules));

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
        return slotTimeInMinutes > currentTimeInMinutes + 30;
      });
    }

    this.availableHours = finalAvailableSlots;

    const occupiedSlotsInWorkingTime = slotsInWorkingTime.filter(hour => occupiedHours.includes(hour));

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
        this.availabilityMessage = `⚠️ Créneaux déjà pris : ${occupiedTimesText} | ✅ ${finalAvailableSlots.length} créneaux disponibles`;
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
            (slotMinutes + 30 > breakStartMinutes && slotMinutes + 30 <= breakEndMinutes) ||
            (slotMinutes < breakStartMinutes && slotMinutes + 30 > breakEndMinutes)
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
    this.noServiceMessage = '';

    console.log('Date changée vers:', this.newAppointment.date);

    this.debounceGetAvailableHours();
  }

  async onSubmit() {
    if (!this.isReady) {
      this.errorMessage = 'Formulaire non prêt. Veuillez patienter.';
      return;
    }
    if (!this.validateForm()) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.getAvailableHours();
      if (!this.availableHours.includes(this.newAppointment.heure)) {
        this.errorMessage = 'Le créneau sélectionné n\'est plus disponible. Veuillez sélectionner un nouveau créneau.';
        this.isLoading = false;
        return;
      }
      const appointmentDateTime = new Date(`${this.newAppointment.date}T${this.newAppointment.heure}`);
      if (isNaN(appointmentDateTime.getTime())) {
        throw new Error('Format de date et heure invalide');
      }
      if (this.selectedMedecinTarif === null || this.selectedMedecinTarif === undefined) {
        this.errorMessage = 'Tarif du médecin non disponible';
        this.isLoading = false;
        return;
      }
      const appointmentData: CreateAppointmentRequest = {
        patient_id: this.newAppointment.patient_id,
        medecin_id: this.newAppointment.medecin_id,
        date_heure: appointmentDateTime.toISOString(),
        motif: this.newAppointment.motif.trim(),
        tarif: this.selectedMedecinTarif,
      };
      this.apiService.createAppointment(appointmentData).subscribe({
        next: (response: any) => {
          this.handleSuccessfulCreation(response);
        },
        error: (error: any) => {
          this.handleCreationError(error);
        },
      });
    } catch (error) {
      this.errorMessage = 'Erreur lors de la préparation des données';
      this.isLoading = false;
    }
  }

  private handleSuccessfulCreation(response: any) {
    this.resetForm();
    this.loadAppointments();
    this.isLoading = false;
    this.errorMessage = '';
    this.showSnackBar('Rendez-vous créé avec succès ! 🎉', 'success');
  }

  private handleCreationError(error: any) {
    this.isLoading = false;
    if (error.shouldRefreshSchedule) {
      this.refreshAvailableHours();
    }
    if (error.status === 422 || error.status === 409 || (error.status === 400 && error.error?.error_code === 'MEDECIN_NON_DISPONIBLE')) {
      this.newAppointment.date = '';
      this.newAppointment.heure = '';
      this.newAppointment.motif = '';
      this.availableHours = [];
      this.availabilityMessage = '';
      this.noServiceMessage = '';
      this.cdr.detectChanges();
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
  }

  private showSnackBar(message: string, panelClass: string = 'info') {
    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: [`snackbar-${panelClass}`],
    });
  }

  onMedecinChange() {
    this.newAppointment.heure = '';
    this.availableHours = [];
    this.availabilityMessage = '';
    this.errorMessage = '';
    this.noServiceMessage = '';

    console.log('Médecin changé vers:', this.newAppointment.medecin_id);

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

  forceRefreshAvailableHours() {
    console.log('Force refresh des créneaux disponibles...');
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.errorMessage = '';

    if (this.newAppointment.medecin_id && this.newAppointment.date) {
      this.getAvailableHours()
        .then(() => {
          console.log('Créneaux disponibles après refresh:', this.availableHours);
        })
        .catch(error => {
          console.error('Erreur lors du refresh:', error);
        });
    }
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
          const appointmentDate = new Date(appointment.date_heure).toISOString().split('T')[0];
          const isCorrectMedecin = appointment.medecin_id === medecinId;
          const isCorrectDate = appointmentDate === date;
          const isNotCancelled = appointment.statut !== 'annule';

          console.log(
            `RDV ${appointment.id}: medecin=${appointment.medecin_id}/${medecinId}, date=${appointmentDate}/${date}, statut=${appointment.statut}, inclus=${isCorrectMedecin && isCorrectDate && isNotCancelled}`
          );

          return isCorrectMedecin && isCorrectDate && isNotCancelled;
        });

        console.log(`RDV existants pour médecin ${medecinId} le ${date}:`, filteredAppointments);
        return filteredAppointments;
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des RDV existants:', error);
        return throwError(() => new Error('Could not fetch existing appointments.'));
      })
    );
  }

  cancelAppointment(appointment: Appointment): void {
    if (!appointment.id) {
      this.showSnackBar('Erreur: ID du rendez-vous manquant', 'error');
      return;
    }
    if (appointment.statut === 'annule') {
      this.showSnackBar('Ce rendez-vous est déjà annulé', 'warn');
      return;
    }
    if (appointment.statut === 'termine') {
      this.showSnackBar('Impossible d\'annuler un rendez-vous terminé', 'warn');
      return;
    }
    const dialogData: CancelDialogData = {
      appointmentId: appointment.id,
      patientName: appointment.patient?.user
        ? `${appointment.patient.user.prenom || ''} ${appointment.patient.user.nom || ''}`.trim()
        : 'Patient non spécifié',
      doctorName: appointment.medecin?.user
        ? `Dr. ${appointment.medecin.user.prenom || ''} ${appointment.medecin.user.nom || ''}`.trim()
        : 'Médecin non spécifié',
      appointmentDate: this.formatDateTime(appointment.date_heure),
    };
    const dialogRef = this.dialog.open(CancelAppointmentDialogComponent, {
      width: '450px',
      maxWidth: '90vw',
      disableClose: true,
      data: dialogData,
    });
    dialogRef.afterClosed().subscribe((result: CancelDialogResult | undefined) => {
      if (result && result.confirmed) {
        this.performCancellation(appointment.id!, result.reason || 'Annulé par l\'utilisateur');
      }
    });
  }

  private performCancellation(appointmentId: number, reason: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.apiService.cancelAppointment(appointmentId, reason).subscribe({
      next: (response) => {
        this.showSnackBar('Rendez-vous annulé avec succès ! Le créneau est maintenant disponible.', 'success');
        this.loadAppointments();
        if (this.newAppointment.medecin_id && this.newAppointment.date) {
          this.refreshAvailableHours();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.handleCancellationError(error);
        this.isLoading = false;
      },
    });
  }

  private handleCancellationError(error: any): void {
    let errorMessage = 'Impossible d\'annuler le rendez-vous. Veuillez réessayer.';
    if (error.status) {
      switch (error.status) {
        case 404:
          errorMessage = 'Rendez-vous non trouvé. Il a peut-être déjà été supprimé.';
          this.loadAppointments();
          break;
        case 400:
          errorMessage = error.error?.message || 'Demande invalide. Le rendez-vous ne peut pas être annulé.';
          break;
        case 403:
          errorMessage = 'Vous n\'avez pas l\'autorisation d\'annuler ce rendez-vous.';
          break;
        case 409:
          errorMessage = 'Ce rendez-vous a déjà été annulé ou modifié.';
          this.loadAppointments();
          break;
        case 422:
          errorMessage = error.error?.errors ? Object.values(error.error.errors).flat().join(', ') : error.error?.message || '';
          break;
        case 500:
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          break;
        default:
          errorMessage = error.error?.message || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    if (error.error?.error_code) {
      switch (error.error.error_code) {
        case 'APPOINTMENT_NOT_FOUND':
          errorMessage = 'Le rendez-vous n\'existe plus dans le système.';
          this.loadAppointments();
          break;
        case 'APPOINTMENT_ALREADY_CANCELLED':
          errorMessage = 'Ce rendez-vous est déjà annulé.';
          this.loadAppointments();
          break;
        case 'APPOINTMENT_CANNOT_BE_CANCELLED':
          errorMessage = 'Ce rendez-vous ne peut plus être annulé (trop tard ou déjà terminé).';
          break;
      }
    }
    this.errorMessage = errorMessage;
    this.showSnackBar(errorMessage, 'error');
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

  clearFilterDate() {
    this.selectedFilterDate = null;
    this.filterAppointments();
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