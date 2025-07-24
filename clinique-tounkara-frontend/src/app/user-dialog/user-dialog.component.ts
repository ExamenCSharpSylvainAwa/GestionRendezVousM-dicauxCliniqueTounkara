// src/app/user-dialog/user-dialog.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_LOCALE, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UserFormData } from '../services/api.service';

// Custom date formats for Angular Material
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatSlideToggleModule
  ],
  templateUrl: './user-dialog.component.html',
  styleUrls: ['./user-dialog.component.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: DateAdapter, useClass: NativeDateAdapter }
  ]
})
export class UserDialogComponent implements OnInit {
  user: Partial<UserFormData>;
  isEditMode: boolean;
  hidePassword = true;
  
  // Roles correspondant à votre enum Laravel - SUPPRESSION des rôles personnel et administrateur
  roles: Array<{value: string, label: string}> = [
    { value: 'patient', label: 'Patient' },
    { value: 'medecin', label: 'Médecin' }
  ];

  // Champs pour le datepicker (patient spécifique)
  dateNaissance: Date | null = null;
  adresse: string = '';

  // Options pour les nouveaux champs patient
  sexeOptions: Array<{value: string, label: string}> = [
    { value: 'M', label: 'Masculin' },
    { value: 'F', label: 'Féminin' },
    { value: 'Autre', label: 'Autre' }
  ];

  groupesSanguins: string[] = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  ];

  // Liste des spécialités médicales
  specialties: string[] = [
    'Cardiologie', 'Dermatologie', 'Médecine Générale', 'Gynécologie', 'Pédiatrie',
    'Ophtalmologie', 'Orthopédie', 'ORL', 'Neurologie', 'Psychiatrie', 'Radiologie', 
    'Urologie', 'Gastro-entérologie', 'Endocrinologie', 'Pneumologie', 'Rhumatologie', 
    'Anesthésiologie', 'Chirurgie Générale', 'Néphrologie', 'Oncologie', 'Infectiologie'
  ];

  constructor(
    public dialogRef: MatDialogRef<UserDialogComponent, UserFormData>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<UserFormData>,
    private dateAdapter: DateAdapter<Date>
  ) {
    this.dateAdapter.setLocale('fr-FR');
    this.user = { ...data };

    // Initialisation des champs spéciaux
    if (this.user.date_naissance) {
      this.dateNaissance = new Date(this.user.date_naissance);
    }
    this.adresse = this.user.adresse || '';

    this.isEditMode = !!data.id;

    // Ajouter une spécialité personnalisée si elle n'existe pas dans la liste
    if (this.isEditMode && this.user.role === 'medecin' && this.user.specialite && 
        !this.specialties.includes(this.user.specialite)) {
      this.specialties.push(this.user.specialite);
    }
  }

  ngOnInit(): void {
    // Valeurs par défaut pour un nouvel utilisateur
    if (!this.isEditMode) {
      if (!this.user.role) {
        this.user.role = 'patient';
      }
      if (this.user.actif === undefined) {
        this.user.actif = true;
      }
    }
  }

  onRoleChange(): void {
    console.log('Changement de rôle vers:', this.user.role);
    
    // Nettoyer les champs qui ne correspondent pas au nouveau rôle
    if (this.user.role !== 'patient') {
      this.dateNaissance = null;
      this.adresse = '';
      delete this.user.date_naissance;
      delete this.user.adresse;
      delete this.user.numero_assurance;
      delete this.user.sexe;
      delete this.user.groupe_sanguin;
    } else {
      this.adresse = this.user.adresse || '';
    }

    if (this.user.role !== 'medecin') {
      delete this.user.specialite;
      delete this.user.numero_ordre;
      delete this.user.tarif_consultation;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    // Validation des champs obligatoires de base (table users)
    if (!this.user.prenom?.trim()) {
      this.showError('Le prénom est obligatoire.');
      return;
    }

    if (!this.user.nom?.trim()) {
      this.showError('Le nom est obligatoire.');
      return;
    }

    if (!this.user.email?.trim()) {
      this.showError('L\'email est obligatoire.');
      return;
    }

    if (!this.isValidEmail(this.user.email)) {
      this.showError('Format d\'email invalide.');
      return;
    }

    if (!this.user.role) {
      this.showError('Le rôle est obligatoire.');
      return;
    }

    // Mot de passe obligatoire seulement à la création
    if (!this.isEditMode && !this.user.password?.trim()) {
      this.showError('Le mot de passe est obligatoire pour la création.');
      return;
    }

    if (!this.isEditMode && this.user.password && this.user.password.length < 8) {
      this.showError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    // Validation spécifique selon le rôle
    if (!this.validateRoleSpecificFields()) {
      return;
    }

    // Préparer les données avant fermeture
    this.prepareDataForSubmission();

    console.log('Données du formulaire validées:', this.user);
    this.dialogRef.close(this.user as UserFormData);
  }

  private validateRoleSpecificFields(): boolean {
    switch (this.user.role) {
      case 'patient':
        if (!this.dateNaissance) {
          this.showError('La date de naissance est obligatoire pour un patient.');
          return false;
        }
        if (!this.adresse?.trim()) {
          this.showError('L\'adresse est obligatoire pour un patient.');
          return false;
        }
        if (!this.user.sexe) {
          this.showError('Le sexe est obligatoire pour un patient.');
          return false;
        }
        break;

      case 'medecin':
        if (!this.user.specialite?.trim()) {
          this.showError('La spécialité est obligatoire pour un médecin.');
          return false;
        }
        if (!this.user.numero_ordre?.trim()) {
          this.showError('Le numéro d\'ordre est obligatoire pour un médecin.');
          return false;
        }
        
        // Validation et conversion du tarif de consultation
        const tarif = Number(this.user.tarif_consultation);
        if (isNaN(tarif) || tarif <= 0) {
          this.showError('Le tarif de consultation est obligatoire et doit être un nombre positif.');
          return false;
        }
        
        // S'assurer que c'est bien un nombre
        this.user.tarif_consultation = tarif;
        break;
    }
    return true;
  }

  private prepareDataForSubmission(): void {
    // Nettoyer les champs selon le rôle
    if (this.user.role === 'patient') {
      // Convertir la date en format YYYY-MM-DD
      if (this.dateNaissance) {
        this.user.date_naissance = this.dateNaissance.toISOString().split('T')[0];
      }
      this.user.adresse = this.adresse?.trim();
      
      // Supprimer les champs non pertinents
      delete this.user.specialite;
      delete this.user.numero_ordre;
      delete this.user.tarif_consultation;
      delete this.user.medecin; // Supprimer l'objet medecin pour les patients
    } 
    else if (this.user.role === 'medecin') {
      // S'assurer que le tarif est un nombre et ne pas le supprimer
      if (this.user.tarif_consultation !== undefined && this.user.tarif_consultation !== null) {
        this.user.tarif_consultation = Number(this.user.tarif_consultation);
        // Valider que c'est toujours un nombre valide après conversion
        if (isNaN(this.user.tarif_consultation) || this.user.tarif_consultation <= 0) {
          this.user.tarif_consultation = 0; // Valeur par défaut de sécurité
        }
      } else {
        this.user.tarif_consultation = 0; // Valeur par défaut
      }
      
      // Construire correctement l'objet medecin avec les valeurs du niveau racine
      this.user.medecin = {
        specialite: this.user.specialite?.trim() || '',
        numero_ordre: this.user.numero_ordre?.trim() || '',
        tarif_consultation: this.user.tarif_consultation,
        horaire_consultation: { lundi: { debut: '09:00', fin: '17:00' } }, // Valeur par défaut
        disponible: true
      };
      
      // Supprimer les champs non pertinents
      delete this.user.date_naissance;
      delete this.user.adresse;
      delete this.user.numero_assurance;
      delete this.user.sexe;
      delete this.user.groupe_sanguin;
    }

    // Nettoyer les champs vides MAIS NE PAS SUPPRIMER tarif_consultation même s'il est 0
    Object.keys(this.user).forEach(key => {
      const value = (this.user as any)[key];
      if (key !== 'tarif_consultation' && key !== 'actif' && key !== 'medecin') {
        if (value === '' || value === null || value === undefined) {
          delete (this.user as any)[key];
        }
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showError(message: string): void {
    alert(message); // Vous pouvez remplacer par un toast/snackbar plus élégant
  }

  // Filtre pour les dates (pas de dates futures pour la date de naissance)
  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Inclure aujourd'hui
    return d.getTime() <= today.getTime();
  };

  // Méthode pour gérer les erreurs de saisie numérique
  onNumberInput(event: any, field: 'tarif_consultation'): void {
    const value = event.target.value;
    const numValue = Number(value);
    
    if (value === '' || value === null) {
      (this.user as any)[field] = 0;
    } else if (!isNaN(numValue) && numValue >= 0) {
      (this.user as any)[field] = numValue;
    } else {
      // Revenir à la valeur précédente ou valeur par défaut
      event.target.value = (this.user as any)[field] || 0;
    }
  }
}