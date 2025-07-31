import { Component, OnInit, Inject } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Appointment, Patient, Medecin, User } from '../services/api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CancelAppointmentDialogComponent, CancelDialogResult, CancelDialogData } from '../components/cancel-appointment-dialog/cancel-appointment-dialog.component';
import { RescheduleAppointmentDialogComponent, RescheduleDialogResult, RescheduleDialogData } from '../components/reschedule-appointment-dialog/reschedule-appointment-dialog.component';
import { AppointmentDialogComponent, AppointmentDialogResult, AppointmentDialogData } from '../components/appointment-dialog/appointment-dialog.component';
import { forkJoin } from 'rxjs';

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
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
  ],
  templateUrl: './manage-appointments.component.html',
  styleUrls: ['./manage-appointments.component.scss'],
})
export class ManageAppointmentsComponent implements OnInit {
  displayedColumns: string[] = ['patient', 'doctor', 'date_heure', 'motif', 'statut', 'actions'];
  dataSource = new MatTableDataSource<Appointment>([]);
  appointments: Appointment[] = [];
  patients: Patient[] = [];
  doctors: Medecin[] = [];
  currentUserRole: string | null = null;

  // Variables pour les filtres
  selectedStatus: string = '';
  patientFilter: string = '';
  doctorFilter: string = '';
  dateFilter: Date | null = null;

  constructor(
    public dialog: MatDialog,
    @Inject(ApiService) private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    console.log('ManageAppointmentsComponent: Initialisation du composant.');
    this.loadAllData();
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
      doctors: this.apiService.getMedecins(),
    }).subscribe({
      next: (results) => {
        this.appointments = results.appointments.data || [];
        this.patients = results.patients.data || [];
        this.doctors = results.doctors.data || [];
        this.applyFilters(); // Appliquer les filtres initiaux
        console.log('ManageAppointmentsComponent: Toutes les données chargées avec succès.');
      },
      error: (error: HttpErrorResponse) => {
        console.error('ManageAppointmentsComponent: Erreur lors du chargement de toutes les données:', error);
        this.snackBar.open('Erreur lors du chargement des données.', 'Fermer', { duration: 5000 });
      },
    });
  }

  /**
   * Applies filters to the appointments list.
   */
  applyFilters(): void {
    let filteredAppointments = [...this.appointments];

    // Filtrer par statut
    if (this.selectedStatus) {
      filteredAppointments = filteredAppointments.filter(
        (appointment) => appointment.statut === this.selectedStatus
      );
    }

    // Filtrer par patient
    if (this.patientFilter) {
      const searchTerm = this.patientFilter.toLowerCase().trim();
      filteredAppointments = filteredAppointments.filter((appointment) => {
        const fullName = this.getPatientFullName(appointment).toLowerCase();
        return fullName.includes(searchTerm);
      });
    }

    // Filtrer par médecin
    if (this.doctorFilter) {
      const searchTerm = this.doctorFilter.toLowerCase().trim();
      filteredAppointments = filteredAppointments.filter((appointment) => {
        const fullName = this.getDoctorFullName(appointment).toLowerCase();
        return fullName.includes(searchTerm);
      });
    }

    // Filtrer par date
    if (this.dateFilter) {
      const filterDate = new Date(this.dateFilter);
      filteredAppointments = filteredAppointments.filter((appointment) => {
        const appointmentDate = new Date(appointment.date_heure);
        return (
          appointmentDate.getFullYear() === filterDate.getFullYear() &&
          appointmentDate.getMonth() === filterDate.getMonth() &&
          appointmentDate.getDate() === filterDate.getDate()
        );
      });
    }

    this.dataSource.data = filteredAppointments;
  }

  /**
   * Clears all filters and resets the table.
   */
  clearFilters(): void {
    this.selectedStatus = '';
    this.patientFilter = '';
    this.doctorFilter = '';
    this.dateFilter = null;
    this.applyFilters();
    this.snackBar.open('Filtres réinitialisés.', 'Fermer', { duration: 3000 });
  }

  // Les autres méthodes (openCreateAppointmentDialog, confirmAppointment, etc.) restent inchangées
  // Inclure ici les méthodes existantes comme dans votre code original...

  /**
   * Formats a date and time for display in the table.
   */
  formatDateTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Retrieves the full name of the patient.
   */
  getPatientFullName(appointment: Appointment): string {
    return appointment.patient?.user
      ? `${appointment.patient.user.prenom} ${appointment.patient.user.nom}`
      : 'N/A';
  }

  /**
   * Retrieves the full name of the doctor.
   */
  getDoctorFullName(appointment: Appointment): string {
    return appointment.medecin?.user
      ? `Dr. ${appointment.medecin.user.prenom} ${appointment.medecin.user.nom}`
      : 'N/A';
  }

  /**
   * Returns the CSS class for the appointment status.
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

  /**
   * Confirms an appointment.
   */
  confirmAppointment(appointment: Appointment): void {
    if (this.currentUserRole !== 'medecin') {
      this.snackBar.open('Seuls les médecins peuvent confirmer les rendez-vous.', 'Fermer', {
        panelClass: ['error-snackbar'],
      });
      return;
    }

    if (!appointment.id) {
      this.snackBar.open('ID du rendez-vous manquant.', 'Fermer', { duration: 3000 });
      return;
    }
    this.apiService.confirmAppointment(appointment.id).subscribe({
      next: () => {
        this.snackBar.open('Rendez-vous confirmé avec succès.', 'Fermer', { duration: 3000 });
        this.loadAllData();
      },
      error: (error: HttpErrorResponse) => {
        this.snackBar.open('Erreur lors de la confirmation du rendez-vous.', 'Fermer', { duration: 3000 });
      },
    });
  }

  /**
   * Cancels an appointment.
   */
  cancelAppointment(appointment: Appointment): void {
    if (!appointment.id) {
      this.snackBar.open('ID du rendez-vous manquant.', 'Fermer', { duration: 3000 });
      return;
    }

    const dialogData: CancelDialogData = {
      appointmentId: appointment.id!,
      patientName: this.getPatientFullName(appointment),
      doctorName: this.getDoctorFullName(appointment),
      appointmentDate: this.formatDateTime(appointment.date_heure),
    };

    const dialogRef = this.dialog.open(CancelAppointmentDialogComponent, {
      width: '400px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: CancelDialogResult | undefined) => {
      if (result?.confirmed) {
        const reason = result.reason || '';
        this.apiService.cancelAppointment(appointment.id!, reason).subscribe({
          next: () => {
            this.snackBar.open('Rendez-vous annulé avec succès.', 'Fermer', { duration: 3000 });
            this.loadAllData();
          },
          error: (error: HttpErrorResponse) => {
            let errorMessage = 'Erreur lors de l\'annulation du rendez-vous.';
            if (error && error.error && error.error.message) {
              errorMessage = error.error.message;
            }
            this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
          },
        });
      }
    });
  }

  /**
   * Reschedules an appointment.
   */
  rescheduleAppointment(appointment: Appointment): void {
    let errorMessage = '';
    if (!appointment.id) {
      errorMessage = 'ID du rendez-vous manquant.';
    } else if (!appointment.medecin?.id) {
      errorMessage = 'ID du médecin manquant.';
    } else if (!appointment.medecin?.user?.id) {
      errorMessage = 'ID utilisateur du médecin manquant.';
    } else if (!appointment.medecin?.user?.nom) {
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

    const dialogData: RescheduleDialogData = {
      appointmentId: appointment.id!,
      patientName: this.getPatientFullName(appointment),
      doctorName: this.getDoctorFullName(appointment),
      currentDate: this.formatDateTime(appointment.date_heure),
      doctorMedecinId: appointment.medecin!.id,
      doctorUserId: appointment.medecin!.user!.id as number,
    };

    const dialogRef = this.dialog.open(RescheduleAppointmentDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: RescheduleDialogResult | undefined) => {
      if (result?.confirmed && result.newDateHeure && result.reason) {
        const reschedulePayload = {
          new_date_heure: result.newDateHeure,
          reschedule_reason: result.reason,
          patient_id: appointment.patient_id,
          medecin_id: appointment.medecin_id,
          motif: appointment.motif,
          tarif: appointment.tarif !== undefined ? appointment.tarif : 0,
        };

        this.apiService.rescheduleAppointment(appointment.id!, reschedulePayload).subscribe({
          next: () => {
            this.snackBar.open('Rendez-vous reporté avec succès.', 'Fermer', { duration: 3000 });
            this.loadAllData();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open('Erreur lors du report du rendez-vous.', 'Fermer', { duration: 3000 });
          },
        });
      }
    });
  }

  /**
   * Opens the modal to create a new appointment.
   */
  openCreateAppointmentDialog(): void {
    const dialogData: AppointmentDialogData = {
      patients: this.patients,
      doctors: this.doctors,
    };

    const dialogRef = this.dialog.open(AppointmentDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: AppointmentDialogResult) => {
      if (result?.confirmed && result.appointmentData) {
        this.apiService.createAppointment(result.appointmentData as Omit<Appointment, 'id' | 'statut'>).subscribe({
          next: () => {
            this.snackBar.open('Rendez-vous créé avec succès.', 'Fermer', { duration: 3000 });
            this.loadAllData();
          },
          error: (error: HttpErrorResponse) => {
            let errorMessage = 'Erreur lors de la création du rendez-vous.';
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
          },
        });
      }
    });
  }
}