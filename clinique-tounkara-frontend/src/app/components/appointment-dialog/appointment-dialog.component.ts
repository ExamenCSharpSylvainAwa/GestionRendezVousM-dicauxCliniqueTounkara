// src/app/components/appointment-dialog/appointment-dialog.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_LOCALE, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // Import for the spinner
import { ApiService, Appointment, Patient, Medecin, User, PaginatedResponse } from '../../services/api.service'; // Ensure interfaces are imported
import { ScheduleService, DaySchedule } from '../../services/schedule.service'; // Corrected: Import DaySchedule instead of Schedule
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable, throwError } from 'rxjs'; // Import forkJoin, Observable, throwError
import { map, catchError } from 'rxjs/operators'; // Import map, catchError

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
    MatProgressSpinnerModule // Add spinner module
  ],
  templateUrl: './appointment-dialog.component.html',
  styleUrls: ['./appointment-dialog.component.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: DateAdapter, useClass: NativeDateAdapter }
  ]
})
export class AppointmentDialogComponent implements OnInit {
  // Appointment form properties
  selectedPatientId: number | null = null;
  selectedDoctorId: number | null = null;
  newDate: Date | null = null;
  newTime: string = '';
  motif: string = '';
  tarif: number | null = null; // Tarif will be updated dynamically
  
  patients: Patient[] = [];
  doctors: Medecin[] = [];
  isEditMode: boolean = false;
  originalAppointmentId: number | undefined;

  minDate: Date; // Minimum date for the datepicker

  availableHours: string[] = []; // Available time slots
  noServiceMessage: string = ''; // Message if doctor is not on duty
  isCheckingSchedule: boolean = false; // Loading indicator for schedules
  availabilityMessage: string = ''; // Availability message (e.g., "X slots available")

  private debounceTimer: any; // To prevent too frequent API calls

  constructor(
    public dialogRef: MatDialogRef<AppointmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AppointmentDialogData,
    private dateAdapter: DateAdapter<Date>,
    private apiService: ApiService, // Inject ApiService
    private scheduleService: ScheduleService // Inject ScheduleService
  ) {
    this.dateAdapter.setLocale('fr-FR');
    this.minDate = new Date(); // Minimum date is today
    this.minDate.setHours(0, 0, 0, 0); // Reset time for comparison

    // Filter patients and doctors to ensure they have the correct role
    // and that the user object is present to access first/last name
    this.patients = data.patients.filter(p => p.user?.role === 'patient');
    this.doctors = data.doctors.filter(d => d.user?.role === 'medecin');

    // If an appointment is passed, it's edit mode
    if (data.appointment) {
      this.isEditMode = true;
      this.originalAppointmentId = data.appointment.id;
      this.selectedPatientId = data.appointment.patient_id;
      this.selectedDoctorId = data.appointment.medecin_id;
      
      const appointmentDateTime = new Date(data.appointment.date_heure);
      this.newDate = appointmentDateTime;
      this.newTime = appointmentDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
      this.motif = data.appointment.motif;
      // In edit mode, the tariff is from the existing appointment, but it will be updated if the doctor changes
      this.tarif = data.appointment.tarif || null; 
    }
  }

  ngOnInit(): void {
    // If a doctor and date are already selected (in edit mode), update tariff and slots
    if (this.selectedDoctorId && this.newDate) {
      this.updateTarifForSelectedDoctor();
      this.getAvailableHours();
    } else if (this.selectedDoctorId) {
      this.updateTarifForSelectedDoctor();
    }
  }

  /**
   * Updates the consultation tariff when the selected doctor changes.
   * Also triggers fetching of time slots.
   */
  onDoctorSelectionChange(): void {
    this.updateTarifForSelectedDoctor();
    this.newTime = ''; // Reset selected time
    this.availableHours = []; // Clear previous slots
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.debounceGetAvailableHours(); // Trigger slot fetching
  }

  /**
   * Handles date change.
   * @param event The date change event.
   */
  onDateChange(event: any): void {
    this.newDate = event.value; // MatDatepicker returns a Date object
    this.newTime = ''; // Reset selected time
    this.availableHours = []; // Clear previous slots
    this.noServiceMessage = '';
    this.availabilityMessage = '';
    this.debounceGetAvailableHours(); // Trigger slot fetching
  }

  /**
   * Finds the selected doctor and updates the tariff.
   */
  private updateTarifForSelectedDoctor(): void {
    const selectedDoctor = this.doctors.find(doc => doc.id === this.selectedDoctorId);
    if (selectedDoctor && selectedDoctor.tarif_consultation !== undefined) {
      this.tarif = selectedDoctor.tarif_consultation;
    } else {
      this.tarif = null; // Reset if no doctor selected or tariff undefined
    }
  }

  /**
   * Validates that the selected date is not in the past.
   */
  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // For date comparison only
    return d.getTime() >= this.minDate.getTime();
  };

  /**
   * Triggers fetching of time slots with a delay.
   */
  private debounceGetAvailableHours(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.getAvailableHours();
    }, 300); // 300ms delay
  }

  /**
   * Fetches available time slots for the selected doctor and date.
   */
  getAvailableHours(): void {
    if (!this.selectedDoctorId || !this.newDate) {
      this.availableHours = [];
      this.noServiceMessage = '';
      this.availabilityMessage = '';
      return;
    }

    this.isCheckingSchedule = true;
    this.availableHours = [];
    this.noServiceMessage = '';
    this.availabilityMessage = '';

    const selectedDoctor = this.doctors.find(doc => doc.id === this.selectedDoctorId);
    if (!selectedDoctor || !selectedDoctor.user?.id) {
      this.noServiceMessage = 'Error: Doctor information not available.';
      this.isCheckingSchedule = false;
      return;
    }

    const doctorUserId = selectedDoctor.user.id;
    const formattedDate = this.newDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
    const doctorName = `Dr. ${selectedDoctor.user.prenom} ${selectedDoctor.user.nom}`;

    forkJoin({
      schedules: this.scheduleService.getScheduleByMedecinAndDate(doctorUserId, formattedDate).pipe(
        catchError(err => {
          console.error('Error fetching schedules:', err);
          return throwError(() => new Error('Could not fetch schedules.'));
        })
      ),
      existingAppointments: this.apiService.getAppointments().pipe(
        map((response: PaginatedResponse<Appointment>) => {
          // Filter existing appointments for this doctor and date
          return response.data.filter(app =>
            app.medecin_id === this.selectedDoctorId &&
            new Date(app.date_heure).toISOString().split('T')[0] === formattedDate &&
            (app.statut === 'confirme' || app.statut === 'en_attente')
          );
        }),
        catchError(err => {
          console.error('Error fetching existing appointments:', err);
          return throwError(() => new Error('Could not fetch existing appointments.'));
        })
      )
    }).subscribe({
      next: ({ schedules, existingAppointments }) => {
        console.log('Schedules fetched:', schedules);
        console.log('Filtered existing appointments:', existingAppointments);

        // schedules is now DaySchedule[], so filter based on is_available
        const workingSchedules = schedules.filter(schedule => schedule.is_available);

        if (workingSchedules.length === 0) {
          this.noServiceMessage = `${doctorName} has no available working hours on ${this.formatDateForDisplay(this.newDate)}.`;
          this.availableHours = [];
        } else {
          this.processAvailableSlots(workingSchedules, existingAppointments, doctorName);
        }
        this.isCheckingSchedule = false;
      },
      error: (error) => {
        console.error('Error loading time slots:', error);
        this.noServiceMessage = `Could not load slots for ${doctorName}. ${error.message || ''}`;
        this.availableHours = [];
        this.isCheckingSchedule = false;
      }
    });
  }

  /**
   * Processes working hours and existing appointments to determine available slots.
   * @param workingSchedules Doctor's working hours.
   * @param existingAppointments Already booked appointments.
   * @param doctorName Doctor's name for messages.
   */
  private processAvailableSlots(workingSchedules: DaySchedule[], existingAppointments: Appointment[], doctorName: string): void { // Corrected: workingSchedules type to DaySchedule[]
    const occupiedHours = existingAppointments.map(appointment => {
      const appointmentDate = new Date(appointment.date_heure);
      return appointmentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    const allPossibleSlots = this.generateAllHourSlots();
    let finalAvailableSlots: string[] = [];

    allPossibleSlots.forEach(slot => {
      if (this.isTimeInWorkingSchedule(slot, workingSchedules) && !occupiedHours.includes(slot)) {
        finalAvailableSlots.push(slot);
      }
    });

    const today = new Date();
    const selectedDate = this.newDate; // newDate is already a Date object
    const isToday = selectedDate?.toDateString() === today.toDateString();

    if (isToday) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      finalAvailableSlots = finalAvailableSlots.filter(hour => {
        const [hourNum, minuteNum] = hour.split(':').map(Number);
        const slotTimeInMinutes = hourNum * 60 + minuteNum;
        // Keep slots that are at least 30 minutes in the future
        return slotTimeInMinutes > currentTimeInMinutes + 29; 
      });
    }

    this.availableHours = finalAvailableSlots.sort(); // Sort slots

    if (this.availableHours.length === 0) {
      this.availabilityMessage = `No slots available for ${doctorName} on ${this.formatDateForDisplay(this.newDate)}.`;
    } else {
      this.availabilityMessage = `${this.availableHours.length} slot(s) available.`;
    }
  }

  /**
   * Checks if a time slot is within the doctor's working hours, considering breaks.
   * @param timeSlot The time slot to check (e.g., "09:30").
   * @param workingSchedules Doctor's working hours.
   * @returns True if the slot is available, false otherwise.
   */
  private isTimeInWorkingSchedule(timeSlot: string, workingSchedules: DaySchedule[]): boolean { // Corrected: workingSchedules type to DaySchedule[]
    const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
    const slotStartInMinutes = slotHour * 60 + slotMinute;
    const slotEndInMinutes = slotStartInMinutes + 30; // Each slot is 30 minutes long

    return workingSchedules.some(schedule => {
      // Ensure start_time and end_time are not null before splitting
      if (!schedule.start_time || !schedule.end_time) {
        return false;
      }

      const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
      const [endHour, endMinute] = schedule.end_time.split(':').map(Number);

      const scheduleStartInMinutes = startHour * 60 + startMinute;
      const scheduleEndInMinutes = endHour * 60 + endMinute;

      // Check if the slot is within the working hour range
      if (slotStartInMinutes >= scheduleStartInMinutes && slotEndInMinutes <= scheduleEndInMinutes) {
        // Check if the slot overlaps with a break
        if (schedule.break_start && schedule.end_break) {
          const [breakStartHour, breakStartMinute] = schedule.break_start.split(':').map(Number);
          const [breakEndHour, breakEndMinute] = schedule.end_break.split(':').map(Number);

          const breakStartInMinutes = breakStartHour * 60 + breakStartMinute;
          const breakEndInMinutes = breakEndHour * 60 + breakEndMinute;

          // If the slot starts during the break OR ends during the break OR encompasses the break
          if (
            (slotStartInMinutes < breakEndInMinutes && slotEndInMinutes > breakStartInMinutes)
          ) {
            return false; // The slot is during the break
          }
        }
        return true; // The slot is within working hours and not on break
      }
      return false; // The slot is not within working hours
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
   * Formats a date for display (e.g., "July 21, 2025").
   */
  private formatDateForDisplay(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * Handles form confirmation.
   */
  onConfirm(): void {
    // Field validation
    if (!this.selectedPatientId || !this.selectedDoctorId || !this.newDate || !this.newTime || !this.motif.trim()) {
      alert('Please fill in all required fields (Patient, Doctor, Date, Time, Reason).');
      return;
    }

    // Check if the selected slot is actually available
    if (!this.availableHours.includes(this.newTime)) {
      alert('The selected time slot is no longer available. Please choose another one.');
      return;
    }

    // Create full Date object
    const finalDateTime = new Date(this.newDate);
    const [hours, minutes] = this.newTime.split(':').map(Number);
    finalDateTime.setHours(hours, minutes, 0, 0);

    // Check if the date/time is in the future for new creations
    // Or if it's a modification, allow current date if still valid
    if (!this.isEditMode && finalDateTime <= new Date()) {
      alert('The appointment date and time must be in the future.');
      return;
    }

    const appointmentData: Partial<Appointment> = {
      patient_id: this.selectedPatientId,
      medecin_id: this.selectedDoctorId,
      date_heure: finalDateTime.toISOString(), // ISO format for API
      motif: this.motif.trim(),
      tarif: this.tarif !== null ? this.tarif : undefined, // Send fetched tariff
    };

    // If it's a modification, include the original ID
    if (this.isEditMode) {
      appointmentData.id = this.originalAppointmentId;
    }

    this.dialogRef.close({ confirmed: true, appointmentData: appointmentData });
  }

  /**
   * Handles dialog cancellation.
   */
  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }
}
