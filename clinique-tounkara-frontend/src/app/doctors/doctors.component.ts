import { Component, OnInit, Inject } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { ApiService, Medecin, User, ApiError, UserFormData } from '../services/api.service';
import { ConfirmationDialogComponent } from '../components/confirmation-dialog/confirmation-dialog.component';
import { UserDialogComponent } from '../user-dialog/user-dialog.component';

@Component({
  selector: 'app-doctors',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    FormsModule,
  ],
  templateUrl: './doctors.component.html',
  styleUrls: ['./doctors.component.scss']
})
export class DoctorsComponent implements OnInit {
  displayedColumns: string[] = ['prenom', 'nom', 'email', 'specialite', 'tarif_consultation', 'actif', 'actions'];
  dataSource = new MatTableDataSource<Medecin>([]);
  doctors: Medecin[] = [];
  filterValue: string = '';
  specialtyFilter: string = '';
  activeFilter: boolean = false;
  specialties: string[] = [];

  constructor(
    public dialog: MatDialog,
    @Inject(ApiService) private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    console.log('DoctorsComponent: Initialisation du composant.');
    this.loadDoctors();
  }

  loadDoctors(): void {
    console.log('DoctorsComponent: Chargement des médecins...');
    this.apiService.getMedecins().subscribe({
      next: (response: { data: Medecin[] }) => {
        console.log('DoctorsComponent: Médecins chargés depuis l\'API:', response);
        this.doctors = response.data || [];
        this.dataSource.data = this.doctors;
        this.specialties = [...new Set(this.doctors.map(doctor => doctor.specialite))].sort();
        this.applyFilter();
      },
      error: (error: ApiError) => {
        console.error('DoctorsComponent: Erreur lors du chargement des médecins:', error);
        let errorMessage = 'Erreur lors du chargement des médecins';
        if (error.type === 'HTTP_ERROR') {
          errorMessage = error.message || 'Erreur serveur lors du chargement des médecins';
        }
        this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });

        this.doctors = [
          {
            id: 1,
            user_id: 1,
            user: {
              id: 1,
              prenom: 'Alice',
              nom: 'Docteur',
              email: 'alice.doctor@example.com',
              role: 'medecin',
              actif: true
            },
            specialite: 'Cardiologie',
            numero_ordre: '123ABC',
            tarif_consultation: 5000,
            horaire_consultation: { lundi: { debut: '09:00', fin: '17:00' } },
            disponible: true
          },
          {
            id: 2,
            user_id: 2,
            user: {
              id: 2,
              prenom: 'Bob',
              nom: 'Chirurgien',
              email: 'bob.surgeon@example.com',
              role: 'medecin',
              actif: false
            },
            specialite: 'Chirurgie Générale',
            numero_ordre: '456DEF',
            tarif_consultation: 7500,
            horaire_consultation: { lundi: { debut: '08:00', fin: '16:00' } },
            disponible: false
          }
        ];
        this.dataSource.data = this.doctors;
        this.specialties = [...new Set(this.doctors.map(doctor => doctor.specialite))].sort();
        this.applyFilter();
      }
    });
  }

  applyFilter(): void {
    let filteredData = this.doctors;

    if (this.filterValue) {
      const filterText = this.filterValue.toLowerCase().trim();
      filteredData = filteredData.filter(doctor =>
        doctor.user?.prenom?.toLowerCase().includes(filterText) ||
        doctor.user?.nom?.toLowerCase().includes(filterText) ||
        doctor.user?.email?.toLowerCase().includes(filterText) ||
        doctor.specialite?.toLowerCase().includes(filterText)
      );
    }

    if (this.specialtyFilter) {
      filteredData = filteredData.filter(doctor => doctor.specialite === this.specialtyFilter);
    }

    if (this.activeFilter) {
      filteredData = filteredData.filter(doctor => doctor.user?.actif);
    }

    this.dataSource.data = filteredData;
  }

  openCreateDoctorDialog(): void {
    const dialogData: UserFormData = {
      nom: '',
      prenom: '',
      email: '',
      password: '',
      role: 'medecin',
      actif: true,
      telephone: '',
      medecin: {
        specialite: '',
        numero_ordre: '',
        tarif_consultation: 0,
        horaire_consultation: { lundi: { debut: '09:00', fin: '17:00' } },
        disponible: true
      }
    };

    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: UserFormData) => {
      console.log('DoctorsComponent: Dialogue fermé. Résultat:', result);
      if (result) {
        if (!result.prenom?.trim() || !result.nom?.trim() || !result.email?.trim() || !result.password?.trim()) {
          this.snackBar.open('Les champs prénom, nom, email et mot de passe sont obligatoires', 'Fermer', { duration: 3000 });
          return;
        }

        // Vérification des champs spécifiques au médecin
        if (result.role !== 'medecin' || !result.medecin || 
            !result.medecin.specialite?.trim() || 
            !result.medecin.numero_ordre?.trim() || 
            typeof result.medecin.tarif_consultation !== 'number' || 
            result.medecin.tarif_consultation <= 0) {
          this.snackBar.open('La spécialité, le numéro d\'ordre et un tarif de consultation valide sont obligatoires', 'Fermer', { duration: 3000 });
          return;
        }

        const cleanData: UserFormData = {
          nom: result.nom.trim(),
          prenom: result.prenom.trim(),
          email: result.email.trim(),
          password: result.password.trim(),
          role: 'medecin',
          actif: result.actif ?? true,
          telephone: result.telephone?.trim() || undefined,
          medecin: {
            specialite: result.medecin.specialite.trim(),
            numero_ordre: result.medecin.numero_ordre.trim(),
            tarif_consultation: Number(result.medecin.tarif_consultation),
            horaire_consultation: result.medecin.horaire_consultation || { lundi: { debut: '09:00', fin: '17:00' } },
            disponible: result.medecin.disponible ?? true
          }
        };

        if (!cleanData.telephone) {
          delete cleanData.telephone;
        }

        console.log('DoctorsComponent: Création du médecin avec données:', cleanData);
        this.apiService.createUser(cleanData).subscribe({
          next: (response) => {
            console.log('DoctorsComponent: Médecin créé avec succès:', response);
            this.snackBar.open('Médecin créé avec succès', 'Fermer', { duration: 3000 });
            this.loadDoctors();
          },
          error: (error: ApiError) => {
            console.error('DoctorsComponent: Erreur lors de la création du médecin:', error);
            let errorMessage = 'Erreur lors de la création du médecin';
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

  toggleActive(doctor: Medecin): void {
    const userToToggle = doctor.user;
    if (!userToToggle || !userToToggle.id) {
      console.error('DoctorsComponent: ID utilisateur manquant pour le médecin:', doctor);
      this.snackBar.open('Erreur: Impossible de modifier le statut du médecin', 'Fermer', { duration: 3000 });
      return;
    }

    const newActiveState = !userToToggle.actif;
    console.log(`DoctorsComponent: Mise à jour du statut de l'utilisateur ${userToToggle.id} vers ${newActiveState}`);

    this.apiService.updateUserStatus(userToToggle.id, newActiveState).subscribe({
      next: (response: User) => {
        console.log('DoctorsComponent: Statut mis à jour:', response);
        this.snackBar.open(newActiveState ? 'Médecin activé' : 'Médecin désactivé', 'Fermer', { duration: 2000 });
        userToToggle.actif = newActiveState;
        this.dataSource.data = [...this.dataSource.data];
        this.applyFilter();
      },
      error: (error: ApiError) => {
        console.error('DoctorsComponent: Erreur lors de la mise à jour du statut:', error);
        const errorMessage = error.message || 'Erreur lors de la mise à jour du statut';
        this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
      }
    });
  }

  deleteDoctor(doctor: Medecin): void {
    const userToDelete = doctor.user;
    if (!userToDelete?.id) {
      console.error('DoctorsComponent: ID utilisateur manquant pour le médecin:', doctor);
      this.snackBar.open('Erreur: Impossible de supprimer le médecin', 'Fermer', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        message: `Voulez-vous supprimer le médecin ${userToDelete.prenom} ${userToDelete.nom} ?`,
        confirmText: 'Oui',
        cancelText: 'Non'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        console.log('DoctorsComponent: Suppression de l\'utilisateur:', userToDelete.id);
        this.apiService.deleteUser(userToDelete.id!).subscribe({
          next: () => {
            this.snackBar.open('Médecin supprimé avec succès', 'Fermer', { duration: 2000 });
            this.loadDoctors();
          },
          error: (error: ApiError) => {
            console.error('DoctorsComponent: Erreur lors de la suppression:', error);
            const errorMessage = error.message || 'Erreur lors de la suppression du médecin';
            this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
          }
        });
      }
    });
  }
}