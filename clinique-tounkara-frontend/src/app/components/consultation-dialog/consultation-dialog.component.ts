import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MedicalRecord, Consultation } from '../../services/api.service';

@Component({
  selector: 'app-consultation-dialog',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    MatDialogModule
  ],
  templateUrl: './consultation-dialog.component.html',
  styleUrls: ['./consultation-dialog.component.scss']
})
export class ConsultationDialogComponent {
  consultation: Partial<Consultation> = {
    dossier_medical_id: undefined,
    date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
    symptomes: '',
    diagnostic: '',
    recommandations: '',
    notes: ''
  };

  constructor(
    public dialogRef: MatDialogRef<ConsultationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { medicalRecords: MedicalRecord[], consultation?: Consultation }
  ) {
    if (data.consultation) {
      // Formater la date pour garantir le format YYYY-MM-DD
      const date = new Date(data.consultation.date);
      this.consultation = {
        ...data.consultation,
        date: isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0]
      };
      console.log('Consultation loaded for edit:', this.consultation);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.consultation.dossier_medical_id && this.consultation.date && this.consultation.symptomes && this.consultation.diagnostic) {
      console.log('Submitting consultation:', this.consultation);
      this.dialogRef.close(this.consultation);
    } else {
      console.log('Form invalid:', this.consultation);
    }
  }
}