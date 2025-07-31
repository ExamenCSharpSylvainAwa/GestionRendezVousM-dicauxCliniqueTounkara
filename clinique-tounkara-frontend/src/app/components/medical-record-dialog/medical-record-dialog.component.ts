import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Patient } from '../../services/api.service';

@Component({
  selector: 'app-medical-record-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatDialogModule,
  ],
  templateUrl: './medical-record-dialog.component.html',
  styleUrls: ['./medical-record-dialog.component.scss'],
})
export class MedicalRecordDialogComponent {
  selectedPatientId: number | null = null;
  isLoading = false;

  constructor(
    public dialogRef: MatDialogRef<MedicalRecordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { patients: Patient[] }
  ) {}

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
    if (!this.selectedPatientId) {
      console.log('No patient selected');
      return;
    }

    this.isLoading = true;
    // Simuler une requête API (remplacer par votre service API)
    setTimeout(() => {
      console.log('Submitting medical record for patient ID:', this.selectedPatientId);
      this.dialogRef.close({ patient_id: this.selectedPatientId });
      this.isLoading = false;
    }, 1000); // Simulation d'un délai réseau
  }
}