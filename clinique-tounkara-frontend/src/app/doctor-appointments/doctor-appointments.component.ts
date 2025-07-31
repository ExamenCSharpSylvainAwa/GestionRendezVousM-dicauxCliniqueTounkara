// doctor-appointments.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { ApiService, Appointment, PaginatedResponse, User } from '../services/api.service';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { RescheduleAppointmentDialogComponent, RescheduleDialogResult, RescheduleDialogData } from '../components/reschedule-appointment-dialog/reschedule-appointment-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-doctor-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule
  ],
  templateUrl: './doctor-appointments.component.html',
  styleUrls: ['./doctor-appointments.component.scss']
})
export class DoctorAppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  displayedColumns: string[] = ['date', 'time', 'patient', 'status', 'actions'];
  isLoading = false;
  errorMessage: string | null = null;
  currentUserRole: string | null = null;

  // Propriétés de filtrage
  searchPatient: string = '';
  selectedStatus: string = '';
  startDate: Date | null = null;
  endDate: Date | null = null;

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAppointments();
    this.loadUserProfile();
  }

  private loadUserProfile(): void {
    this.apiService.getProfile().subscribe({
      next: (response: any) => {
        console.log('Réponse complète getProfile:', response);
        
        if (response && response.user && response.user.role) {
          this.currentUserRole = response.user.role;
          console.log('Rôle de l\'utilisateur actuel:', this.currentUserRole);
        } else {
          console.error('Structure de réponse inattendue pour getProfile:', response);
          this.snackBar.open('Erreur: impossible de déterminer le rôle utilisateur.', 'Fermer', { panelClass: ['snackbar-error'] });
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement du profil utilisateur:', err);
        this.snackBar.open('Erreur lors du chargement du profil utilisateur.', 'Fermer', { panelClass: ['snackbar-error'] });
      }
    });
  }

  loadAppointments(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.apiService.getAppointments().pipe(
      map((response: PaginatedResponse<Appointment>) => {
        return response.data;
      }),
      catchError((error: HttpErrorResponse) => {
        this.errorMessage = error.message || 'Erreur lors de la récupération des rendez-vous';
        this.isLoading = false;
        return throwError(() => error);
      })
    ).subscribe({
      next: (data: Appointment[]) => {
        this.appointments = this.sortAppointmentsByDate(data);
        this.filteredAppointments = [...this.appointments];
        this.isLoading = false;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rendez-vous:', err);
        this.errorMessage = err.message || 'Erreur inconnue';
        this.isLoading = false;
        this.snackBar.open(this.errorMessage || 'Erreur inconnue', 'Fermer', { panelClass: ['snackbar-error'] });
      }
    });
  }

  sortAppointmentsByDate(appointments: Appointment[]): Appointment[] {
    return appointments.sort((a, b) => {
      const dateA = new Date(a.date_heure).getTime();
      const dateB = new Date(b.date_heure).getTime();
      return dateA - dateB;
    });
  }

  // Méthodes de filtrage
  applyFilters(): void {
    let filtered = [...this.appointments];

    // Filtre par nom de patient
    if (this.searchPatient.trim()) {
      filtered = filtered.filter(appointment => {
        const patientName = this.getPatientName(appointment).toLowerCase();
        return patientName.includes(this.searchPatient.toLowerCase());
      });
    }

    // Filtre par statut
    if (this.selectedStatus) {
      filtered = filtered.filter(appointment => appointment.statut === this.selectedStatus);
    }

    // Filtre par date de début
    if (this.startDate) {
      filtered = filtered.filter(appointment => {
        const appointmentDate = new Date(appointment.date_heure);
        appointmentDate.setHours(0, 0, 0, 0);
        const startDateCopy = new Date(this.startDate!);
        startDateCopy.setHours(0, 0, 0, 0);
        return appointmentDate >= startDateCopy;
      });
    }

    // Filtre par date de fin
    if (this.endDate) {
      filtered = filtered.filter(appointment => {
        const appointmentDate = new Date(appointment.date_heure);
        appointmentDate.setHours(23, 59, 59, 999);
        const endDateCopy = new Date(this.endDate!);
        endDateCopy.setHours(23, 59, 59, 999);
        return appointmentDate <= endDateCopy;
      });
    }

    this.filteredAppointments = filtered;
  }

  clearAllFilters(): void {
    this.searchPatient = '';
    this.selectedStatus = '';
    this.startDate = null;
    this.endDate = null;
    this.applyFilters();
  }

  // Méthodes pour les statistiques
  getTotalAppointments(): number {
    return this.appointments.length;
  }

  getPendingAppointments(): number {
    return this.appointments.filter(app => app.statut === 'en_attente').length;
  }

  getConfirmedAppointments(): number {
    return this.appointments.filter(app => app.statut === 'confirme').length;
  }

  // Méthodes utilitaires
  getPatientName(appointment: Appointment): string {
    return appointment.patient?.user ? `${appointment.patient.user.prenom} ${appointment.patient.user.nom}` : 'N/A';
  }

  getPatientInitials(appointment: Appointment): string {
    if (appointment.patient?.user) {
      const prenom = appointment.patient.user.prenom || '';
      const nom = appointment.patient.user.nom || '';
      return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
    }
    return 'NA';
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

  getStatusIcon(statut: 'en_attente' | 'confirme' | 'annule' | 'termine'): string {
    switch (statut) {
      case 'en_attente':
        return 'schedule';
      case 'confirme':
        return 'check_circle';
      case 'annule':
        return 'cancel';
      case 'termine':
        return 'task_alt';
      default:
        return 'help';
    }
  }

  /**
   * Vérifie si le rendez-vous a été payé (statut du paiement = 'paye')
   */
  isAppointmentPaid(appointment: Appointment): boolean {
    return appointment.paiement?.statut === 'paye';
  }

  /**
   * Vérifie si on peut marquer le rendez-vous comme terminé
   * - Le rendez-vous doit être confirmé ou payé
   * - Le paiement doit avoir le statut 'paye'
   * - Le rendez-vous ne doit pas déjà être terminé
   */
  canMarkAsCompleted(appointment: Appointment): boolean {
    return (appointment.statut === 'confirme' || appointment.statut === 'termine') && 
           this.isAppointmentPaid(appointment) && 
           appointment.statut !== 'termine';
  }

  /**
   * Formate uniquement l'heure d'un datetime (corrigé pour UTC)
   */
  formatTimeOnly(dateTime: string): string {
    if (!dateTime) return 'N/A';
    
    try {
      const dateObj = new Date(dateTime);
      
      // Vérifier si la date est valide
      if (isNaN(dateObj.getTime())) {
        console.error('Date invalide:', dateTime);
        return 'Date invalide';
      }
      
      // Formater l'heure en tenant compte du timezone local
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('Erreur lors du formatage de l\'heure:', error, dateTime);
      return 'Erreur';
    }
  }

  /**
   * Formate uniquement la date d'un datetime (corrigé pour UTC)
   */
  formatDateOnly(dateTime: string): string {
    if (!dateTime) return 'N/A';
    
    try {
      const dateObj = new Date(dateTime);
      
      // Vérifier si la date est valide
      if (isNaN(dateObj.getTime())) {
        console.error('Date invalide:', dateTime);
        return 'Date invalide';
      }
      
      // Formater la date en tenant compte du timezone local
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error, dateTime);
      return 'Erreur';
    }
  }

  /**
   * Alternative avec Intl.DateTimeFormat pour plus de fiabilité
   */
  formatTimeOnlyIntl(dateTime: string): string {
    if (!dateTime) return 'N/A';
    
    try {
      const dateObj = new Date(dateTime);
      
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Dakar' // Votre timezone à Dakar
      }).format(dateObj);
    } catch (error) {
      console.error('Erreur Intl:', error);
      return 'Erreur';
    }
  }

  /**
   * Alternative avec Intl.DateTimeFormat pour la date
   */
  formatDateOnlyIntl(dateTime: string): string {
    if (!dateTime) return 'N/A';
    
    try {
      const dateObj = new Date(dateTime);
      
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Africa/Dakar' // Votre timezone à Dakar
      }).format(dateObj);
    } catch (error) {
      console.error('Erreur Intl:', error);
      return 'Erreur';
    }
  }

  /**
   * Confirme un rendez-vous.
   * @param appointment L'objet rendez-vous à confirmer.
   */
  confirmAppointment(appointment: Appointment): void {
    // Vérifie si l'utilisateur actuel est un médecin
    if (this.currentUserRole !== 'medecin') {
      this.snackBar.open('Seuls les médecins peuvent confirmer les rendez-vous.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }

    if (!appointment.id) {
      this.snackBar.open('ID du rendez-vous manquant pour la confirmation.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }

    this.isLoading = true;
    this.apiService.confirmAppointment(appointment.id).subscribe({
      next: (response) => {
        this.snackBar.open('Rendez-vous confirmé avec succès ! ✅', 'Fermer', { 
          panelClass: ['snackbar-success'],
          duration: 3000
        });
        this.loadAppointments();
      },
      error: (error) => {
        this.snackBar.open(`Erreur lors de la confirmation: ${error.message || 'Erreur inconnue'}`, 'Fermer', { 
          panelClass: ['snackbar-error'],
          duration: 5000
        });
        this.isLoading = false;
      }
    });
  }

  /**
   * Marque un rendez-vous comme terminé (consultation effectuée).
   * @param appointment L'objet rendez-vous à marquer comme terminé.
   */
  markAppointmentAsCompleted(appointment: Appointment): void {
    // Vérifie si l'utilisateur actuel est un médecin
    if (this.currentUserRole !== 'medecin') {
      this.snackBar.open('Seuls les médecins peuvent marquer les rendez-vous comme terminés.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }

    if (!appointment.id) {
      this.snackBar.open('ID du rendez-vous manquant.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }

    // Vérifier que le rendez-vous peut être marqué comme terminé
    if (!this.canMarkAsCompleted(appointment)) {
      this.snackBar.open('Ce rendez-vous ne peut pas être marqué comme terminé. Vérifiez que le paiement a été effectué.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }

    this.isLoading = true;
    this.apiService.updateAppointmentStatut(appointment.id, 'termine').subscribe({
      next: (response) => {
        this.snackBar.open('Rendez-vous marqué comme terminé avec succès ! 🏁', 'Fermer', { 
          panelClass: ['snackbar-success'],
          duration: 3000
        });
        this.loadAppointments();
      },
      error: (error) => {
        this.snackBar.open(`Erreur lors de la mise à jour: ${error.message || 'Erreur inconnue'}`, 'Fermer', { 
          panelClass: ['snackbar-error'],
          duration: 5000
        });
        this.isLoading = false;
      }
    });
  }

  /**
   * Ouvre la modale pour reporter un rendez-vous.
   * @param appointment Le rendez-vous à reporter.
   */
  rescheduleAppointment(appointment: Appointment): void {
    if (!appointment.id || !appointment.medecin?.id || !appointment.medecin?.user?.id) {
      this.snackBar.open('Informations du médecin manquantes pour le report.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }

    const dialogData: RescheduleDialogData = {
      appointmentId: appointment.id,
      patientName: this.getPatientName(appointment),
      doctorName: `Dr. ${appointment.medecin.user.prenom} ${appointment.medecin.user.nom}`,
      currentDate: this.formatDateTime(appointment.date_heure),
      doctorMedecinId: appointment.medecin.id,
      doctorUserId: appointment.medecin.user.id
    };

    const dialogRef = this.dialog.open(RescheduleAppointmentDialogComponent, {
      width: '400px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: RescheduleDialogResult | undefined) => {
      if (result && result.confirmed) {
        this.isLoading = true;
        const rescheduleData = {
            new_date_heure: result.newDateHeure,
            reschedule_reason: result.reason,
            patient_id: appointment.patient_id,
            medecin_id: appointment.medecin_id,
            motif: appointment.motif,
            tarif: appointment.tarif !== undefined ? appointment.tarif : 0
        };
        this.apiService.rescheduleAppointment(appointment.id!, rescheduleData).subscribe({
          next: (response) => {
            this.snackBar.open('Rendez-vous reporté avec succès ! 🗓️', 'Fermer', { 
              panelClass: ['snackbar-success'],
              duration: 3000
            });
            this.loadAppointments();
          },
          error: (error) => {
            this.snackBar.open(`Erreur lors du report: ${error.message || 'Erreur inconnue'}`, 'Fermer', { 
              panelClass: ['snackbar-error'],
              duration: 5000
            });
            this.isLoading = false;
          }
        });
      } else {
        console.log('Report annulé par l\'utilisateur.');
      }
    });
  }
}