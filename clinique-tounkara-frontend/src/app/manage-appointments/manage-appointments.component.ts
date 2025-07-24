// src/app/components/manage-appointments/manage-appointments.component.ts
import { Component, OnInit, Inject } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ApiService, Appointment, Patient, Medecin, User } from '../services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
// Importez le bon dialogue d'annulation
import { CancelAppointmentDialogComponent, CancelDialogResult, CancelDialogData } from '../components/cancel-appointment-dialog/cancel-appointment-dialog.component';
import { RescheduleAppointmentDialogComponent, RescheduleDialogResult, RescheduleDialogData } from '../components/reschedule-appointment-dialog/reschedule-appointment-dialog.component';
import { AppointmentDialogComponent, AppointmentDialogResult, AppointmentDialogData } from '../components/appointment-dialog/appointment-dialog.component';
import { forkJoin } from 'rxjs'; // Ajout de forkJoin pour charger toutes les données en parallèle

@Component({
  selector: 'app-manage-appointments',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './manage-appointments.component.html',
  styleUrls: ['./manage-appointments.component.scss']
})
export class ManageAppointmentsComponent implements OnInit {
  displayedColumns: string[] = ['patient', 'doctor', 'date_heure', 'motif', 'statut', 'actions'];
  dataSource = new MatTableDataSource<Appointment>([]);
  appointments: Appointment[] = [];
  patients: Patient[] = []; // Liste des patients pour les sélecteurs
  doctors: Medecin[] = []; // Liste des médecins pour les sélecteurs
  currentUserRole: string | null = null; // Nouvelle propriété pour stocker le rôle de l'utilisateur

  constructor(
    public dialog: MatDialog,
    @Inject(ApiService) private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    console.log('ManageAppointmentsComponent: Initialisation du composant.');
    // Charger toutes les données nécessaires au démarrage
    this.loadAllData();
    // Charger le profil de l'utilisateur pour obtenir son rôle
    this.apiService.getProfile().subscribe({
      next: (user: User) => {
        this.currentUserRole = user.role;
        console.log('ManageAppointmentsComponent: Rôle de l\'utilisateur actuel:', this.currentUserRole);
      },
      error: (err) => {
        console.error('ManageAppointmentsComponent: Erreur lors du chargement du profil utilisateur:', err);
        this.snackBar.open('Erreur lors du chargement du profil utilisateur.', 'Fermer', { duration: 5000 });
      }
    });
  }

  /**
   * Loads all necessary data (appointments, patients, doctors) in parallel.
   */
  loadAllData(): void {
    console.log('ManageAppointmentsComponent: Chargement de toutes les données...');
    forkJoin({
      appointments: this.apiService.getAppointments(),
      patients: this.apiService.getPatients(),
      doctors: this.apiService.getMedecins()
    }).subscribe({
      next: (results) => {
        this.appointments = results.appointments.data || [];
        this.patients = results.patients.data || [];
        this.doctors = results.doctors.data || [];
        this.dataSource.data = this.appointments; // Update table once all data is loaded

        console.log('ManageAppointmentsComponent: Toutes les données chargées avec succès.');
        console.log('ManageAppointmentsComponent: Rendez-vous:', this.appointments);
        console.log('ManageAppointmentsComponent: Patients:', this.patients);
        console.log('ManageAppointmentsComponent: Médecins:', this.doctors);
      },
      error: (error: HttpErrorResponse) => {
        console.error('ManageAppointmentsComponent: Erreur lors du chargement de toutes les données:', error);
        this.snackBar.open('Erreur lors du chargement des données (rendez-vous, patients, médecins)', 'Fermer', { duration: 5000 });
      }
    });
  }

  /**
   * Opens the modal to create a new appointment.
   */
  openCreateAppointmentDialog(): void {
    const dialogData: AppointmentDialogData = {
      patients: this.patients,
      doctors: this.doctors
    };

    const dialogRef = this.dialog.open(AppointmentDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: AppointmentDialogResult) => {
      console.log('ManageAppointmentsComponent: Dialogue de création fermé. Résultat:', result);
      if (result?.confirmed && result.appointmentData) {
        this.apiService.createAppointment(result.appointmentData as Omit<Appointment, 'id' | 'statut'>).subscribe({
          next: () => {
            this.snackBar.open('Rendez-vous créé avec succès', 'Fermer', { duration: 3000 });
            this.loadAllData(); // Reload all data to refresh the table
          },
          error: (error: HttpErrorResponse) => {
            console.error('ManageAppointmentsComponent: Erreur lors de la création du rendez-vous:', error);
            let errorMessage = 'Erreur lors de la création du rendez-vous';
            if (error.status === 422 && error.error && error.error.errors) {
              const validationErrors = error.error.errors;
              errorMessage = 'Erreur de validation: ';
              for (const key in validationErrors) {
                if (validationErrors.hasOwnProperty(key)) {
                  errorMessage += `${key}: ${validationErrors[key].join(', ')} ; `;
                }
              }
            } else if ((error as any).type === 'AVAILABILITY_ERROR' || (error as any).type === 'SLOT_OCCUPIED') {
              errorMessage = (error as any).message;
            }
            this.snackBar.open(errorMessage, 'Fermer', { duration: 5000 });
          }
        });
      }
    });
  }

  /**
   * Confirms an appointment.
   * @param appointment The appointment to confirm.
   */
  confirmAppointment(appointment: Appointment): void {
    console.log('ManageAppointmentsComponent: Tentative de confirmation du rendez-vous ID:', appointment.id);
    // Vérifie si l'utilisateur actuel est un médecin
    if (this.currentUserRole !== 'medecin') {
      this.snackBar.open('Seuls les médecins peuvent confirmer les rendez-vous.', 'Fermer', { panelClass: ['snackbar-error'] });
      return; // Empêche l'appel API si l'utilisateur n'est pas un médecin
    }

    if (!appointment.id) {
      this.snackBar.open('Appointment ID missing for confirmation.', 'Close', { duration: 3000 });
      return;
    }
    this.apiService.confirmAppointment(appointment.id).subscribe({
      next: (response) => {
        console.log('ManageAppointmentsComponent: Confirmation réussie. Réponse API:', response);
        this.snackBar.open('Appointment confirmed successfully', 'Close', { duration: 3000 });
        this.loadAllData(); // Recharger la liste
      },
      error: (error: HttpErrorResponse) => {
        console.error('ManageAppointmentsComponent: Erreur lors de la confirmation:', error);
        this.snackBar.open('Error confirming appointment', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Cancels an appointment.
   * @param appointment The appointment to cancel.
   */
  cancelAppointment(appointment: Appointment): void {
    console.log('ManageAppointmentsComponent: Tentative d\'annulation du rendez-vous ID:', appointment.id);
    if (!appointment.id) {
      this.snackBar.open('Appointment ID missing for cancellation.', 'Close', { duration: 3000 });
      return;
    }

    // Préparer les données pour la modale d'annulation
    const dialogData: CancelDialogData = {
      appointmentId: appointment.id!,
      patientName: this.getPatientFullName(appointment),
      doctorName: this.getDoctorFullName(appointment),
      appointmentDate: this.formatDateTime(appointment.date_heure)
    };

    // Ouvrir le dialogue d'annulation DÉDIÉ
    const dialogRef = this.dialog.open(CancelAppointmentDialogComponent, {
      width: '400px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: CancelDialogResult | undefined) => {
      console.log('ManageAppointmentsComponent: Résultat dialogue annulation:', result);
      if (result?.confirmed === true) { // Check that the dialog was confirmed and not cancelled
        const reason = result.reason || ''; // Retrieve the reason (it's now mandatory in the dialog HTML)
        console.log('ManageAppointmentsComponent: Appel API pour annuler le rendez-vous ID:', appointment.id, 'avec raison:', reason);
        this.apiService.cancelAppointment(appointment.id!, reason).subscribe({
          next: (response) => {
            console.log('ManageAppointmentsComponent: Annulation réussie. Réponse API:', response);
            this.snackBar.open('Rendez-vous annulé avec succès', 'Close', { duration: 3000 });
            this.loadAllData(); // Recharger les données après succès
          },
          error: (error: HttpErrorResponse) => {
            console.error('ManageAppointmentsComponent: Erreur lors de l\'annulation:', error);
            let errorMessage = 'Error cancelling appointment.';
            if (error && error.error && error.error.message) {
              errorMessage = error.error.message;
            } else if (error.message) {
              errorMessage = error.message;
            }
            this.snackBar.open(errorMessage, 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  /**
   * Reschedules an appointment.
   * @param appointment The appointment to reschedule.
   */
  rescheduleAppointment(appointment: Appointment): void {
    // Log the appointment object to debug its content
    console.log('ManageAppointmentsComponent: Tentative de report du rendez-vous:', appointment);

    let errorMessage = '';
    if (!appointment.id) {
      errorMessage = 'ID du rendez-vous manquant.';
    } else if (!appointment.medecin?.id) {
      errorMessage = 'ID du médecin manquant.';
    } else if (!appointment.medecin?.user?.id) {
      errorMessage = 'ID utilisateur du médecin manquant.';
    } else if (!appointment.medecin?.user?.nom) { // CHANGEMENT ICI: Vérifie le nom via user.nom
      errorMessage = 'Nom du médecin manquant.';
    } else if (!appointment.date_heure) {
      errorMessage = 'Date et heure du rendez-vous manquantes.';
    } else if (appointment.patient?.id === undefined || appointment.patient?.id === null) {
        errorMessage = 'ID du patient manquant.';
    } else if (appointment.motif === undefined || appointment.motif === null) {
        errorMessage = 'Motif du rendez-vous manquant.';
    } else if (appointment.tarif === undefined || appointment.tarif === null) {
        errorMessage = 'Tarif du rendez-vous manquant.';
    }


    if (errorMessage) {
      this.snackBar.open(`Erreur de données pour le report: ${errorMessage}`, 'Fermer', { duration: 5000 });
      return;
    }

    // Préparer les données pour le RescheduleAppointmentDialogComponent
    const dialogData: RescheduleDialogData = {
      appointmentId: appointment.id!, // Utilisation de l'opérateur de non-nullité
      patientName: this.getPatientFullName(appointment),
      doctorName: this.getDoctorFullName(appointment),
      currentDate: this.formatDateTime(appointment.date_heure),
      doctorMedecinId: appointment.medecin!.id, // Utilisation de l'opérateur de non-nullité
      doctorUserId: appointment.medecin!.user!.id as number // Ajout du casting 'as number'
    };

    const dialogRef = this.dialog.open(RescheduleAppointmentDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('ManageAppointmentsComponent: Dialogue de report fermé. Résultat:', result);
      if (result?.confirmed && result.newDateHeure && result.reason) {
        // Pour le report direct depuis cette vue, nous devons aussi passer
        // le patient_id, medecin_id, motif et tarif actuels du rendez-vous.
        // La modale de report ne les collecte pas directement, donc nous les prenons de l'objet appointment original.
        const reschedulePayload = {
          new_date_heure: result.newDateHeure,
          reschedule_reason: result.reason,
          patient_id: appointment.patient_id, // Utiliser le patient_id existant
          medecin_id: appointment.medecin_id, // Utiliser le medecin_id existant
          motif: appointment.motif, // Utiliser le motif existant
          tarif: appointment.tarif !== undefined ? appointment.tarif : 0 // Utiliser le tarif existant
        };
        console.log('ManageAppointmentsComponent: Appel API pour reporter le rendez-vous ID:', appointment.id, 'avec données:', reschedulePayload);

        this.apiService.rescheduleAppointment(appointment.id!, reschedulePayload).subscribe({
          next: (response) => {
            console.log('ManageAppointmentsComponent: Report réussi. Réponse API:', response);
            this.snackBar.open('Rendez-vous reporté avec succès', 'Fermer', { duration: 3000 });
            this.loadAllData();
          },
          error: (error: HttpErrorResponse) => {
            console.error('ManageAppointmentsComponent: Erreur lors du report du rendez-vous:', error);
            this.snackBar.open('Erreur lors du report du rendez-vous', 'Fermer', { duration: 3000 });
          }
        });
      }
    });
  }

  /**
   * Formats a date and time for display in the table.
   * @param dateTimeString The date/time string (ISO string).
   * @returns The formatted date and time.
   */
  formatDateTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Retrieves the full name of the patient.
   * @param appointment The appointment.
   * @returns Full name of the patient or empty string.
   */
  getPatientFullName(appointment: Appointment): string {
    // Access the 'user' property to get the first and last name
    return appointment.patient?.user ? `${appointment.patient.user.prenom} ${appointment.patient.user.nom}` : 'N/A';
  }

  /**
   * Retrieves the full name of the doctor.
   * @param appointment The appointment.
   * @returns Full name of the doctor or empty string.
   */
  getDoctorFullName(appointment: Appointment): string {
    // Access the 'user' property to get the first and last name
    return appointment.medecin?.user ? `Dr. ${appointment.medecin.user.prenom} ${appointment.medecin.user.nom}` : 'N/A';
  }

  /**
   * Returns the CSS class for the appointment status.
   * @param statut The status of the appointment.
   * @returns The CSS class string.
   */
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

  /**
   * Returns the human-readable label for the appointment status.
   * @param statut The status of the appointment.
   * @returns The label string.
   */
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
