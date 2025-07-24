// src/app/components/reschedule-appointment-dialog/reschedule-appointment-dialog.component.ts
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
import { forkJoin, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

// Définition des formats de date personnalisés pour Angular Material
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
    MatSelectModule
  ],
  templateUrl: './reschedule-appointment-dialog.component.html',
  styleUrls: ['./reschedule-appointment-dialog.component.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: DateAdapter, useClass: NativeDateAdapter }
  ]
})
export class RescheduleAppointmentDialogComponent implements OnInit {
  newDate: Date | null = null;
  newTime: string = '';
  rescheduleReason: string = '';
  minDate: Date;

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
    // Définir la date minimum à aujourd'hui à minuit
    this.minDate = new Date();
    this.minDate.setHours(0, 0, 0, 0);

    this.dateAdapter.setLocale('fr-FR');
    
    console.log('CONSTRUCTOR - data reçue:', this.data);
    console.log('CONSTRUCTOR - minDate définie à:', this.minDate);
  }

  ngOnInit(): void {
    console.log('ngOnInit: Initialisation du dialogue de report');
    
    // Valider les données requises
    if (!this.validateInputData()) {
      console.error('ngOnInit: Données d\'entrée invalides');
      this.availabilityMessage = 'Erreur: Données du médecin manquantes';
      return;
    }

    // Parser et sauvegarder la date originale du rendez-vous
    this.originalAppointmentDate = this.parseOriginalDate();
    
    // Initialiser la nouvelle date avec la date actuelle du RDV si elle est valide
    if (this.originalAppointmentDate && !isNaN(this.originalAppointmentDate.getTime())) {
      this.newDate = this.originalAppointmentDate;
      console.log('ngOnInit: newDate initialisée à la date actuelle du RDV:', this.newDate);
      this.onDateChange({ value: this.newDate }); // Déclenche le chargement des créneaux
    } else {
      this.newDate = null; // Aucune date pré-sélectionnée si la date originale est invalide
      this.noServiceMessage = 'Veuillez sélectionner une nouvelle date pour voir les créneaux disponibles.';
      console.log('ngOnInit: Aucune date par défaut - utilisateur doit choisir.');
    }
  }

  /**
   * Valide que toutes les données nécessaires sont présentes
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
   * Parse la date originale du rendez-vous pour référence
   */
  private parseOriginalDate(): Date | null {
    if (!this.data.currentDate) {
      console.warn('parseOriginalDate: Pas de date courante fournie');
      return null;
    }

    const dateStr = this.data.currentDate.toString().trim();
    console.log('parseOriginalDate: Tentative de parsing de:', dateStr);

    try {
      let parsedDate: Date | null = null;

      // Tenter de parser le format "lundi 21 juillet 2025 à 15:30"
      if (dateStr.includes(' à ')) {
        parsedDate = this.parseFrenchDateTimeFormat(dateStr);
      }
      
      // Si ce n'est pas ce format, tenter le parsing ISO ou standard
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        parsedDate = new Date(dateStr); 
        if (isNaN(parsedDate.getTime())) {
          parsedDate = this.parseManualFormats(dateStr); // Tenter les formats DD/MM/YYYY etc.
        }
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        console.log('parseOriginalDate: Date parsée avec succès:', parsedDate);
        return parsedDate;
      }

    } catch (error) {
      console.error('parseOriginalDate: Erreur lors du parsing:', error);
    }

    console.warn('parseOriginalDate: Impossible de parser la date:', dateStr);
    return null;
  }

  /**
   * Parse le format français "lundi 21 juillet 2025 à 15:30"
   */
  private parseFrenchDateTimeFormat(dateStr: string): Date | null {
    try {
      const frenchMonths: { [key: string]: number } = {
        'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
        'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
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
      console.error('parseFrenchDateTimeFormat: Erreur:', error);
    }
    return null;
  }

  /**
   * Parse d'autres formats manuellement (DD/MM/YYYY, DD-MM-YYYY)
   */
  private parseManualFormats(dateStr: string): Date | null {
    try {
      // Format DD/MM/YYYY ou DD/MM/YYYY HH:mm
      if (dateStr.includes('/')) {
        const parts = dateStr.split(/[/\s:]/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // 0-indexé
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
      console.error('parseManualFormats: Erreur:', error);
    }
    return null;
  }

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  async onConfirm(): Promise<void> {
    // Validation des champs requis
    if (!this.newDate || !this.newTime || !this.rescheduleReason.trim()) {
      this.showError("Veuillez sélectionner une nouvelle date, une heure et fournir un motif de report.");
      return;
    }

    // Créer la nouvelle date/heure
    const newDateTime = this.createNewDateTime();
    if (!newDateTime) {
      this.showError("Erreur lors de la création de la nouvelle date/heure.");
      return;
    }

    // Vérifier que la nouvelle date est différente de l'originale
    if (this.originalAppointmentDate && this.isSameDateTime(newDateTime, this.originalAppointmentDate)) {
      this.showError("Veuillez choisir une date et heure différentes de celles actuelles.");
      return;
    }

    // Vérifier que c'est dans le futur
    if (newDateTime <= new Date()) {
      this.showError("La nouvelle date et heure doivent être dans le futur.");
      return;
    }

    // Vérification finale de disponibilité
    if (!(await this.finalAvailabilityCheck())) {
      return;
    }

    // Confirmer le report
    this.dialogRef.close({
      confirmed: true,
      newDateHeure: newDateTime.toISOString(),
      reason: this.rescheduleReason.trim()
    } as RescheduleDialogResult);
  }

  /**
   * Crée un nouvel objet Date avec la date et l'heure sélectionnées
   */
  private createNewDateTime(): Date | null {
    try {
      const newDateTime = new Date(this.newDate!);
      const [hours, minutes] = this.newTime.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) {
        console.error('createNewDateTime: Heure invalide:', this.newTime);
        return null;
      }
      
      newDateTime.setHours(hours, minutes, 0, 0);
      return newDateTime;
    } catch (error) {
      console.error('createNewDateTime: Erreur:', error);
      return null;
    }
  }

  /**
   * Compare deux dates/heures pour vérifier si elles sont identiques
   */
  private isSameDateTime(date1: Date, date2: Date): boolean {
    return Math.abs(date1.getTime() - date2.getTime()) < 60000; // Tolérance de 1 minute
  }

  /**
   * Vérification finale de disponibilité avant confirmation
   */
  private async finalAvailabilityCheck(): Promise<boolean> {
  this.isCheckingSchedule = true;
  
  try {
    const dateString = this.formatDateToYYYYMMDD(this.newDate!);
    console.log('finalAvailabilityCheck: Vérification pour', dateString);
    
    // Appeler avec le flag pour préserver l'heure sélectionnée
    await this.getAvailableHours(dateString, true);
    
    // Vérifier si l'utilisateur a sélectionné une heure
    if (!this.newTime) {
      this.showError("Veuillez sélectionner une heure pour le nouveau rendez-vous.");
      return false;
    }

    if (!this.availableHours.includes(this.newTime)) {
      this.showError("Le créneau sélectionné n'est plus disponible. Veuillez choisir un autre créneau.");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("finalAvailabilityCheck: Erreur:", error);
    this.showError("Erreur lors de la vérification de disponibilité. Veuillez réessayer.");
    return false;
  } finally {
    this.isCheckingSchedule = false;
  }
}

  /**
   * Affiche un message d'erreur à l'utilisateur
   */
  private showError(message: string): void {
    // Vous pouvez remplacer ceci par votre système de notification préféré
    alert(message);
    console.error('showError:', message);
  }

  /**
   * Gère le changement de date dans le datepicker
   */
  onDateChange(event: any): void {
    console.log('--- onDateChange START ---');
    console.log('onDateChange: Event reçu:', event);

    let selectedDate: Date | null = null;

    // Tenter d'extraire la date de l'événement (méthode préférée)
    if (event?.value instanceof Date && !isNaN(event.value.getTime())) {
      selectedDate = event.value;
      console.log('onDateChange: Date valide directement de event.value:', selectedDate);
    } 
    // Si l'événement ne contient pas une date valide, tenter de parser la valeur de l'input
    else if (event?.target?.value) {
      console.warn('onDateChange: event.value est invalide. Tentative de parsing de event.target.value:', event.target.value);
      selectedDate = this.parseDateFromInput(event.target.value);
      if (selectedDate && !isNaN(selectedDate.getTime())) {
        console.log('onDateChange: Date parsée avec succès depuis event.target.value:', selectedDate);
      } else {
        console.error('onDateChange: Échec du parsing de event.target.value:', event.target.value);
      }
    } 
    // Cas où l'événement est directement un objet Date (ex: depuis ngOnInit)
    else if (event instanceof Date && !isNaN(event.getTime())) {
      selectedDate = event;
      console.log('onDateChange: Date valide directement de l\'événement (objet Date):', selectedDate);
    } else {
      console.error('onDateChange: Aucune date valide n\'a pu être extraite de l\'événement.');
    }

    console.log('onDateChange: Date extraite après toutes les tentatives de parsing:', selectedDate);

    // Validation et assignation
    if (selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
      // Vérifier que la date est dans le futur ou aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour la comparaison de date seule
      
      if (selectedDate < today && selectedDate.toDateString() !== today.toDateString()) {
        console.error('onDateChange: Date dans le passé rejetée:', selectedDate);
        this.showError("Veuillez sélectionner une date dans le futur ou la date d'aujourd'hui.");
        this.newDate = null; // Réinitialiser pour forcer une nouvelle sélection
        this.resetTimeAndAvailability();
        return;
      }

      this.newDate = selectedDate;
      this.resetTimeAndAvailability(); // Réinitialise l'heure et les messages
      this.loadAvailableSlotsForDate(); // Charge les créneaux pour la nouvelle date
    } else {
      console.error('onDateChange: Date finale invalide ou nulle. Aucun changement appliqué.');
      this.newDate = null; // Assurez-vous que newDate est null si la sélection est invalide
      this.showError("Date invalide. Veuillez sélectionner une date valide.");
      this.resetTimeAndAvailability();
    }
    console.log('--- onDateChange END ---');
  }

  /**
   * Parse une date à partir d'un input texte (format DD/MM/YYYY)
   */
  private parseDateFromInput(inputValue: string): Date | null {
    if (!inputValue || !inputValue.includes('/')) {
      return null;
    }

    try {
      const parts = inputValue.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Les mois sont 0-indexés
        const year = parseInt(parts[2]);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    } catch (error) {
      console.error('parseDateFromInput: Erreur de parsing:', error);
    }

    return null;
  }

  /**
   * Réinitialise les champs liés à l'heure et à la disponibilité
   */
  private resetTimeAndAvailability(): void {
    this.newTime = '';
    this.availableHours = [];
    this.availabilityMessage = '';
    this.noServiceMessage = '';
    console.log('resetTimeAndAvailability: Champs d\'heure et de disponibilité réinitialisés.');
  }

  /**
   * Filtre les dates dans le datepicker
   */
  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    
    // Autorise la date d'aujourd'hui et les dates futures
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Pour comparer uniquement la date
    
    return d.getTime() >= today.getTime();
  };

  /**
   * Charge les créneaux disponibles pour la date sélectionnée
   */
  private loadAvailableSlotsForDate(): void {
    if (this.newDate && !isNaN(this.newDate.getTime())) {
      const dateString = this.formatDateToYYYYMMDD(this.newDate);
      console.log('loadAvailableSlotsForDate: Chargement pour', dateString);
      this.getAvailableHours(dateString);
    } else {
      console.warn('loadAvailableSlotsForDate: newDate est invalide, ne peut pas charger les créneaux.');
    }
  }

  /**
   * Récupère les créneaux horaires disponibles
   */
  private getAvailableHours(date: string, preserveSelectedTime: boolean = false): Promise<void> {
  console.log('getAvailableHours: Début pour la date:', date);
  
  // Validation des paramètres
  if (!this.data.doctorMedecinId || !this.data.doctorUserId || !date || date === 'NaN-NaN-NaN') {
    this.setNoSlotsAvailable('Veuillez sélectionner une date valide.');
    console.warn('getAvailableHours: Paramètres invalides, skipping API call.');
    return Promise.resolve();
  }

  this.isCheckingSchedule = true;
  
  // Sauvegarder l'heure sélectionnée si nécessaire
  const selectedTime = preserveSelectedTime ? this.newTime : '';
  
  // Ne réinitialiser que si on ne préserve pas l'heure sélectionnée
  if (!preserveSelectedTime) {
    this.resetTimeAndAvailability(); 
  } else {
    // Réinitialiser seulement les messages
    this.availabilityMessage = '';
    this.noServiceMessage = '';
  }

  const { doctorUserId, doctorMedecinId, doctorName } = this.data;

  return new Promise((resolve, reject) => {
    forkJoin({
      schedules: this.scheduleService.getScheduleByMedecinAndDate(doctorUserId, date),
      existingAppointments: this.apiService.getAppointmentsForDoctorAndDate(doctorMedecinId, date)
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('getAvailableHours: Erreur API:', error);
        this.setNoSlotsAvailable(
          `Impossible de vérifier les horaires du ${doctorName} pour le ${this.formatDate(date)}. Veuillez réessayer.`
        );
        return throwError(() => error);
      })
    ).subscribe({
      next: ({ schedules, existingAppointments }) => {
        console.log('getAvailableHours: Données reçues:', { schedules, existingAppointments });
        this.processSchedulesAndAppointments(schedules, existingAppointments, doctorName, date);
        
        // Restaurer l'heure sélectionnée si elle était préservée
        if (preserveSelectedTime && selectedTime) {
          this.newTime = selectedTime;
          console.log('getAvailableHours: Heure restaurée après traitement:', this.newTime);
        }
        
        resolve();
      },
      error: (err) => {
        this.isCheckingSchedule = false;
        reject(err);
      }
    });
  });
}

  /**
   * Traite les horaires et rendez-vous pour calculer les créneaux disponibles
   */
  private processSchedulesAndAppointments(
    schedules: DaySchedule[], 
    existingAppointments: Appointment[], 
    doctorName: string, 
    date: string
  ): void {
    this.isCheckingSchedule = false;
    console.log('processSchedulesAndAppointments: Début du traitement.');

    // Vérifier s'il y a des horaires définis
    if (!schedules || schedules.length === 0) {
      this.setNoSlotsAvailable(`${doctorName} n'est pas en service le ${this.formatDate(date)}.`);
      console.log('processSchedulesAndAppointments: Aucun horaire trouvé.');
      return;
    }

    // Filtrer les horaires disponibles
    const workingSchedules = schedules.filter((schedule: DaySchedule) => schedule.is_available);
    console.log('processSchedulesAndAppointments: Horaires de travail filtrés:', workingSchedules);
    
    if (workingSchedules.length === 0) {
      this.setNoSlotsAvailable(`${doctorName} n'a pas d'horaires de travail disponibles le ${this.formatDate(date)}.`);
      console.log('processSchedulesAndAppointments: Aucun horaire de travail disponible après filtrage.');
      return;
    }

    // Calculer les créneaux disponibles
    this.calculateAvailableSlots(workingSchedules, existingAppointments, doctorName, date);
    console.log('processSchedulesAndAppointments: availableHours (après calcul):', this.availableHours);
    console.log('processSchedulesAndAppointments: availableHours.length (après calcul):', this.availableHours.length);
  }

  /**
   * Calcule les créneaux disponibles
   */
  private calculateAvailableSlots(
    workingSchedules: DaySchedule[], 
    existingAppointments: Appointment[], 
    doctorName: string, 
    date: string
  ): void {
    console.log('calculateAvailableSlots: Début du calcul des créneaux.');
    // Récupérer les heures occupées (rendez-vous confirmés)
    const occupiedHours = this.getOccupiedHours(existingAppointments);
    console.log('calculateAvailableSlots: Heures occupées:', occupiedHours);
    
    // Générer tous les créneaux possibles
    const allSlots = this.generateHourSlots();
    console.log('calculateAvailableSlots: Tous les créneaux générés:', allSlots.length);
    
    // Filtrer les créneaux dans les heures de travail
    const slotsInWorkingTime = allSlots.filter(hour => 
      this.isTimeInWorkingSchedule(hour, workingSchedules, date)
    );
    console.log('calculateAvailableSlots: Créneaux dans les heures de travail:', slotsInWorkingTime);
    
    // Exclure les créneaux occupés
    const availableSlotsInWorkingTime = slotsInWorkingTime.filter(hour => 
      !occupiedHours.includes(hour)
    );
    console.log('calculateAvailableSlots: Créneaux disponibles après exclusion des occupés:', availableSlotsInWorkingTime);
    
    // Exclure le créneau actuel du rendez-vous (pour éviter de "reporter" au même créneau)
    const finalAvailableSlots = this.excludeCurrentAppointmentSlot(
      availableSlotsInWorkingTime, 
      date
    );
    console.log('calculateAvailableSlots: Créneaux après exclusion du créneau actuel:', finalAvailableSlots);
    
    // Filtrer les créneaux passés si c'est aujourd'hui
    const futureSlots = this.filterPastSlots(finalAvailableSlots, date);
    console.log('calculateAvailableSlots: Créneaux futurs (si aujourd\'hui):', futureSlots);

    // Mettre à jour l'état
    this.updateAvailabilityState(futureSlots, slotsInWorkingTime.length > 0, doctorName, date);
    console.log('calculateAvailableSlots: Fin du calcul des créneaux.');
  }

  /**
   * Récupère les heures occupées par les rendez-vous existants
   */
  private getOccupiedHours(existingAppointments: Appointment[]): string[] {
    return existingAppointments
      .filter(appointment => 
        appointment.statut === 'confirme' || 
        appointment.statut === 'en_attente'
      )
      .map(appointment => {
        const appointmentDate = new Date(appointment.date_heure);
        return appointmentDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      });
  }

  /**
   * Exclut le créneau actuel du rendez-vous à reporter
   */
  private excludeCurrentAppointmentSlot(availableSlots: string[], selectedDate: string): string[] {
    if (!this.originalAppointmentDate) {
      return availableSlots;
    }

    const originalDateStr = this.formatDateToYYYYMMDD(this.originalAppointmentDate);
    
    // Si ce n'est pas la même date, pas besoin d'exclure
    if (originalDateStr !== selectedDate) {
      return availableSlots;
    }

    // Exclure le créneau actuel
    const currentTimeSlot = this.originalAppointmentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    console.log('excludeCurrentAppointmentSlot: Exclusion du créneau actuel:', currentTimeSlot);

    return availableSlots.filter(slot => slot !== currentTimeSlot);
  }

  /**
   * Filtre les créneaux passés pour aujourd'hui
   */
  private filterPastSlots(slots: string[], selectedDate: string): string[] {
    const today = new Date();
    const selectedDateObj = new Date(selectedDate);
    
    // Si ce n'est pas aujourd'hui, retourner tous les créneaux
    if (selectedDateObj.toDateString() !== today.toDateString()) {
      console.log('filterPastSlots: Date sélectionnée n\'est pas aujourd\'hui, pas de filtrage des créneaux passés.');
      return slots;
    }

    // Filtrer les créneaux passés avec une marge de 30 minutes
    const currentTimeInMinutes = today.getHours() * 60 + today.getMinutes();
    
    const filteredSlots = slots.filter(hour => {
      const [hourNum, minuteNum] = hour.split(':').map(Number);
      const slotTimeInMinutes = hourNum * 60 + minuteNum;
      const isPast = slotTimeInMinutes <= currentTimeInMinutes + 30;
      if (isPast) {
        console.log(`filterPastSlots: Créneau ${hour} est dans le passé (+30min), filtré.`);
      }
      return !isPast;
    });
    console.log('filterPastSlots: Créneaux après filtrage des passés:', filteredSlots);
    return filteredSlots;
  }

  /**
   * Met à jour l'état de disponibilité
   */
  private updateAvailabilityState(
    finalSlots: string[], 
    hasWorkingHours: boolean, 
    doctorName: string, 
    date: string
  ): void {
    this.availableHours = finalSlots;
    console.log('updateAvailabilityState: availableHours mis à jour à:', this.availableHours);

    if (!hasWorkingHours) {
      this.setNoSlotsAvailable(`${doctorName} n'a pas d'horaires de travail le ${this.formatDate(date)}.`);
      console.log('updateAvailabilityState: Pas d\'horaires de travail.');
    } else if (finalSlots.length === 0) {
      this.setNoSlotsAvailable(`${doctorName} n'a plus de créneaux disponibles le ${this.formatDate(date)}.`);
      console.log('updateAvailabilityState: Aucun créneau disponible.');
    } else {
      this.noServiceMessage = '';
      this.availabilityMessage = `✅ ${finalSlots.length} créneaux disponibles`;
      console.log('updateAvailabilityState: Créneaux disponibles.');
    }
  }

  /**
   * Définit l'état "aucun créneau disponible"
   */
  private setNoSlotsAvailable(message: string): void {
    this.availableHours = [];
    this.noServiceMessage = message;
    this.availabilityMessage = '';
    this.isCheckingSchedule = false;
    console.log('setNoSlotsAvailable: Message:', message);
  }

  /**
   * Vérifie si un créneau horaire est dans les horaires de travail
   */
  private isTimeInWorkingSchedule(timeSlot: string, workingSchedules: DaySchedule[], selectedDateString: string): boolean {
    const selectedDateTime = new Date(`${selectedDateString}T${timeSlot}`);
    console.log(`isTimeInWorkingSchedule: Vérification du créneau ${timeSlot} pour le ${selectedDateString}. selectedDateTime (locale): ${selectedDateTime.toLocaleString()}`);

    return workingSchedules.some(schedule => {
      console.log('  isTimeInWorkingSchedule: Horaire du médecin:', schedule);
      if (!schedule.start_time || !schedule.end_time) {
        console.log('  isTimeInWorkingSchedule: Horaire manquant start_time ou end_time. Ignoré.');
        return false;
      }

      const scheduleStart = new Date(`${selectedDateString}T${schedule.start_time}`);
      const scheduleEnd = new Date(`${selectedDateString}T${schedule.end_time}`);
      console.log(`  isTimeInWorkingSchedule: scheduleStart (locale): ${scheduleStart.toLocaleString()}, scheduleEnd (locale): ${scheduleEnd.toLocaleString()}`);

      // Vérifier si le créneau est dans les heures de travail
      if (selectedDateTime >= scheduleStart && selectedDateTime < scheduleEnd) {
        console.log(`  isTimeInWorkingSchedule: Créneau ${timeSlot} est dans les heures de travail.`);
        // Vérifier s'il y a une pause et si le créneau tombe dedans
        if (schedule.break_start && schedule.end_break) {
          const breakStart = new Date(`${selectedDateString}T${schedule.break_start}`);
          const breakEnd = new Date(`${selectedDateString}T${schedule.end_break}`);
          console.log(`  isTimeInWorkingSchedule: Pause: ${breakStart.toLocaleString()} à ${breakEnd.toLocaleString()}`);

          // Si c'est pendant la pause, ce n'est pas disponible
          if (selectedDateTime >= breakStart && selectedDateTime < breakEnd) {
            console.log(`  isTimeInWorkingSchedule: Créneau ${timeSlot} est pendant la pause. Non disponible.`);
            return false;
          }
        }
        console.log(`  isTimeInWorkingSchedule: Créneau ${timeSlot} est disponible.`);
        return true;
      }
      console.log(`  isTimeInWorkingSchedule: Créneau ${timeSlot} n'est PAS dans les heures de travail.`);
      return false;
    });
  }

  /**
   * Génère tous les créneaux horaires possibles par tranches de 30 minutes
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
   * Formate une date pour l'affichage dans l'input (DD/MM/YYYY)
   */
  formatDateForInput(date: Date | null): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formate une date en chaîne longue française
   */
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

  /**
   * Formate une date en YYYY-MM-DD pour les appels API
   */
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
