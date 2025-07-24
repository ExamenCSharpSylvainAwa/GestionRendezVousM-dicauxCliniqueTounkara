import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogActions, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Patient } from '../../services/api.service';
import { MatIcon } from "@angular/material/icon";

@Component({
  selector: 'app-medical-record-dialog',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    FormsModule,
    MatDialogModule
],
  templateUrl: './medical-record-dialog.component.html',
  styleUrls: ['./medical-record-dialog.component.scss']
})
export class MedicalRecordDialogComponent {
  selectedPatientId: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<MedicalRecordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { patients: Patient[] }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.selectedPatientId) {
      this.dialogRef.close({ patient_id: this.selectedPatientId });
    }
  }
}