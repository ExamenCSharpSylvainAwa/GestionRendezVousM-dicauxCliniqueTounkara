import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Prescription, Consultation } from '../../services/api.service';

@Component({
  selector: 'app-prescription-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    FormsModule,
  ],
  templateUrl: './prescription-dialog.component.html',
  styleUrls: ['./prescription-dialog.component.scss'],
  providers: [DatePipe],
})
export class PrescriptionDialogComponent {
  prescription: Partial<Prescription> = {
    consultation_id: undefined,
    date_emission: new Date().toISOString().split('T')[0],
    date_expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: '',
    medicaments: [],
  };
  newMedicament = { nom: '', posologie: '', duree: '', instructions: '' };
  isLoading = false;

  constructor(
    public dialogRef: MatDialogRef<PrescriptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { consultations: Consultation[]; prescription?: Prescription },
    private datePipe: DatePipe
  ) {
    if (this.data.prescription) {
      this.prescription = {
        ...this.data.prescription,
        date_emission: new Date(this.data.prescription.date_emission).toISOString().split('T')[0],
        date_expiration: new Date(this.data.prescription.date_expiration).toISOString().split('T')[0],
        medicaments: this.data.prescription.medicaments.map((m) => ({
          nom: m.nom,
          posologie: m.posologie,
          duree: m.duree,
          instructions: m.instructions,
        })),
      };
      console.log('Prescription loaded for edit:', this.prescription);
    }
    console.log('Consultations available:', this.data.consultations);
  }

  /**
   * Validates the medicament form.
   */
  isMedicamentValid(): boolean {
    return !!(this.newMedicament.nom?.trim() && this.newMedicament.posologie?.trim() && this.newMedicament.duree?.trim());
  }

  /**
   * Validates the entire prescription form.
   */
  isFormValid(): boolean {
    return !!(
      this.prescription.consultation_id &&
      this.prescription.date_emission &&
      this.prescription.date_expiration &&
      this.prescription.description?.trim() &&
      this.prescription.medicaments?.length
    );
  }

  /**
   * Adds a new medicament to the prescription.
   */
  addMedicament(): void {
    if (!this.isMedicamentValid()) {
      console.log('Invalid medicament data:', this.newMedicament);
      return;
    }
    this.prescription.medicaments = [...(this.prescription.medicaments || []), { ...this.newMedicament }];
    this.newMedicament = { nom: '', posologie: '', duree: '', instructions: '' };
  }

  /**
   * Removes a medicament from the prescription.
   */
  removeMedicament(index: number): void {
    this.prescription.medicaments = (this.prescription.medicaments || []).filter((_, i) => i !== index);
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
      console.log('Form invalid:', this.prescription);
      return;
    }
    this.isLoading = true;
    // Simulate API call (replace with your ApiService)
    setTimeout(() => {
      console.log('Submitting prescription:', this.prescription);
      this.dialogRef.close(this.prescription);
      this.isLoading = false;
    }, 1000); // Simulate network delay
  }
}