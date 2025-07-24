import { Component, OnInit } from '@angular/core';
import { ApiService, MedicalRecord, PaginatedResponse, Patient } from '../../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
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
    DatePipe
  ],
  templateUrl: './medical-records.component.html',
  styleUrls: ['./medical-records.component.scss']
})
export class MedicalRecordsComponent implements OnInit {
  records: MedicalRecord[] = [];
  patients: Patient[] = [];

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
        console.log('Medical records loaded:', response.data);
        this.records = response.data;
        
        // Vérifier si les relations patient sont bien chargées
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

  loadPatients() {
    this.apiService.getPatients().subscribe({
      next: (response: PaginatedResponse<Patient>) => {
        // Filtrer les patients avec le rôle "patient" uniquement
        this.patients = response.data.filter(patient => patient.user?.role === 'patient');
        console.log('Patients avec rôle "patient" chargés:', this.patients);
      },
      error: (error) => {
        this.snackBar.open('Erreur lors du chargement des patients', 'Fermer', { duration: 3000 });
        console.error('Erreur lors du chargement des patients', error);
      }
    });
  }

  // Méthode utilitaire pour obtenir le nom du patient
  getPatientName(record: MedicalRecord): string {
    if (record.patient?.user) {
      return `${record.patient.user.nom} ${record.patient.user.prenom}`;
    }
    
    // Fallback: chercher le patient dans la liste des patients chargés
    const patient = this.patients.find(p => p.id === record.patient_id);
    if (patient?.user) {
      return `${patient.user.nom} ${patient.user.prenom}`;
    }
    
    return `Patient inconnu (ID: ${record.patient_id})`;
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(MedicalRecordDialogComponent, {
      width: '400px',
      data: { patients: this.patients }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Ajouter date_creation avec la date actuelle au format ISO
        const medicalRecordData = {
          patient_id: result.patient_id,
          date_creation: new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
        };
        this.apiService.createMedicalRecord(medicalRecordData).subscribe({
          next: (newRecord: MedicalRecord) => {
            this.loadMedicalRecords(); // Recharger pour inclure les relations
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
        this.snackBar.open('Dossier médical supprimé avec succès', 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        this.snackBar.open('Erreur lors de la suppression du dossier médical', 'Fermer', { duration: 3000 });
        console.error('Erreur lors de la suppression du dossier médical', error);
      }
    });
  }
}