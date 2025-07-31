import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_LOCALE, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService, Appointment, Patient, Medecin, PaginatedResponse } from '../../services/api.service';
import { ScheduleService, DaySchedule } from '../../services/schedule.service';
import { forkJoin, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Custom date formats for Angular Material
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

// Interface for data passed to the dialog
export interface AppointmentDialogData {
  appointment?: Appointment; // Existing appointment for modification
  patients: Patient[]; // List of available patients
  doctors: Medecin[]; // List of available doctors
}

// Interface for dialog result
export interface AppointmentDialogResult {
  confirmed: boolean;
  appointmentData?: Partial<Appointment>;
}

@Component({
  selector: 'app-appointment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './appointment-dialog.component.html',
  styleUrls: ['./appointment-dialog.component.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: DateAdapter, useClass: NativeDateAdapter },
  ],
})
export class AppointmentDialogComponent implements OnInit {
  // Appointment form properties
  selectedPatientId: number | null = null;
  selectedDoctorId: number | null = null;
  newDate: Date | null = null;
  newTime: string = '';
  motif: string = '';
  tarif: number | null = null;
  isLoading = false; // Added for loading state

  patients: Patient[] = [];
  doctors: Medecin[] = [];
  isEditMode: boolean = false;
  originalAppointmentId: number | undefined;

  minDate: Date; // Minimum date for the datepicker

  availableHours: string[] = [];
  noServiceMessage: string = '';
  isCheckingSchedule: boolean = false;
  availabilityMessage: string = '';

  private debounceTimer: any;

  constructor(
    public dialogRef: MatDialogRef<AppointmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AppointmentDialogData,
    private dateAdapter: DateAdapter<Date>,
    private apiService: ApiService,
    private scheduleService: ScheduleService
  ) {
    this.dateAdapter.setLocale('fr-FR');
    this.minDate = new Date();
    this.minDate.setHours(0, 0, 0, 0);

    // Filter patients and doctors
    this.patients = data.patients.filter((p) => p.user?.role === 'patient');
    this.doctors = data.doctors.filter((d) => d.user?.role === 'medecin');

    // Initialize for edit mode
    if (data.appointment) {
      this.isEditMode = true;
      this.originalAppointmentId = data.appointment.id;
      this.selectedPatientId = data.appointment.patient_id;
      this.selectedDoctorId = data.appointment.medecin_id;

      const appointmentDateTime = new Date(data.appointment.date_heure);
      this.newDate = appointmentDateTime;
      this.newTime = appointmentDateTime.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      this.motif = data.appointment.motif;
      this.tarif = data.appointment.tarif || null;
    }
  }

  ngOnInit(): void {
    // Initialize tariff and slots for edit mode
    if (this.selectedDoctorId && this.newDate) {
      this.updateTarifForSelectedDoctor();
      this.getAvailableHours();
    } else if (this.selectedDoctorId) {
      this.updateTarifForSelectedDoctor();
    }
  }

  /**
   * Validates the entire appointment form.
   */
  isFormValid(): boolean {
    return !!(
      this.selectedPatientId &&
      this.selectedDoctorId &&
      this.newDate &&
      this.newTime &&
      this.motif?.trim() &&
      this.availableHours.includes(this.newTime)
    );
  }

  /**
   * Updates the consultation tariff when the selected doctor changes.
   */
  onDoctorSelectionChange(): void {
    this.updateTarifForSelectedDoctor();
    this.newTime = '';
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.debounceGetAvailableHours();
  }

  /**
   * Handles date change.
   * @param event The date change event.
   */
  onDateChange(event: any): void {
    this.newDate = event.value;
    this.newTime = '';
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.debounceGetAvailableHours();
  }

  /**
   * Updates the tariff based on the selected doctor.
   */
  private updateTarifForSelectedDoctor(): void {
    const selectedDoctor = this.doctors.find((doc) => doc.id === this.selectedDoctorId);
    this.tarif = selectedDoctor?.tarif_consultation ?? null;
  }

  /**
   * Filters dates to allow only today and future dates.
   */
  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= this.minDate.getTime();
  };

  /**
   * Debounces the fetching of time slots.
   */
  private debounceGetAvailableHours(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.getAvailableHours();
    }, 300);
  }

  /**
   * Fetches available time slots for the selected doctor and date.
   */
  getAvailableHours(): void {
    if (!this.selectedDoctorId || !this.newDate) {
      this.availableHours = [];
      this.noServiceMessage = '';
      this.availabilityMessage = '';
      this.isCheckingSchedule = false;
      return;
    }

    this.isCheckingSchedule = true;
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';

    const selectedDoctor = this.doctors.find((doc) => doc.id === this.selectedDoctorId);
    if (!selectedDoctor || !selectedDoctor.user?.id) {
      this.noServiceMessage = 'Erreur : Informations du médecin non disponibles.';
      this.isCheckingSchedule = false;
      return;
    }

    const doctorUserId = selectedDoctor.user.id;
    const formattedDate = this.newDate.toISOString().split('T')[0];
    const doctorName = `Dr. ${selectedDoctor.user.prenom} ${selectedDoctor.user.nom}`;

    forkJoin({
      schedules: this.scheduleService.getScheduleByMedecinAndDate(doctorUserId, formattedDate).pipe(
        catchError((err) => {
          console.error('Error fetching schedules:', err);
          return throwError(() => new Error('Impossible de récupérer les horaires.'));
        })
      ),
      existingAppointments: this.apiService.getAppointments().pipe(
        map((response: PaginatedResponse<Appointment>) => {
          return response.data.filter(
            (app) =>
              app.medecin_id === this.selectedDoctorId &&
              new Date(app.date_heure).toISOString().split('T')[0] === formattedDate &&
              (app.statut === 'confirme' || app.statut === 'en_attente')
          );
        }),
        catchError((err) => {
          console.error('Error fetching existing appointments:', err);
          return throwError(() => new Error('Impossible de récupérer les rendez-vous existants.'));
        })
      ),
    }).subscribe({
      next: ({ schedules, existingAppointments }) => {
        console.log('Schedules fetched:', schedules);
        console.log('Filtered existing appointments:', existingAppointments);

        const workingSchedules = schedules.filter((schedule) => schedule.is_available);

        if (workingSchedules.length === 0) {
          this.noServiceMessage = `${doctorName} n’a pas d’horaires disponibles le ${this.formatDateForDisplay(this.newDate)}.`;
          this.availableHours = [];
        } else {
          this.processAvailableSlots(workingSchedules, existingAppointments, doctorName);
        }
        this.isCheckingSchedule = false;
      },
      error: (error) => {
        console.error('Error loading time slots:', error);
        this.noServiceMessage = `Impossible de charger les créneaux pour ${doctorName}. ${error.message || ''}`;
        this.availableHours = [];
        this.isCheckingSchedule = false;
      },
    });
  }

  /**
   * Processes working hours and existing appointments to determine available slots.
   * @param workingSchedules Doctor's working hours.
   * @param existingAppointments Already booked appointments.
   * @param doctorName Doctor's name for messages.
   */
  private processAvailableSlots(workingSchedules: DaySchedule[], existingAppointments: Appointment[], doctorName: string): void {
    const occupiedHours = existingAppointments.map((appointment) => {
      const appointmentDate = new Date(appointment.date_heure);
      return appointmentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    const allPossibleSlots = this.generateAllHourSlots();
    let finalAvailableSlots: string[] = [];

    allPossibleSlots.forEach((slot) => {
      if (this.isTimeInWorkingSchedule(slot, workingSchedules) && !occupiedHours.includes(slot)) {
        finalAvailableSlots.push(slot);
      }
    });

    const today = new Date();
    const selectedDate = this.newDate;
    const isToday = selectedDate?.toDateString() === today.toDateString();

    if (isToday) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      finalAvailableSlots = finalAvailableSlots.filter((hour) => {
        const [hourNum, minuteNum] = hour.split(':').map(Number);
        const slotTimeInMinutes = hourNum * 60 + minuteNum;
        return slotTimeInMinutes > currentTimeInMinutes + 29;
      });
    }

    // Exclude the current appointment slot in edit mode
    if (this.isEditMode && this.originalAppointmentId && this.newDate) {
      const originalDate = new Date(this.data.appointment!.date_heure);
      const originalDateStr = originalDate.toISOString().split('T')[0];
      const selectedDateStr = this.newDate.toISOString().split('T')[0];

      if (originalDateStr === selectedDateStr) {
        const currentTimeSlot = originalDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        finalAvailableSlots = finalAvailableSlots.filter((slot) => slot !== currentTimeSlot);
      }
    }

    this.availableHours = finalAvailableSlots.sort();

    if (this.availableHours.length === 0) {
      this.availabilityMessage = `Aucun créneau disponible pour ${doctorName} le ${this.formatDateForDisplay(this.newDate)}.`;
    } else {
      this.availabilityMessage = `${this.availableHours.length} créneau(x) disponible(s).`;
    }
  }

  /**
   * Checks if a time slot is within the doctor's working hours, considering breaks.
   * @param timeSlot The time slot to check (e.g., "09:30").
   * @param workingSchedules Doctor's working hours.
   * @returns True if the slot is available, false otherwise.
   */
  private isTimeInWorkingSchedule(timeSlot: string, workingSchedules: DaySchedule[]): boolean {
    const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
    const slotStartInMinutes = slotHour * 60 + slotMinute;
    const slotEndInMinutes = slotStartInMinutes + 30;

    return workingSchedules.some((schedule) => {
      if (!schedule.start_time || !schedule.end_time) {
        return false;
      }

      const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
      const [endHour, endMinute] = schedule.end_time.split(':').map(Number);

      const scheduleStartInMinutes = startHour * 60 + startMinute;
      const scheduleEndInMinutes = endHour * 60 + endMinute;

      if (slotStartInMinutes >= scheduleStartInMinutes && slotEndInMinutes <= scheduleEndInMinutes) {
        if (schedule.break_start && schedule.end_break) {
          const [breakStartHour, breakStartMinute] = schedule.break_start.split(':').map(Number);
          const [breakEndHour, breakEndMinute] = schedule.end_break.split(':').map(Number);

          const breakStartInMinutes = breakStartHour * 60 + breakStartMinute;
          const breakEndInMinutes = breakEndHour * 60 + breakEndMinute;

          if (slotStartInMinutes < breakEndInMinutes && slotEndInMinutes > breakStartInMinutes) {
            return false;
          }
        }
        return true;
      }
      return false;
    });
  }

  /**
   * Generates all possible 30-minute time slots for a day.
   */
  private generateAllHourSlots(): string[] {
    const slots: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        slots.push(`${hour}:${minute}`);
      }
    }
    return slots;
  }

  /**
   * Formats a date for display (e.g., "21 juillet 2025").
   */
  private formatDateForDisplay(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * Handles form confirmation.
   */
  onConfirm(): void {
    if (!this.isFormValid()) {
      this.showError('Veuillez remplir tous les champs requis (Patient, Médecin, Date, Heure, Motif).');
      return;
    }

    this.isLoading = true;

    const finalDateTime = new Date(this.newDate!);
    const [hours, minutes] = this.newTime.split(':').map(Number);
    finalDateTime.setHours(hours, minutes, 0, 0);

    if (!this.isEditMode && finalDateTime <= new Date()) {
      this.showError('La date et l’heure du rendez-vous doivent être dans le futur.');
      this.isLoading = false;
      return;
    }

    const appointmentData: Partial<Appointment> = {
      patient_id: this.selectedPatientId!,
      medecin_id: this.selectedDoctorId!,
      date_heure: finalDateTime.toISOString(),
      motif: this.motif.trim(),
      tarif: this.tarif ?? undefined,
    };

    if (this.isEditMode) {
      appointmentData.id = this.originalAppointmentId;
    }

    // Simulate API call (replace with actual ApiService call)
    setTimeout(() => {
      this.dialogRef.close({ confirmed: true, appointmentData });
      this.isLoading = false;
    }, 1000); // Simulate network delay
  }

  /**
   * Displays an error message to the user.
   * @param message The error message to display.
   */
  private showError(message: string): void {
    // Replace with MatSnackBar or your preferred notification system
    alert(message);
    console.error('showError:', message);
  }

  /**
   * Handles dialog cancellation.
   */
  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }
}