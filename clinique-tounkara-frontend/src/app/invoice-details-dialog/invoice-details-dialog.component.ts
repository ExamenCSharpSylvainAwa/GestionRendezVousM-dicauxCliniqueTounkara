
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { Facture } from '../services/api.service';

@Component({
  selector: 'app-invoice-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule
  ],
  templateUrl: './invoice-details-dialog.component.html',
  styleUrls: ['./invoice-details-dialog.component.scss']
})
export class InvoiceDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<InvoiceDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public invoice: Facture
  ) {}

  getStatusColor(status: string): string {
    switch (status) {
      case 'payee': return 'primary';
      case 'envoyee': return 'accent';
      case 'brouillon': return 'warn';
      case 'annulee': return 'warn';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'payee': return 'Payée';
      case 'envoyee': return 'Envoyée';
      case 'brouillon': return 'Brouillon';
      case 'annulee': return 'Annulée';
      default: return status;
    }
  }

  getPatientName(): string {
    try {
      const patient = this.invoice.paiement?.rendez_vous?.patient?.user;
      return patient ? `${patient.nom ?? ''} ${patient.prenom ?? ''}`.trim() : 'N/A';
    } catch (error) {
      console.error('Erreur lors de l\'extraction du nom patient:', error);
      return 'N/A';
    }
  }

  getMedecinName(): string {
    try {
      const medecin = this.invoice.paiement?.rendez_vous?.medecin;
      return medecin?.user ? `Dr. ${medecin.user.nom ?? ''} ${medecin.user.prenom ?? ''}`.trim() : 'N/A';
    } catch (error) {
      console.error('Erreur lors de l\'extraction du nom médecin:', error);
      return 'N/A';
    }
  }

  getMedecinSpecialite(): string {
    try {
      return this.invoice.paiement?.rendez_vous?.medecin?.specialite ?? 'N/A';
    } catch (error) {
      console.error('Erreur lors de l\'extraction de la spécialité:', error);
      return 'N/A';
    }
  }

  getFormattedAmount(amount: any): number {
    if (typeof amount === 'string') {
      return parseFloat(amount.replace(/[^\d.-]/g, '')) || 0;
    }
    return Number(amount) || 0;
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
