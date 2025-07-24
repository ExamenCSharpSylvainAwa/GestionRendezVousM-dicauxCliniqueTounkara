import { Component, OnInit, Inject } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule } from '@angular/common';
import { ApiService, Patient, User, ApiError } from '../services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmationDialogComponent } from '../components/confirmation-dialog/confirmation-dialog.component';
import { UserDialogComponent } from '../user-dialog/user-dialog.component';
import { UserFormData } from '../services/api.service';
@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class PatientsComponent implements OnInit {
  displayedColumns: string[] = ['prenom', 'nom', 'email', 'numero_assurance', 'adresse', 'date_naissance', 'sexe', 'actif', 'actions'];
  dataSource = new MatTableDataSource<Patient>([]);
  patients: Patient[] = [];

  constructor(
    public dialog: MatDialog,
    @Inject(ApiService) private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    console.log('PatientsComponent: Initialisation du composant.');
    this.loadPatients();
  }

  loadPatients(): void {
    console.log('PatientsComponent: Chargement des patients...');
    this.apiService.getPatients().subscribe({
      next: (response: { data: Patient[] }) => {
        console.log('PatientsComponent: Patients chargés avec succès:', response);
        // Filtrer les patients pour s'assurer que seuls ceux avec le rôle 'patient' sont affichés
        this.patients = (response.data || []).filter(patient => patient.user?.role === 'patient');
        this.dataSource.data = this.patients;
        console.log('PatientsComponent: dataSource.data:', this.dataSource.data);
      },
      error: (error: ApiError) => {
        console.error('PatientsComponent: Erreur lors du chargement des patients:', error);
        let errorMessage = 'Erreur lors du chargement des patients';
        if (error.type === 'HTTP_ERROR') {
          errorMessage = error.message || 'Erreur serveur lors du chargement des patients';
        }
        this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });

        // Données de secours pour le développement
        this.patients = ([
          {
            id: 1,
            user_id: 1,
            user: {
              id: 1,
              prenom: 'Jean',
              nom: 'Dupont',
              email: 'jean.dupont@example.com',
              role: 'patient',
              actif: true
            },
            numero_assurance: '123456789',
            adresse: '123 Rue Principale, Ville',
            date_naissance: '1980-01-01',
            sexe: 'M',
            groupe_sanguin: 'O+',
            antecedent_medicaux: 'Aucun'
          },
          {
            id: 2,
            user_id: 2,
            user: {
              id: 2,
              prenom: 'Marie',
              nom: 'Martin',
              email: 'marie.martin@example.com',
              role: 'patient',
              actif: true
            },
            numero_assurance: '987654321',
            adresse: '456 Avenue Secondaire, Ville',
            date_naissance: '1990-02-02',
            sexe: 'F',
            groupe_sanguin: 'A+',
            antecedent_medicaux: 'Allergie au pollen'
          }
        ] as Patient[]).filter(patient => patient.user?.role === 'patient');

        this.dataSource.data = this.patients;
      }
    });
  }

  openCreatePatientDialog(): void {
    // Structure conforme à ce que UserDialogComponent attend
    const dialogData: UserFormData = {
      nom: '',
      prenom: '',
      email: '',
      password: '',
      role: 'patient',
      actif: true,
      telephone: '',
      // Champs directement sur l'objet user, pas dans un sous-objet patient
      date_naissance: '',
      adresse: '',
      numero_assurance: '',
      sexe: 'M',
      groupe_sanguin: ''
    };

    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: UserFormData) => {
      console.log('PatientsComponent: Dialogue fermé. Résultat:', result);
      if (result) {
        // Validation des champs obligatoires
        if (!result.prenom?.trim() || !result.nom?.trim() || !result.email?.trim() || !result.password?.trim()) {
          this.snackBar.open('Les champs prénom, nom, email et mot de passe sont obligatoires', 'Fermer', { duration: 3000 });
          return;
        }

        if (result.role !== 'patient') {
          this.snackBar.open('Erreur: Le rôle doit être "patient" pour cette opération', 'Fermer', { duration: 3000 });
          return;
        }

        // Validation des champs spécifiques au patient
        if (!result.date_naissance || !result.adresse?.trim() || !result.sexe) {
          this.snackBar.open('La date de naissance, l\'adresse et le sexe sont obligatoires pour un patient', 'Fermer', { duration: 3000 });
          return;
        }

        // Convertir vers le format attendu par l'API (structure imbriquée)
        const apiData = {
          nom: result.nom.trim(),
          prenom: result.prenom.trim(),
          email: result.email.trim(),
          password: result.password.trim(),
          role: 'patient' as const,
          actif: result.actif ?? true,
          telephone: result.telephone?.trim() || undefined,
          patient: {
            numero_assurance: result.numero_assurance?.trim() || '',
            adresse: result.adresse.trim(),
            date_naissance: result.date_naissance,
            sexe: result.sexe,
            groupe_sanguin: result.groupe_sanguin?.trim() || '',
            antecedent_medicaux: '' // Valeur par défaut
          }
        };

        // Supprimer telephone si vide
        if (!apiData.telephone) {
          delete apiData.telephone;
        }

        console.log('PatientsComponent: Création du patient avec données:', apiData);
        this.apiService.createUser(apiData).subscribe({
          next: (response) => {
            console.log('PatientsComponent: Patient créé avec succès:', response);
            this.snackBar.open('Patient créé avec succès', 'Fermer', { duration: 3000 });
            this.loadPatients();
          },
          error: (error: ApiError) => {
            console.error('PatientsComponent: Erreur lors de la création du patient:', error);
            let errorMessage = 'Erreur lors de la création du patient';
            if (error.type === 'VALIDATION_ERROR') {
              errorMessage = `Erreur de validation: ${error.message}`;
              if (error.errors) {
                errorMessage += ` Détails: ${Object.entries(error.errors).map(([field, messages]) => `${field}: ${messages.join(', ')}`).join('; ')}`;
              }
            } else if (error.type === 'HTTP_ERROR') {
              errorMessage = `Erreur serveur: ${error.message}`;
            }
            this.snackBar.open(errorMessage, 'Fermer', { duration: 8000 });
          }
        });
      }
    });
  }

  openEditPatientDialog(patient: Patient): void {
    if (!patient.user) {
      this.snackBar.open('Erreur: Données utilisateur manquantes', 'Fermer', { duration: 3000 });
      return;
    }

    // Convertir les données du patient vers le format attendu par UserDialog
    const dialogData: UserFormData = {
      id: patient.user.id,
      nom: patient.user.nom,
      prenom: patient.user.prenom,
      email: patient.user.email,
      role: patient.user.role,
      actif: patient.user.actif,
      telephone: patient.user.telephone || '',
      // Champs patient directement sur l'objet
      date_naissance: patient.date_naissance,
      adresse: patient.adresse,
      numero_assurance: patient.numero_assurance,
      sexe: patient.sexe,
      groupe_sanguin: patient.groupe_sanguin || ''
    };

    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: UserFormData) => {
      if (result && patient.user?.id) {
        // Convertir vers le format API pour la mise à jour
        const apiData = {
          nom: result.nom.trim(),
          prenom: result.prenom.trim(),
          email: result.email.trim(),
          role: 'patient' as const,
          actif: result.actif ?? true,
          telephone: result.telephone?.trim() || undefined,
          patient: {
            numero_assurance: result.numero_assurance?.trim() || '',
            adresse: result.adresse?.trim() || '',
            date_naissance: result.date_naissance,
            sexe: result.sexe,
            groupe_sanguin: result.groupe_sanguin?.trim() || '',
          }
        };

        if (!apiData.telephone) {
          delete apiData.telephone;
        }

        this.apiService.updateUser(patient.user.id, apiData).subscribe({
          next: (response) => {
            this.snackBar.open('Patient modifié avec succès', 'Fermer', { duration: 3000 });
            this.loadPatients();
          },
          error: (error: ApiError) => {
            console.error('Erreur lors de la modification:', error);
            const errorMessage = error.message || 'Erreur lors de la modification du patient';
            this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
          }
        });
      }
    });
  }

  toggleActive(patient: Patient): void {
    const userToToggle = patient.user;
    if (!userToToggle || !userToToggle.id) {
      console.error('PatientsComponent: ID utilisateur manquant pour le patient:', patient);
      this.snackBar.open('Erreur: Impossible de modifier le statut du patient', 'Fermer', { duration: 3000 });
      return;
    }

    const newActiveState = !userToToggle.actif;
    console.log(`PatientsComponent: Mise à jour du statut de l'utilisateur ${userToToggle.id} vers ${newActiveState}`);

    this.apiService.updateUserStatus(userToToggle.id, newActiveState).subscribe({
      next: (response: User) => {
        console.log('PatientsComponent: Statut mis à jour:', response);
        this.snackBar.open(newActiveState ? 'Patient activé' : 'Patient désactivé', 'Fermer', { duration: 2000 });
        userToToggle.actif = newActiveState;
        this.dataSource.data = [...this.dataSource.data];
      },
      error: (error: ApiError) => {
        console.error('PatientsComponent: Erreur lors de la mise à jour du statut:', error);
        const errorMessage = error.message || 'Erreur lors de la mise à jour du statut';
        this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
      }
    });
  }

  deletePatient(patient: Patient): void {
    const userToDelete = patient.user;
    if (!userToDelete?.id) {
      console.error('PatientsComponent: ID utilisateur manquant pour le patient:', patient);
      this.snackBar.open('Erreur: Impossible de supprimer le patient', 'Fermer', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        message: `Voulez-vous supprimer le patient ${userToDelete.prenom} ${userToDelete.nom} ?`,
        confirmText: 'Oui',
        cancelText: 'Non'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        console.log('PatientsComponent: Suppression de l\'utilisateur:', userToDelete.id);
        this.apiService.deleteUser(userToDelete.id!).subscribe({
          next: () => {
            this.snackBar.open('Patient supprimé avec succès', 'Fermer', { duration: 2000 });
            this.loadPatients();
          },
          error: (error: ApiError) => {
            console.error('PatientsComponent: Erreur lors de la suppression:', error);
            const errorMessage = error.message || 'Erreur lors de la suppression du patient';
            this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
          }
        });
      }
    });
  }
}