// doctor-appointments.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ApiService, Appointment, PaginatedResponse, User } from '../services/api.service';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { RescheduleAppointmentDialogComponent, RescheduleDialogResult, RescheduleDialogData } from '../components/reschedule-appointment-dialog/reschedule-appointment-dialog.component'; // Importez RescheduleDialogData

@Component({
  selector: 'app-doctor-appointments',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './doctor-appointments.component.html',
  styleUrls: ['./doctor-appointments.component.scss']
})
export class DoctorAppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];
  displayedColumns: string[] = ['date', 'time', 'patient', 'status', 'actions'];
  isLoading = false;
  errorMessage: string | null = null;
  currentUserRole: string | null = null; // Nouvelle propriété pour stocker le rôle de l'utilisateur

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAppointments();
    // Charge le profil de l'utilisateur pour obtenir son rôle
    this.apiService.getProfile().subscribe({
      next: (user: User) => {
        this.currentUserRole = user.role;
        console.log('Rôle de l\'utilisateur actuel:', this.currentUserRole);
      },
      error: (err) => {
        console.error('Erreur lors du chargement du profil utilisateur:', err);
        this.snackBar.open('Erreur lors du chargement du profil utilisateur.', 'Fermer', { panelClass: ['snackbar-error'] });
      }
    });
  }

  loadAppointments(): void {
    this.isLoading = true;
    this.apiService.getAppointments().pipe(
      map((response: PaginatedResponse<Appointment>) => {
        // Supposons que getAppointments() renvoie déjà les rendez-vous du médecin connecté
        // ou que le filtrage est fait au niveau du backend.
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
        this.isLoading = false;
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

  getPatientName(appointment: Appointment): string {
    return appointment.patient?.user ? `${appointment.patient.user.prenom} ${appointment.patient.user.nom}` : 'N/A';
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

  /**
   * Confirme un rendez-vous.
   * @param appointment L'objet rendez-vous à confirmer.
   */
  confirmAppointment(appointment: Appointment): void {
    // Vérifie si l'utilisateur actuel est un médecin
    if (this.currentUserRole !== 'medecin') {
      this.snackBar.open('Seuls les médecins peuvent confirmer les rendez-vous.', 'Fermer', { panelClass: ['snackbar-error'] });
      return; // Empêche l'appel API si l'utilisateur n'est pas un médecin
    }

    if (!appointment.id) {
      this.snackBar.open('ID du rendez-vous manquant pour la confirmation.', 'Fermer', { panelClass: ['snackbar-error'] });
      return;
    }
    this.isLoading = true;
    this.apiService.confirmAppointment(appointment.id).subscribe({
      next: (response) => {
        this.snackBar.open('Rendez-vous confirmé avec succès ! ✅', 'Fermer', { panelClass: ['snackbar-success'] });
        this.loadAppointments(); // Recharger la liste
      },
      error: (error) => {
        this.snackBar.open(`Erreur lors de la confirmation: ${error.message || 'Erreur inconnue'}`, 'Fermer', { panelClass: ['snackbar-error'] });
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
      doctorMedecinId: appointment.medecin.id, // Passer l'ID du profil médecin
      doctorUserId: appointment.medecin.user.id // Passer l'ID de l'utilisateur médecin
    };

    const dialogRef = this.dialog.open(RescheduleAppointmentDialogComponent, {
      width: '400px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: RescheduleDialogResult | undefined) => {
      if (result && result.confirmed) {
        this.isLoading = true;
        // La méthode rescheduleAppointment dans api.service.ts attend maintenant un objet data complet
        // avec new_date_heure, reschedule_reason, patient_id, medecin_id, motif et tarif.
        // Nous devons donc récupérer ces informations du rendez-vous original et les inclure.
        const rescheduleData = {
            new_date_heure: result.newDateHeure,
            reschedule_reason: result.reason,
            patient_id: appointment.patient_id,
            medecin_id: appointment.medecin_id,
            motif: appointment.motif,
            tarif: appointment.tarif !== undefined ? appointment.tarif : 0 // Assurez-vous d'avoir une valeur par défaut si tarif est optionnel
        };
        this.apiService.rescheduleAppointment(appointment.id!, rescheduleData).subscribe({
          next: (response) => {
            this.snackBar.open('Rendez-vous reporté avec succès ! 🗓️', 'Fermer', { panelClass: ['snackbar-success'] });
            this.loadAppointments(); // Recharger la liste
          },
          error: (error) => {
            this.snackBar.open(`Erreur lors du report: ${error.message || 'Erreur inconnue'}`, 'Fermer', { panelClass: ['snackbar-error'] });
            this.isLoading = false;
          }
        });
      } else {
        console.log('Report annulé par l\'utilisateur.');
      }
    });
  }
}
