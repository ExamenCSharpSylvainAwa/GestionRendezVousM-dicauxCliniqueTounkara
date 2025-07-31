import { Component, OnInit } from '@angular/core';
import { ApiService, MedicalRecord, PaginatedResponse, Patient } from '../../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicalRecordDialogComponent } from '../medical-record-dialog/medical-record-dialog.component';

@Component({
  selector: 'app-medical-records',
  standalone: true,
  imports: [
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatFormFieldModule,  // ✅ Module complet au lieu des composants individuels
    MatInputModule,      // ✅ Nécessaire pour les inputs dans mat-form-field
    DatePipe,
    FormsModule
  ],
  templateUrl: './medical-records.component.html',
  styleUrls: ['./medical-records.component.scss']
})
export class MedicalRecordsComponent implements OnInit {
  records: MedicalRecord[] = [];
  filteredRecords: MedicalRecord[] = [];
  patients: Patient[] = [];
  searchText: string = '';

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadMedicalRecords();
    this.loadPatients();
  }

  loadMedicalRecords() {
    this.apiService.getMedicalRecords().subscribe({
      next: (response: PaginatedResponse<MedicalRecord>) => {
        this.records = response.data;
        this.filteredRecords = [...this.records];
        const recordsWithoutPatient = this.records.filter(r => !r.patient);
        if (recordsWithoutPatient.length > 0) {
          console.warn('Certains dossiers n\'ont pas la relation patient chargée:', recordsWithoutPatient);
        }
      },
      error: (error) => {
        this.snackBar.open('Erreur lors du chargement des dossiers médicaux', 'Fermer', { duration: 3000 });
        console.error('Erreur lors du chargement des dossiers médicaux', error);
      }
    });
  }

  clearSearch() {
    this.searchText = '';
    this.filterRecords();
  }

  loadPatients() {
    this.apiService.getPatients().subscribe({
      next: (response: PaginatedResponse<Patient>) => {
        this.patients = response.data.filter(patient => patient.user?.role === 'patient');
        console.log('Patients avec rôle "patient" chargés:', this.patients);
      },
      error: (error) => {
        this.snackBar.open('Erreur lors du chargement des patients', 'Fermer', { duration: 3000 });
        console.error('Erreur lors du chargement des patients', error);
      }
    });
  }

  getPatientName(record: MedicalRecord): string {
    if (record.patient?.user) {
      return `${record.patient.user.nom} ${record.patient.user.prenom}`;
    }

    const patient = this.patients.find(p => p.id === record.patient_id);
    if (patient?.user) {
      return `${patient.user.nom} ${patient.user.prenom}`;
    }

    return `Patient inconnu (ID: ${record.patient_id})`;
  }

  filterRecords() {
    const search = this.searchText.toLowerCase().trim();
    this.filteredRecords = this.records.filter(record => {
      const name = this.getPatientName(record).toLowerCase();
      return name.includes(search);
    });
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(MedicalRecordDialogComponent, {
      width: '400px',
      data: { patients: this.patients }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        const patientId = result.patientId;
        const existingRecord = this.records.find(r => r.patient_id === patientId);

        if (existingRecord) {
          this.snackBar.open('Ce patient a déjà un dossier médical.', 'Fermer', {
            duration: 4000
          });
          return;
        }

        const medicalRecordData = {
          patient_id: patientId,
          date_creation: new Date().toISOString().split('T')[0]
        };

        this.apiService.createMedicalRecord(medicalRecordData).subscribe({
          next: () => {
            this.loadMedicalRecords();
            this.snackBar.open('Dossier médical créé avec succès', 'Fermer', { duration: 3000 });
          },
          error: (error) => {
            this.snackBar.open('Erreur lors de la création du dossier médical', 'Fermer', { duration: 3000 });
            console.error('Erreur lors de la création du dossier médical', error);
          }
        });
      }
    });
  }

  deleteRecord(recordId: number) {
    this.apiService.deleteMedicalRecord(recordId).subscribe({
      next: () => {
        this.records = this.records.filter(record => record.id !== recordId);
        this.filterRecords();
        this.snackBar.open('Dossier médical supprimé avec succès', 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        this.snackBar.open('Erreur lors de la suppression du dossier médical', 'Fermer', { duration: 3000 });
        console.error('Erreur lors de la suppression du dossier médical', error);
      }
    });
  }
}