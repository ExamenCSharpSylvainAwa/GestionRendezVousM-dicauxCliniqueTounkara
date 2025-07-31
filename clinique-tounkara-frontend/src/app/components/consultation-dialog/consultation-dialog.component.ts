import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MedicalRecord, Consultation } from '../../services/api.service';

@Component({
  selector: 'app-consultation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
  ],
  templateUrl: './consultation-dialog.component.html',
  styleUrls: ['./consultation-dialog.component.scss'],
})
export class ConsultationDialogComponent {
  consultation: Partial<Consultation> = {
    dossier_medical_id: undefined,
    date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
    symptomes: '',
    diagnostic: '',
    recommandations: '',
    notes: '',
  };
  isLoading = false;

  constructor(
    public dialogRef: MatDialogRef<ConsultationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { medicalRecords: MedicalRecord[]; consultation?: Consultation }
  ) {
    if (this.data.consultation) {
      const date = new Date(this.data.consultation.date);
      this.consultation = {
        ...this.data.consultation,
        date: isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0],
      };
      console.log('Consultation loaded for edit:', this.consultation);
    }
  }

  /**
   * Validates the form fields.
   */
  isFormValid(): boolean {
    return !!(
      this.consultation.dossier_medical_id &&
      this.consultation.date &&
      this.consultation.symptomes?.trim() &&
      this.consultation.diagnostic?.trim()
    );
  }

  /**
   * Handles the cancel action.
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Handles the submit action.
   */
  onSubmit(): void {
    if (!this.isFormValid()) {
      console.log('Form invalid:', this.consultation);
      return;
    }

    this.isLoading = true;
    // Simuler une requête API (remplacer par votre service API)
    setTimeout(() => {
      console.log('Submitting consultation:', this.consultation);
      this.dialogRef.close(this.consultation);
      this.isLoading = false;
    }, 1000); // Simulation d'un délai réseau
  }
}