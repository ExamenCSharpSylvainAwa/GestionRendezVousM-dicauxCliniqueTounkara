import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { ApiService, MedicalRecord, ApiError } from '../services/api.service';

@Component({
  selector: 'app-medical-records-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatIconModule
  ],
  templateUrl: './medical-records-view.component.html',
  styleUrls: ['./medical-records-view.component.scss'],
  providers: [DatePipe]
})
export class MedicalRecordsViewComponent implements OnInit {
  dossierMedical: MedicalRecord | null = null;
  isLoading: boolean = false;

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.loadMedicalRecord();
  }

  /**
   * Charge le dossier médical avec logs détaillés pour le debug
   */
  loadMedicalRecord(): void {
    this.isLoading = true;
    
    this.apiService.getMyMedicalRecord().subscribe({
      next: (data: MedicalRecord) => {
        console.log('=== DONNEES REÇUES DU SERVEUR ===');
        console.log('Données complètes:', data);
        
        if (data.consultations) {
          console.log('=== ANALYSE DES CONSULTATIONS ===');
          data.consultations.forEach((consultation, index) => {
            console.log(`Consultation ${index + 1}:`, {
              id: consultation.id,
              date: consultation.date,
              diagnostic: consultation.diagnostic,
              prescriptions_raw: consultation.prescriptions,
              prescriptions_type: typeof consultation.prescriptions,
              prescriptions_is_array: Array.isArray(consultation.prescriptions),
              prescriptions_length: consultation.prescriptions?.length
            });

            // Test de la méthode getPrescriptions
            const parsedPrescriptions = this.getPrescriptions(consultation);
            console.log(`Prescriptions parsées pour consultation ${index + 1}:`, parsedPrescriptions);
          });
        }
        
        this.dossierMedical = data;
        this.isLoading = false;
      },
      error: (error: ApiError) => {
        console.error('Erreur lors du chargement du dossier médical:', error);
        this.isLoading = false;
        this.snackBar.open(error.message || 'Erreur lors du chargement du dossier médical', 'Fermer', { 
          duration: 5000 
        });
      }
    });
  }

  /**
   * Vérifie si une consultation a des prescriptions
   */
  hasPrescriptions(consultation: any): boolean {
    const prescriptions = this.getPrescriptions(consultation);
    return prescriptions && prescriptions.length > 0;
  }

  /**
   * Récupère les prescriptions d'une consultation avec gestion robuste des différents formats
   */
  getPrescriptions(consultation: any): any[] {
    if (!consultation || !consultation.prescriptions) {
      return [];
    }

    const prescriptions = consultation.prescriptions;

    // Si c'est déjà un array
    if (Array.isArray(prescriptions)) {
      return prescriptions;
    }

    // Si c'est une string JSON
    if (typeof prescriptions === 'string') {
      try {
        const parsed = JSON.parse(prescriptions);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Erreur lors du parsing des prescriptions JSON:', e);
        return [];
      }
    }

    // Si c'est un objet unique
    if (typeof prescriptions === 'object' && prescriptions !== null) {
      return [prescriptions];
    }

    return [];
  }

  /**
   * Méthode pour vérifier le type d'une variable (utile pour le debug)
   */
  getType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Vérifier si une valeur est un array
   */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  /**
   * Vérifier si une valeur est une string
   */
  isString(value: any): boolean {
    return typeof value === 'string';
  }

  /**
   * Méthode utilitaire pour afficher les informations de debug dans la console
   */
  debugPrescriptions(consultation: any): void {
    console.log('=== DEBUG PRESCRIPTION ===');
    console.log('Consultation:', consultation);
    console.log('Prescriptions brutes:', consultation.prescriptions);
    console.log('Type:', typeof consultation.prescriptions);
    console.log('Est array:', Array.isArray(consultation.prescriptions));
    console.log('Prescriptions parsées:', this.getPrescriptions(consultation));
  }

  /**
   * Formate une date pour l'affichage
   */
  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd/MM/yyyy') || dateString;
  }

  /**
   * Vérifie si les médicaments existent et ont au moins un élément
   */
  hasMedicaments(prescription: any): boolean {
    return prescription?.medicaments && Array.isArray(prescription.medicaments) && prescription.medicaments.length > 0;
  }

  /**
   * Récupère les médicaments d'une prescription de manière sécurisée
   */
  getMedicaments(prescription: any): any[] {
    if (!prescription?.medicaments) {
      return [];
    }

    if (Array.isArray(prescription.medicaments)) {
      return prescription.medicaments;
    }

    // Si les médicaments sont stockés comme string JSON
    if (typeof prescription.medicaments === 'string') {
      try {
        const parsed = JSON.parse(prescription.medicaments);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Erreur lors du parsing des médicaments JSON:', e);
        return [];
      }
    }

    // Si c'est un objet unique
    if (typeof prescription.medicaments === 'object' && prescription.medicaments !== null) {
      return [prescription.medicaments];
    }

    return [];
  }
}