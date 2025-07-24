import { Component, OnInit } from '@angular/core';
import { ApiService, Consultation, PaginatedResponse, MedicalRecord } from '../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { ConsultationDialogComponent } from '../components/consultation-dialog/consultation-dialog.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-consultations',
  standalone: true,
  imports: [
    MatCardModule,
    CommonModule,
    MatListModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    DatePipe,
    MatProgressSpinnerModule
],
  templateUrl: './consultations.component.html',
  styleUrls: ['./consultations.component.scss']
})
export class ConsultationsComponent implements OnInit {
  consultations: Consultation[] = [];
  medicalRecords: MedicalRecord[] = [];
  isLoading: boolean = false;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadConsultations();
    this.loadMedicalRecords();
  }

  loadConsultations() {
    this.isLoading = true;
    this.apiService.getConsultations().subscribe({
      next: (response: PaginatedResponse<Consultation>) => {
        this.consultations = response.data;
        this.isLoading = false;
        console.log('Consultations loaded:', this.consultations);
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open('Erreur lors du chargement des consultations', 'Fermer', { duration: 3000 });
        console.error('Erreur lors du chargement des consultations', error);
      }
    });
  }

  loadMedicalRecords() {
    this.apiService.getMedicalRecords().subscribe({
      next: (response: PaginatedResponse<MedicalRecord>) => {
        this.medicalRecords = response.data.filter(record => record.patient?.user?.role === 'patient');
        console.log('Medical records loaded:', this.medicalRecords);
      },
      error: (error) => {
        this.snackBar.open('Erreur lors du chargement des dossiers médicaux', 'Fermer', { duration: 3000 });
        console.error('Erreur lors du chargement des dossiers médicaux', error);
      }
    });
  }

  getPatientName(consultation: Consultation): string {
    if (consultation.dossier_medical?.patient?.user?.nom && consultation.dossier_medical?.patient?.user?.prenom) {
      return `${consultation.dossier_medical.patient.user.nom} ${consultation.dossier_medical.patient.user.prenom}`;
    }
    const record = this.medicalRecords.find(r => r.id === consultation.dossier_medical_id);
    if (record?.patient?.user?.nom && record?.patient?.user?.prenom) {
      return `${record.patient.user.nom} ${record.patient.user.prenom}`;
    }
    return `Patient inconnu (ID: ${consultation.dossier_medical_id})`;
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(ConsultationDialogComponent, {
      width: '600px',
      data: { medicalRecords: this.medicalRecords }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.createConsultation(result).subscribe({
          next: (newConsultation: Consultation) => {
            this.loadConsultations();
            this.snackBar.open('Consultation créée avec succès', 'Fermer', { duration: 3000 });
          },
          error: (error) => {
            this.snackBar.open('Erreur lors de la création de la consultation', 'Fermer', { duration: 3000 });
            console.error('Erreur lors de la création de la consultation', error);
          }
        });
      }
    });
  }

  openEditDialog(consultation: Consultation) {
    const dialogRef = this.dialog.open(ConsultationDialogComponent, {
      width: '600px',
      data: { medicalRecords: this.medicalRecords, consultation }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.updateConsultation(consultation.id, result).subscribe({
          next: (updatedConsultation: Consultation) => {
            this.loadConsultations();
            this.snackBar.open('Consultation mise à jour avec succès', 'Fermer', { duration: 3000 });
          },
          error: (error) => {
            this.snackBar.open('Erreur lors de la mise à jour de la consultation', 'Fermer', { duration: 3000 });
            console.error('Erreur lors de la mise à jour de la consultation', error);
          }
        });
      }
    });
  }

  deleteConsultation(id: number) {
    this.apiService.deleteConsultation(id).subscribe({
      next: () => {
        this.consultations = this.consultations.filter(consultation => consultation.id !== id);
        this.snackBar.open('Consultation supprimée avec succès', 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        this.snackBar.open('Erreur lors de la suppression de la consultation', 'Fermer', { duration: 3000 });
        console.error('Erreur lors de la suppression de la consultation', error);
      }
    });
  }
}