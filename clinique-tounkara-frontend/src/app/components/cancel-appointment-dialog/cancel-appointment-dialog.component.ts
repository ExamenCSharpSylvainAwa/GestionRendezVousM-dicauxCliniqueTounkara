import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon'; // Import MatIconModule

export interface CancelDialogData {
  appointmentId: number;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
}

export interface CancelDialogResult {
  confirmed: boolean;
  appointmentId: number;
  reason: string;
}

@Component({
  selector: 'app-cancel-appointment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatIconModule // Add MatIconModule here
  ],
  template: `
    <div class="cancel-dialog">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>warning</mat-icon>
        Annuler le rendez-vous
      </h2>
      
      <mat-dialog-content class="dialog-content">
        <div class="appointment-info">
          <p><strong>Patient :</strong> {{ data.patientName }}</p>
          <p><strong>Médecin :</strong> {{ data.doctorName }}</p>
          <p><strong>Date :</strong> {{ data.appointmentDate }}</p>
        </div>
        
        <p class="confirmation-message">
          Êtes-vous sûr de vouloir <strong>annuler</strong> ce rendez-vous ?
        </p>
        
        <mat-form-field appearance="outline" class="cancel-reason-field">
          <mat-label>Motif d'annulation *</mat-label>
          <textarea 
            matInput 
            [(ngModel)]="cancellationReason" 
            placeholder="Veuillez indiquer la raison de l'annulation..."
            rows="3"
            required>
          </textarea>
          <mat-hint>Ce champ est obligatoire</mat-hint>
          <mat-error *ngIf="!cancellationReason.trim()">La raison est obligatoire.</mat-error>
        </mat-form-field>
        
        <p class="warning-text">
          ⚠️ Cette action est irréversible.
        </p>
      </mat-dialog-content>
      
      <mat-dialog-actions class="dialog-actions">
        <button 
          mat-button 
          (click)="onCancel()"
          class="cancel-button">
          <mat-icon>close</mat-icon>
          Retour
        </button>
        <button 
          mat-raised-button 
          color="warn" 
          (click)="onConfirm()"
          [disabled]="!cancellationReason.trim()"
          class="confirm-button">
          <mat-icon>cancel</mat-icon>
          Annuler le RDV
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .cancel-dialog {
      min-width: 400px;
      font-family: 'Inter', sans-serif;
    }
    
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336; /* Rouge pour le titre d'avertissement */
      font-weight: 600;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    }

    .dialog-title mat-icon {
      color: #f44336;
      font-size: 24px;
    }

    .dialog-content {
      padding-top: 20px;
      padding-bottom: 20px;
    }

    .appointment-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      border: 1px solid #e0e0e0;
    }
    
    .appointment-info p {
      margin: 4px 0;
      font-size: 14px;
      color: #333;
    }
    
    .confirmation-message {
      font-size: 16px;
      margin-bottom: 16px;
      color: #555;
    }

    .confirmation-message strong {
      color: #f44336;
    }

    .cancel-reason-field {
      width: 100%;
    }

    .warning-text {
      color: #f44336;
      font-size: 14px;
      margin: 16px 0;
      font-weight: 500;
    }
    
    .dialog-actions {
      padding: 16px 0;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .cancel-button {
      color: #666;
      &:hover {
        background-color: #f0f0f0;
      }
    }

    .confirm-button {
      background-color: #f44336;
      color: #fff;
      &:hover {
        background-color: #d32f2f;
      }
    }

    .confirm-button mat-icon, .cancel-button mat-icon {
      margin-right: 4px;
    }
  `]
})
export class CancelAppointmentDialogComponent {
  cancellationReason: string = '';

  constructor(
    public dialogRef: MatDialogRef<CancelAppointmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CancelDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  onConfirm(): void {
    if (this.cancellationReason.trim()) {
      this.dialogRef.close({
        confirmed: true,
        appointmentId: this.data.appointmentId,
        reason: this.cancellationReason.trim()
      } as CancelDialogResult);
    }
  }
}
