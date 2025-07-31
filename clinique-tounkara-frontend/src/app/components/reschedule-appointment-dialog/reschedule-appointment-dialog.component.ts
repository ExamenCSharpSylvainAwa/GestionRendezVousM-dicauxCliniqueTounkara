import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_LOCALE, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ApiService, Appointment } from '../../services/api.service';
import { ScheduleService, DaySchedule } from '../../services/schedule.service';
import { forkJoin, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

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

export interface RescheduleDialogData {
  appointmentId: number;
  patientName: string;
  doctorName: string;
  currentDate: string;
  doctorMedecinId: number;
  doctorUserId: number;
}

export interface RescheduleDialogResult {
  confirmed: boolean;
  newDateHeure: string;
  reason: string;
}

@Component({
  selector: 'app-reschedule-appointment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './reschedule-appointment-dialog.component.html',
  styleUrls: ['./reschedule-appointment-dialog.component.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: DateAdapter, useClass: NativeDateAdapter },
  ],
})
export class RescheduleAppointmentDialogComponent implements OnInit {
  newDate: Date | null = null;
  newTime: string = '';
  rescheduleReason: string = '';
  minDate: Date;
  isLoading = false; // Added for loading state

  availableHours: string[] = [];
  noServiceMessage: string = '';
  availabilityMessage: string = '';
  isCheckingSchedule: boolean = false;
  originalAppointmentDate: Date | null = null;

  constructor(
    public dialogRef: MatDialogRef<RescheduleAppointmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RescheduleDialogData,
    private apiService: ApiService,
    private scheduleService: ScheduleService,
    private dateAdapter: DateAdapter<Date>
  ) {
    // Set minimum date to today at midnight
    this.minDate = new Date();
    this.minDate.setHours(0, 0, 0, 0);

    this.dateAdapter.setLocale('fr-FR');

    console.log('CONSTRUCTOR - data received:', this.data);
    console.log('CONSTRUCTOR - minDate set to:', this.minDate);
  }

  ngOnInit(): void {
    console.log('ngOnInit: Initializing reschedule dialog');

    // Validate required data
    if (!this.validateInputData()) {
      console.error('ngOnInit: Invalid input data');
      this.availabilityMessage = 'Erreur: Données du médecin manquantes';
      return;
    }

    // Parse and save the original appointment date
    this.originalAppointmentDate = this.parseOriginalDate();

    // Initialize new date with the current appointment date if valid
    if (this.originalAppointmentDate && !isNaN(this.originalAppointmentDate.getTime())) {
      this.newDate = this.originalAppointmentDate;
      console.log('ngOnInit: newDate initialized to current appointment date:', this.newDate);
      this.onDateChange({ value: this.newDate }); // Trigger slot loading
    } else {
      this.newDate = null;
      this.noServiceMessage = 'Veuillez sélectionner une nouvelle date pour voir les créneaux disponibles.';
      console.log('ngOnInit: No default date - user must choose.');
    }
  }

  /**
   * Validates that all required data is present
   */
  private validateInputData(): boolean {
    return !!(
      this.data.appointmentId &&
      this.data.doctorMedecinId &&
      this.data.doctorUserId &&
      this.data.doctorName
    );
  }

  /**
   * Parses the original appointment date for reference
   */
  private parseOriginalDate(): Date | null {
    if (!this.data.currentDate) {
      console.warn('parseOriginalDate: No current date provided');
      return null;
    }

    const dateStr = this.data.currentDate.toString().trim();
    console.log('parseOriginalDate: Attempting to parse:', dateStr);

    try {
      let parsedDate: Date | null = null;

      // Try parsing French format "lundi 21 juillet 2025 à 15:30"
      if (dateStr.includes(' à ')) {
        parsedDate = this.parseFrenchDateTimeFormat(dateStr);
      }

      // If not that format, try ISO or standard parsing
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = this.parseManualFormats(dateStr); // Try DD/MM/YYYY etc.
        }
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        console.log('parseOriginalDate: Successfully parsed date:', parsedDate);
        return parsedDate;
      }
    } catch (error) {
      console.error('parseOriginalDate: Error parsing:', error);
    }

    console.warn('parseOriginalDate: Unable to parse date:', dateStr);
    return null;
  }

  /**
   * Parses French format "lundi 21 juillet 2025 à 15:30"
   */
  private parseFrenchDateTimeFormat(dateStr: string): Date | null {
    try {
      const frenchMonths: { [key: string]: number } = {
        janvier: 0,
        février: 1,
        mars: 2,
        avril: 3,
        mai: 4,
        juin: 5,
        juillet: 6,
        août: 7,
        septembre: 8,
        octobre: 9,
        novembre: 10,
        décembre: 11,
      };

      const regex = /(\d{1,2})\s+(\w+)\s+(\d{4})\s+à\s+(\d{1,2}):(\d{2})/i;
      const match = dateStr.match(regex);

      if (match) {
        const day = parseInt(match[1]);
        const monthName = match[2].toLowerCase();
        const year = parseInt(match[3]);
        const hours = parseInt(match[4]);
        const minutes = parseInt(match[5]);

        const month = frenchMonths[monthName];

        if (month !== undefined) {
          const date = new Date(year, month, day, hours, minutes);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    } catch (error) {
      console.error('parseFrenchDateTimeFormat: Error:', error);
    }
    return null;
  }

  /**
   * Parses other formats manually (DD/MM/YYYY, DD-MM-YYYY)
   */
  private parseManualFormats(dateStr: string): Date | null {
    try {
      // Format DD/MM/YYYY or DD/MM/YYYY HH:mm
      if (dateStr.includes('/')) {
        const parts = dateStr.split(/[/\s:]/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // 0-indexed
          const year = parseInt(parts[2]);
          const hours = parts.length > 3 ? parseInt(parts[3]) : 0;
          const minutes = parts.length > 4 ? parseInt(parts[4]) : 0;

          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day, hours, minutes);
          }
        }
      }

      // Format DD-MM-YYYY
      if (dateStr.includes('-') && dateStr.split('-')[0].length <= 2) {
        const parts = dateStr.split(/[-\s:]/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parseInt(parts[2]);
          const hours = parts.length > 3 ? parseInt(parts[3]) : 0;
          const minutes = parts.length > 4 ? parseInt(parts[4]) : 0;

          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day, hours, minutes);
          }
        }
      }
    } catch (error) {
      console.error('parseManualFormats: Error:', error);
    }
    return null;
  }

  /**
   * Handles the cancel action
   */
  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  /**
   * Handles the confirm action
   */
  async onConfirm(): Promise<void> {
    // Validate required fields
    if (!this.newDate || !this.newTime || !this.rescheduleReason.trim()) {
      this.showError('Veuillez sélectionner une nouvelle date, une heure et fournir un motif de report.');
      return;
    }

    // Create new date/time
    const newDateTime = this.createNewDateTime();
    if (!newDateTime) {
      this.showError('Erreur lors de la création de la nouvelle date/heure.');
      return;
    }

    // Check if new date is different from original
    if (this.originalAppointmentDate && this.isSameDateTime(newDateTime, this.originalAppointmentDate)) {
      this.showError('Veuillez choisir une date et heure différentes de celles actuelles.');
      return;
    }

    // Check if date is in the future
    if (newDateTime <= new Date()) {
      this.showError('La nouvelle date et heure doivent être dans le futur.');
      return;
    }

    this.isLoading = true;

    // Final availability check
    if (!(await this.finalAvailabilityCheck())) {
      this.isLoading = false;
      return;
    }

    // Confirm rescheduling
    this.dialogRef.close({
      confirmed: true,
      newDateHeure: newDateTime.toISOString(),
      reason: this.rescheduleReason.trim(),
    } as RescheduleDialogResult);
    this.isLoading = false;
  }

  /**
   * Creates a new Date object with selected date and time
   */
  private createNewDateTime(): Date | null {
    try {
      const newDateTime = new Date(this.newDate!);
      const [hours, minutes] = this.newTime.split(':').map(Number);

      if (isNaN(hours) || isNaN(minutes)) {
        console.error('createNewDateTime: Invalid time:', this.newTime);
        return null;
      }

      newDateTime.setHours(hours, minutes, 0, 0);
      return newDateTime;
    } catch (error) {
      console.error('createNewDateTime: Error:', error);
      return null;
    }
  }

  /**
   * Compares two dates/times to check if they are identical
   */
  private isSameDateTime(date1: Date, date2: Date): boolean {
    return Math.abs(date1.getTime() - date2.getTime()) < 60000; // 1-minute tolerance
  }

  /**
   * Final availability check before confirmation
   */
  private async finalAvailabilityCheck(): Promise<boolean> {
    this.isCheckingSchedule = true;

    try {
      const dateString = this.formatDateToYYYYMMDD(this.newDate!);
      console.log('finalAvailabilityCheck: Checking for', dateString);

      // Call with flag to preserve selected time
      await this.getAvailableHours(dateString, true);

      // Check if a time is selected
      if (!this.newTime) {
        this.showError('Veuillez sélectionner une heure pour le nouveau rendez-vous.');
        return false;
      }

      if (!this.availableHours.includes(this.newTime)) {
        this.showError('Le créneau sélectionné n’est plus disponible. Veuillez choisir un autre créneau.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('finalAvailabilityCheck: Error:', error);
      this.showError('Erreur lors de la vérification de disponibilité. Veuillez réessayer.');
      return false;
    } finally {
      this.isCheckingSchedule = false;
    }
  }

  /**
   * Displays an error message to the user
   */
  private showError(message: string): void {
    // Replace with your preferred notification system (e.g., MatSnackBar)
    alert(message);
    console.error('showError:', message);
  }

  /**
   * Handles date change in the datepicker
   */
  onDateChange(event: any): void {
    console.log('--- onDateChange START ---');
    console.log('onDateChange: Received event:', event);

    let selectedDate: Date | null = null;

    // Try extracting date from event (preferred method)
    if (event?.value instanceof Date && !isNaN(event.value.getTime())) {
      selectedDate = event.value;
      console.log('onDateChange: Valid date directly from event.value:', selectedDate);
    }
    // If event doesn’t contain a valid date, try parsing input value
    else if (event?.target?.value) {
      console.warn('onDateChange: event.value is invalid. Attempting to parse event.target.value:', event.target.value);
      selectedDate = this.parseDateFromInput(event.target.value);
      if (selectedDate && !isNaN(selectedDate.getTime())) {
        console.log('onDateChange: Successfully parsed date from event.target.value:', selectedDate);
      } else {
        console.error('onDateChange: Failed to parse event.target.value:', event.target.value);
      }
    }
    // Case where event is directly a Date object (e.g., from ngOnInit)
    else if (event instanceof Date && !isNaN(event.getTime())) {
      selectedDate = event;
      console.log('onDateChange: Valid date directly from event (Date object):', selectedDate);
    } else {
      console.error('onDateChange: No valid date could be extracted from event.');
    }

    console.log('onDateChange: Extracted date after all parsing attempts:', selectedDate);

    // Validation and assignment
    if (selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
      // Ensure date is today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today && selectedDate.toDateString() !== today.toDateString()) {
        console.error('onDateChange: Past date rejected:', selectedDate);
        this.showError('Veuillez sélectionner une date dans le futur ou la date d’aujourd’hui.');
        this.newDate = null;
        this.resetTimeAndAvailability();
        return;
      }

      this.newDate = selectedDate;
      this.resetTimeAndAvailability();
      this.loadAvailableSlotsForDate();
    } else {
      console.error('onDateChange: Invalid or null final date. No changes applied.');
      this.newDate = null;
      this.showError('Date invalide. Veuillez sélectionner une date valide.');
      this.resetTimeAndAvailability();
    }
    console.log('--- onDateChange END ---');
  }

  /**
   * Parses a date from a text input (DD/MM/YYYY)
   */
  private parseDateFromInput(inputValue: string): Date | null {
    if (!inputValue || !inputValue.includes('/')) {
      return null;
    }

    try {
      const parts = inputValue.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 0-indexed
        const year = parseInt(parts[2]);

        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    } catch (error) {
      console.error('parseDateFromInput: Parsing error:', error);
    }

    return null;
  }

  /**
   * Resets time and availability fields
   */
  private resetTimeAndAvailability(): void {
    this.newTime = '';
    this.availableHours = [];
    this.availabilityMessage = '';
    this.noServiceMessage = '';
    console.log('resetTimeAndAvailability: Time and availability fields reset.');
  }

  /**
   * Filters dates in the datepicker
   */
  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;

    // Allow today and future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  };

  /**
   * Loads available slots for the selected date
   */
  private loadAvailableSlotsForDate(): void {
    if (this.newDate && !isNaN(this.newDate.getTime())) {
      const dateString = this.formatDateToYYYYMMDD(this.newDate);
      console.log('loadAvailableSlotsForDate: Loading for', dateString);
      this.getAvailableHours(dateString);
    } else {
      console.warn('loadAvailableSlotsForDate: Invalid newDate, cannot load slots.');
    }
  }

  /**
   * Retrieves available time slots
   */
  private getAvailableHours(date: string, preserveSelectedTime: boolean = false): Promise<void> {
    console.log('getAvailableHours: Starting for date:', date);

    // Validate parameters
    if (!this.data.doctorMedecinId || !this.data.doctorUserId || !date || date === 'NaN-NaN-NaN') {
      this.setNoSlotsAvailable('Veuillez sélectionner une date valide.');
      console.warn('getAvailableHours: Invalid parameters, skipping API call.');
      return Promise.resolve();
    }

    this.isCheckingSchedule = true;

    // Save selected time if preserving
    const selectedTime = preserveSelectedTime ? this.newTime : '';

    // Reset only if not preserving selected time
    if (!preserveSelectedTime) {
      this.resetTimeAndAvailability();
    } else {
      // Reset only messages
      this.availabilityMessage = '';
      this.noServiceMessage = '';
    }

    const { doctorUserId, doctorMedecinId, doctorName } = this.data;

    return new Promise((resolve, reject) => {
      forkJoin({
        schedules: this.scheduleService.getScheduleByMedecinAndDate(doctorUserId, date),
        existingAppointments: this.apiService.getAppointmentsForDoctorAndDate(doctorMedecinId, date),
      })
        .pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('getAvailableHours: API error:', error);
            this.setNoSlotsAvailable(
              `Impossible de vérifier les horaires du ${doctorName} pour le ${this.formatDate(date)}. Veuillez réessayer.`
            );
            return throwError(() => error);
          })
        )
        .subscribe({
          next: ({ schedules, existingAppointments }) => {
            console.log('getAvailableHours: Data received:', { schedules, existingAppointments });
            this.processSchedulesAndAppointments(schedules, existingAppointments, doctorName, date);

            // Restore selected time if preserved
            if (preserveSelectedTime && selectedTime) {
              this.newTime = selectedTime;
              console.log('getAvailableHours: Restored time after processing:', this.newTime);
            }

            resolve();
          },
          error: (err) => {
            this.isCheckingSchedule = false;
            reject(err);
          },
        });
    });
  }

  /**
   * Processes schedules and appointments to calculate available slots
   */
  private processSchedulesAndAppointments(
    schedules: DaySchedule[],
    existingAppointments: Appointment[],
    doctorName: string,
    date: string
  ): void {
    this.isCheckingSchedule = false;
    console.log('processSchedulesAndAppointments: Starting processing.');

    // Check if schedules exist
    if (!schedules || schedules.length === 0) {
      this.setNoSlotsAvailable(`${doctorName} n’est pas en service le ${this.formatDate(date)}.`);
      console.log('processSchedulesAndAppointments: No schedules found.');
      return;
    }

    // Filter available schedules
    const workingSchedules = schedules.filter((schedule: DaySchedule) => schedule.is_available);
    console.log('processSchedulesAndAppointments: Filtered working schedules:', workingSchedules);

    if (workingSchedules.length === 0) {
      this.setNoSlotsAvailable(`${doctorName} n’a pas d’horaires de travail disponibles le ${this.formatDate(date)}.`);
      console.log('processSchedulesAndAppointments: No available working schedules after filtering.');
      return;
    }

    // Calculate available slots
    this.calculateAvailableSlots(workingSchedules, existingAppointments, doctorName, date);
    console.log('processSchedulesAndAppointments: availableHours (after calculation):', this.availableHours);
  }

  /**
   * Calculates available slots
   */
  private calculateAvailableSlots(
    workingSchedules: DaySchedule[],
    existingAppointments: Appointment[],
    doctorName: string,
    date: string
  ): void {
    console.log('calculateAvailableSlots: Starting slot calculation.');
    // Get occupied hours (confirmed or pending appointments)
    const occupiedHours = this.getOccupiedHours(existingAppointments);
    console.log('calculateAvailableSlots: Occupied hours:', occupiedHours);

    // Generate all possible slots
    const allSlots = this.generateHourSlots();
    console.log('calculateAvailableSlots: All generated slots:', allSlots.length);

    // Filter slots within working hours
    const slotsInWorkingTime = allSlots.filter((hour) =>
      this.isTimeInWorkingSchedule(hour, workingSchedules, date)
    );
    console.log('calculateAvailableSlots: Slots within working hours:', slotsInWorkingTime);

    // Exclude occupied slots
    const availableSlotsInWorkingTime = slotsInWorkingTime.filter(
      (hour) => !occupiedHours.includes(hour)
    );
    console.log('calculateAvailableSlots: Available slots after excluding occupied:', availableSlotsInWorkingTime);

    // Exclude current appointment slot
    const finalAvailableSlots = this.excludeCurrentAppointmentSlot(availableSlotsInWorkingTime, date);
    console.log('calculateAvailableSlots: Slots after excluding current slot:', finalAvailableSlots);

    // Filter past slots if today
    const futureSlots = this.filterPastSlots(finalAvailableSlots, date);
    console.log('calculateAvailableSlots: Future slots (if today):', futureSlots);

    // Update state
    this.updateAvailabilityState(futureSlots, slotsInWorkingTime.length > 0, doctorName, date);
    console.log('calculateAvailableSlots: Slot calculation complete.');
  }

  /**
   * Gets occupied hours from existing appointments
   */
  private getOccupiedHours(existingAppointments: Appointment[]): string[] {
    return existingAppointments
      .filter((appointment) => appointment.statut === 'confirme' || appointment.statut === 'en_attente')
      .map((appointment) => {
        const appointmentDate = new Date(appointment.date_heure);
        return appointmentDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      });
  }

  /**
   * Excludes the current appointment slot
   */
  private excludeCurrentAppointmentSlot(availableSlots: string[], selectedDate: string): string[] {
    if (!this.originalAppointmentDate) {
      return availableSlots;
    }

    const originalDateStr = this.formatDateToYYYYMMDD(this.originalAppointmentDate);

    // If not the same date, no need to exclude
    if (originalDateStr !== selectedDate) {
      return availableSlots;
    }

    // Exclude the current slot
    const currentTimeSlot = this.originalAppointmentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    console.log('excludeCurrentAppointmentSlot: Excluding current slot:', currentTimeSlot);

    return availableSlots.filter((slot) => slot !== currentTimeSlot);
  }

  /**
   * Filters past slots for today
   */
  private filterPastSlots(slots: string[], selectedDate: string): string[] {
    const today = new Date();
    const selectedDateObj = new Date(selectedDate);

    // If not today, return all slots
    if (selectedDateObj.toDateString() !== today.toDateString()) {
      console.log('filterPastSlots: Selected date is not today, no past slot filtering.');
      return slots;
    }

    // Filter past slots with a 30-minute margin
    const currentTimeInMinutes = today.getHours() * 60 + today.getMinutes();

    const filteredSlots = slots.filter((hour) => {
      const [hourNum, minuteNum] = hour.split(':').map(Number);
      const slotTimeInMinutes = hourNum * 60 + minuteNum;
      const isPast = slotTimeInMinutes <= currentTimeInMinutes + 30;
      if (isPast) {
        console.log(`filterPastSlots: Slot ${hour} is past (+30min), filtered out.`);
      }
      return !isPast;
    });
    console.log('filterPastSlots: Slots after filtering past:', filteredSlots);
    return filteredSlots;
  }

  /**
   * Updates availability state
   */
  private updateAvailabilityState(
    finalSlots: string[],
    hasWorkingHours: boolean,
    doctorName: string,
    date: string
  ): void {
    this.availableHours = finalSlots;
    console.log('updateAvailabilityState: availableHours updated to:', this.availableHours);

    if (!hasWorkingHours) {
      this.setNoSlotsAvailable(`${doctorName} n’a pas d’horaires de travail le ${this.formatDate(date)}.`);
      console.log('updateAvailabilityState: No working hours.');
    } else if (finalSlots.length === 0) {
      this.setNoSlotsAvailable(`${doctorName} n’a plus de créneaux disponibles le ${this.formatDate(date)}.`);
      console.log('updateAvailabilityState: No available slots.');
    } else {
      this.noServiceMessage = '';
      this.availabilityMessage = `✅ ${finalSlots.length} créneaux disponibles`;
      console.log('updateAvailabilityState: Slots available.');
    }
  }

  /**
   * Sets "no slots available" state
   */
  private setNoSlotsAvailable(message: string): void {
    this.availableHours = [];
    this.noServiceMessage = message;
    this.availabilityMessage = '';
    this.isCheckingSchedule = false;
    console.log('setNoSlotsAvailable: Message:', message);
  }

  /**
   * Checks if a time slot is within working schedules
   */
  private isTimeInWorkingSchedule(timeSlot: string, workingSchedules: DaySchedule[], selectedDateString: string): boolean {
    const selectedDateTime = new Date(`${selectedDateString}T${timeSlot}`);
    console.log(`isTimeInWorkingSchedule: Checking slot ${timeSlot} for ${selectedDateString}. selectedDateTime (locale): ${selectedDateTime.toLocaleString()}`);

    return workingSchedules.some((schedule) => {
      console.log('  isTimeInWorkingSchedule: Doctor schedule:', schedule);
      if (!schedule.start_time || !schedule.end_time) {
        console.log('  isTimeInWorkingSchedule: Missing start_time or end_time. Ignored.');
        return false;
      }

      const scheduleStart = new Date(`${selectedDateString}T${schedule.start_time}`);
      const scheduleEnd = new Date(`${selectedDateString}T${schedule.end_time}`);
      console.log(`  isTimeInWorkingSchedule: scheduleStart (locale): ${scheduleStart.toLocaleString()}, scheduleEnd (locale): ${scheduleEnd.toLocaleString()}`);

      // Check if slot is within working hours
      if (selectedDateTime >= scheduleStart && selectedDateTime < scheduleEnd) {
        console.log(`  isTimeInWorkingSchedule: Slot ${timeSlot} is within working hours.`);
        // Check for breaks
        if (schedule.break_start && schedule.end_break) {
          const breakStart = new Date(`${selectedDateString}T${schedule.break_start}`);
          const breakEnd = new Date(`${selectedDateString}T${schedule.end_break}`);
          console.log(`  isTimeInWorkingSchedule: Break: ${breakStart.toLocaleString()} to ${breakEnd.toLocaleString()}`);

          // If slot is during break, it’s not available
          if (selectedDateTime >= breakStart && selectedDateTime < breakEnd) {
            console.log(`  isTimeInWorkingSchedule: Slot ${timeSlot} is during break. Not available.`);
            return false;
          }
        }
        console.log(`  isTimeInWorkingSchedule: Slot ${timeSlot} is available.`);
        return true;
      }
      console.log(`  isTimeInWorkingSchedule: Slot ${timeSlot} is NOT within working hours.`);
      return false;
    });
  }

  /**
   * Generates all possible time slots in 30-minute increments
   */
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

  /**
   * Formats a date for input display (DD/MM/YYYY)
   */
  formatDateForInput(date: Date | null): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formats a date to a long French string
   */
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

  /**
   * Formats a date to YYYY-MM-DD for API calls
   */
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}