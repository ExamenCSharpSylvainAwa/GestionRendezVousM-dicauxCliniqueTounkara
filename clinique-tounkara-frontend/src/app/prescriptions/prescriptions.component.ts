
import { Component, OnInit } from '@angular/core';
import { ApiService, Prescription, PaginatedResponse, Consultation, ApiError } from '../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PrescriptionDialogComponent } from '../components/prescription-dialog/prescription-dialog.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-prescriptions',
  standalone: true,
  imports: [
    MatCardModule,
    CommonModule,
    MatListModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './prescriptions.component.html',
  styleUrls: ['./prescriptions.component.scss'],
  providers: [DatePipe]
})
export class PrescriptionsComponent implements OnInit {
  prescriptions: Prescription[] = [];
  filteredPrescriptions: Prescription[] = [];
  consultations: Consultation[] = [];
  searchText: string = '';
  isLoading: boolean = false;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadPrescriptions();
    this.loadConsultations();
  }

  loadPrescriptions() {
    this.isLoading = true;
    this.apiService.getPrescriptions().subscribe({
      next: (response: PaginatedResponse<Prescription>) => {
        this.prescriptions = response.data;
        this.filteredPrescriptions = [...this.prescriptions]; // Initialiser la liste filtrée
        this.isLoading = false;
        console.log('Prescriptions loaded:', this.prescriptions);
      },
      error: (error: ApiError) => {
        this.isLoading = false;
        this.snackBar.open(error.message || 'Erreur lors du chargement des prescriptions', 'Fermer', { duration: 3000 });
        console.error('Erreur lors du chargement des prescriptions', error);
      }
    });
  }

  async loadConsultations() {
    try {
      const response = await firstValueFrom(this.apiService.getConsultations());
      this.consultations = response.data;
      console.log('Consultations loaded:', this.consultations);
      this.consultations.forEach(consultation => {
        console.log('Consultation:', consultation.id, 'Dossier:', consultation.dossier_medical);
      });
    } catch (error: any) {
      this.snackBar.open(error.message || 'Erreur lors du chargement des consultations', 'Fermer', { duration: 3000 });
      console.error('Erreur lors du chargement des consultations', error);
    }
  }

  filterPrescriptions() {
    const search = this.searchText.toLowerCase().trim();
    this.filteredPrescriptions = this.prescriptions.filter(prescription => {
      const name = this.getPatientName(prescription).toLowerCase();
      return name.includes(search);
    });
  }

  clearSearch() {
    this.searchText = '';
    this.filterPrescriptions();
  }

  async openCreateDialog() {
    if (!this.consultations.length) {
      await this.loadConsultations();
      if (!this.consultations.length) {
        this.snackBar.open('Aucune consultation disponible', 'Fermer', { duration: 3000 });
        return;
      }
    }
    const dialogRef = this.dialog.open(PrescriptionDialogComponent, {
      width: '600px',
      data: { consultations: this.consultations }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const prescriptionData = this.sanitizePrescriptionData(result);
        console.log('Submitting prescription (sanitized):', prescriptionData);
        
        this.apiService.createPrescription(prescriptionData).subscribe({
          next: (newPrescription: Prescription) => {
            this.loadPrescriptions();
            this.snackBar.open('Prescription créée avec succès', 'Fermer', { duration: 3000 });
          },
          error: (error: ApiError) => {
            console.error('Erreur complète:', error);
            let errorMessage = 'Erreur lors de la création de la prescription';
            
            if (error.errors) {
              const validationErrors = Object.values(error.errors).flat();
              errorMessage = validationErrors.join(', ');
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            this.snackBar.open(errorMessage, 'Fermer', { duration: 5000 });
            console.error('Erreur lors de la création de la prescription', error);
          }
        });
      }
    });
  }

  async openEditDialog(prescription: Prescription) {
    if (!this.consultations.length) {
      await this.loadConsultations();
      if (!this.consultations.length) {
        this.snackBar.open('Aucune consultation disponible', 'Fermer', { duration: 3000 });
        return;
      }
    }
    const dialogRef = this.dialog.open(PrescriptionDialogComponent, {
      width: '600px',
      data: { consultations: this.consultations, prescription }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const prescriptionData = this.sanitizePrescriptionData(result);
        console.log('Updating prescription (sanitized):', prescriptionData);
        
        this.apiService.updatePrescription(prescription.id, prescriptionData).subscribe({
          next: (updatedPrescription: Prescription) => {
            this.loadPrescriptions();
            this.snackBar.open('Prescription mise à jour avec succès', 'Fermer', { duration: 3000 });
          },
          error: (error: ApiError) => {
            console.error('Erreur complète:', error);
            let errorMessage = 'Erreur lors de la mise à jour de la prescription';
            
            if (error.errors) {
              const validationErrors = Object.values(error.errors).flat();
              errorMessage = validationErrors.join(', ');
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            this.snackBar.open(errorMessage, 'Fermer', { duration: 5000 });
            console.error('Erreur lors de la mise à jour de la prescription', error);
          }
        });
      }
    });
  }

  private sanitizePrescriptionData(data: any): any {
    const sanitized = {
      consultation_id: parseInt(data.consultation_id, 10),
      date_emission: data.date_emission,
      date_expiration: data.date_expiration,
      description: data.description?.trim() || '',
      medicaments: []
    };

    if (data.medicaments && Array.isArray(data.medicaments)) {
      sanitized.medicaments = data.medicaments
        .filter((med: any) => med && med.nom && med.posologie && med.duree)
        .map((med: any) => ({
          nom: med.nom.trim(),
          posologie: med.posologie.trim(),
          duree: med.duree.trim(),
          instructions: med.instructions ? med.instructions.trim() : null
        }));
    }

    if (!sanitized.consultation_id || isNaN(sanitized.consultation_id)) {
      throw new Error('ID de consultation invalide');
    }

    if (!sanitized.date_emission || !sanitized.date_expiration) {
      throw new Error('Les dates sont requises');
    }

    if (!sanitized.description) {
      throw new Error('La description est requise');
    }

    if (!sanitized.medicaments.length) {
      throw new Error('Au moins un médicament valide est requis');
    }

    return sanitized;
  }

  deletePrescription(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette prescription ?')) {
      this.apiService.deletePrescription(id).subscribe({
        next: () => {
          this.prescriptions = this.prescriptions.filter(prescription => prescription.id !== id);
          this.filterPrescriptions(); // Mettre à jour la liste filtrée
          this.snackBar.open('Prescription supprimée avec succès', 'Fermer', { duration: 3000 });
        },
        error: (error: ApiError) => {
          console.error('Erreur complète:', error);
          let errorMessage = 'Erreur lors de la suppression de la prescription';
          
          if (error.message) {
            errorMessage = error.message;
          }
          
          this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
          console.error('Erreur lors de la suppression de la prescription', error);
        }
      });
    }
  }

  getPatientName(prescription: Prescription): string {
    if (prescription.consultation?.dossier_medical?.patient?.user?.nom && prescription.consultation?.dossier_medical?.patient?.user?.prenom) {
      return `${prescription.consultation.dossier_medical.patient.user.nom} ${prescription.consultation.dossier_medical.patient.user.prenom}`;
    }
    const consultation = this.consultations.find(c => c.id === prescription.consultation_id);
    if (consultation?.dossier_medical?.patient?.user?.nom && consultation?.dossier_medical?.patient?.user?.prenom) {
      return `${consultation.dossier_medical.patient.user.nom} ${consultation.dossier_medical.patient.user.prenom}`;
    }
    return `Patient inconnu (ID: ${prescription.consultation_id})`;
  }
}
