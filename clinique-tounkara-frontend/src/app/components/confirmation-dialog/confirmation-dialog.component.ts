import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon'; // Pour l'icône d'avertissement
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CommonModule],
  template: `
    <div class="confirmation-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2 mat-dialog-title>Confirmation de suppression</h2>
      </div>
      <mat-dialog-content class="dialog-content">
        <p>Êtes-vous sûr de vouloir supprimer <strong>{{ data.message.split(' ')[1] }} {{ data.message.split(' ')[2] }}</strong> ?</p>
        <p>Cette action est irréversible et supprimera toutes les données associées.</p>
      </mat-dialog-content>
      <mat-dialog-actions class="dialog-actions" align="end">
        <button mat-button (click)="onCancel()" class="cancel-button">Annuler</button>
        <button mat-raised-button color="warn" (click)="onConfirm()" cdkFocusInitial class="confirm-button">Oui, supprimer</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirmation-dialog {
      display: flex;
      flex-direction: column;
      min-width: 350px;
      padding: 20px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }

    .warning-icon {
      color: #f44336;
      font-size: 24px;
      margin-right: 10px;
    }

    .dialog-content {
      color: #666;
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .dialog-content strong {
      color: #333;
    }

    .dialog-actions {
      padding: 0;
    }

    .cancel-button {
      margin-right: 10px;
      color: #666;
    }

    .confirm-button {
      background-color: #f44336;
      color: white;
    }

    .confirm-button:hover {
      background-color: #d32f2f;
    }
  `]
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string; confirmText: string; cancelText: string }
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}