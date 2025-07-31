import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-statistics-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
  ],
  templateUrl: './statistics-dialog.component.html',
  styleUrls: ['./statistics-dialog.component.scss']
})
export class StatisticsDialogComponent implements OnInit {
  statistics: any;
  reportTitle: string;
  reportType: string;
  period: string;
  startDate?: string;
  endDate?: string;

  constructor(
    public dialogRef: MatDialogRef<StatisticsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.statistics = data.statistics;
    this.reportTitle = data.reportTitle;
    this.reportType = data.reportType;
    this.period = data.period;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
  }

  ngOnInit(): void {
    // console.log('Statistiques reçues dans le dialogue:', this.statistics);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  // Formater les statuts pour une meilleure lisibilité
  formatStatus(status: string, type: 'rendezvous' | 'paiements'): string {
    const rendezVousStatusMap: { [key: string]: string } = {
      'en_attente': 'En attente',
      'confirme': 'Confirmé',
      'annule': 'Annulé',
      'termine': 'Terminé'
    };
    const paiementStatusMap: { [key: string]: string } = {
      'en_attente': 'En attente',
      'paye': 'Payé',
      'annule': 'Annulé'
    };
    return type === 'rendezvous' ? rendezVousStatusMap[status] || status : paiementStatusMap[status] || status;
  }

  // Helper pour afficher les objets simples de manière lisible
  getPlainObjectKeys(obj: any): string[] {
    return Object.keys(obj || {}).filter(key => typeof obj[key] !== 'object');
  }

  // Helper pour afficher les objets imbriqués
  getNestedObjectKeys(obj: any): string[] {
    return Object.keys(obj || {}).filter(key => typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]));
  }
}