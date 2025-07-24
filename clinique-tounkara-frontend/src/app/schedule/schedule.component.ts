
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ScheduleService, DaySchedule } from '../services/schedule.service';

// Interface pour les contrôles du formulaire, alignée avec DaySchedule
interface DayScheduleFormControls {
  isAvailable: FormControl<boolean>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  breakStart: FormControl<string>;
  endBreak: FormControl<string>; // Renommé pour correspondre à DaySchedule
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss']
})
export class ScheduleComponent implements OnInit {
  scheduleForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  schedule: DaySchedule[] = [];

  daysOfWeek = [
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
  ];

  // Récupérer l'user_id depuis le localStorage (ajustez selon votre logique d'authentification)
  userId: number = JSON.parse(localStorage.getItem('user') || '{}')?.id || 0;

  constructor(
    private fb: FormBuilder,
    private scheduleService: ScheduleService
  ) {
    this.scheduleForm = this.fb.group({
      availabilities: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadSchedule();
  }

  get availabilities(): FormArray {
    return this.scheduleForm.get('availabilities') as FormArray;
  }

  // Méthodes getter pour le template avec typage amélioré
  getAvailabilityControl(index: number): FormControl<boolean> {
    return this.availabilities.at(index).get('isAvailable') as FormControl<boolean>;
  }

  getStartTimeControl(index: number): FormControl<string> {
    return this.availabilities.at(index).get('startTime') as FormControl<string>;
  }

  getEndTimeControl(index: number): FormControl<string> {
    return this.availabilities.at(index).get('endTime') as FormControl<string>;
  }

  getBreakStartControl(index: number): FormControl<string> {
    return this.availabilities.at(index).get('breakStart') as FormControl<string>;
  }

  getBreakEndControl(index: number): FormControl<string> {
    return this.availabilities.at(index).get('endBreak') as FormControl<string>;
  }

 initializeForm(): void {
  this.daysOfWeek.forEach(() => {
    this.availabilities.push(this.fb.group({
      isAvailable: [false],
      startTime: [{ value: '08:00', disabled: true }, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/)], // Accepte HH:MM ou HH:MM:SS
      endTime: [{ value: '17:00', disabled: true }, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/)],
      breakStart: [{ value: '12:00', disabled: true }, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/)],
      endBreak: [{ value: '13:00', disabled: true }, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/)]
    }));
  });
}

  loadSchedule(): void {
  if (this.userId) {
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.scheduleService.getSchedule(this.userId).subscribe({
      next: (schedule: DaySchedule[]) => {
        this.schedule = schedule;
        schedule.forEach((day: DaySchedule, index: number) => {
          const group = this.availabilities.at(index);
          if (group) {
            group.patchValue({
              isAvailable: day.is_available,
              startTime: day.start_time ? day.start_time.split(':').slice(0, 2).join(':') : '08:00', // Tronque à HH:MM
              endTime: day.end_time ? day.end_time.split(':').slice(0, 2).join(':') : '17:00',
              breakStart: day.break_start ? day.break_start.split(':').slice(0, 2).join(':') : '12:00',
              endBreak: day.end_break ? day.end_break.split(':').slice(0, 2).join(':') : '13:00'
            });
            this.toggleTimeFields(index, day.is_available);
          }
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des horaires:', error);
        this.errorMessage = 'Erreur lors du chargement des horaires';
        this.isLoading = false;
      }
    });
  } else {
    this.errorMessage = 'Utilisateur non identifié';
  }
}
  toggleTimeFields(index: number, isAvailable: boolean): void {
    const group = this.availabilities.at(index);
    if (!group) return;

    const controls = ['startTime', 'endTime', 'breakStart', 'endBreak'];
    
    controls.forEach(controlName => {
      const control = group.get(controlName);
      if (control) {
        if (isAvailable) {
          control.enable();
        } else {
          control.disable();
        }
      }
    });
  }

  onAvailabilityChange(index: number): void {
    const group = this.availabilities.at(index);
    if (group) {
      const isAvailable = group.get('isAvailable')?.value;
      this.toggleTimeFields(index, isAvailable);
    }
  }

onSubmit(): void {
    if (this.scheduleForm.valid && this.userId) {
      this.isLoading = true;
      this.errorMessage = null;
      this.successMessage = null;

      const savePromises = this.availabilities.controls.map((group, index) => {
        const formGroup = group as FormGroup;
        const isAvailable = formGroup.get('isAvailable')?.value || false;
        const scheduleData: DaySchedule = {
          id: this.schedule[index]?.id, // Utiliser l'ID du schedule existant
          user_id: this.userId,
          day_of_week: this.daysOfWeek[index],
          is_available: isAvailable,
          start_time: isAvailable ? formGroup.get('startTime')?.value || null : null,
          end_time: isAvailable ? formGroup.get('endTime')?.value || null : null,
          break_start: isAvailable ? formGroup.get('breakStart')?.value || null : null,
          end_break: isAvailable ? formGroup.get('endBreak')?.value || null : null
        };

        console.log('Données envoyées pour', this.daysOfWeek[index], ':', scheduleData);
        return new Promise((resolve, reject) => {
          this.scheduleService.saveSchedule(scheduleData).subscribe({
            next: (response) => resolve(response),
            error: (error) => reject(error)
          });
        });
      });

      Promise.all(savePromises)
        .then(() => {
          this.loadSchedule(); // Rafraîchir les données
          this.successMessage = 'Horaires enregistrés avec succès';
          this.isLoading = false;
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        })
        .catch((error) => {
          console.error('Erreur lors de l\'enregistrement:', error);
          this.errorMessage = 'Erreur lors de l\'enregistrement des horaires';
          this.isLoading = false;
        });
    } else {
      this.errorMessage = 'Veuillez corriger les erreurs dans le formulaire ou vous connecter';
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    this.availabilities.controls.forEach(group => {
      const formGroup = group as FormGroup;
      Object.keys(formGroup.controls).forEach(key => {
        formGroup.get(key)?.markAsTouched();
      });
    });
  }

  resetForm(): void {
    this.errorMessage = null;
    this.successMessage = null;
    
    this.availabilities.controls.forEach((group, index) => {
      group.reset({
        isAvailable: false,
        startTime: '08:00',
        endTime: '17:00',
        breakStart: '12:00',
        endBreak: '13:00'
      });
      this.toggleTimeFields(index, false);
    });
  }

  // Méthode utilitaire pour valider les heures
  private validateTimeRange(startTime: string, endTime: string): boolean {
    return startTime < endTime;
  }

  // Méthode pour obtenir la validation personnalisée
  getTimeValidationError(controlName: string, index: number): string | null {
    const group = this.availabilities.at(index);
    const control = group?.get(controlName);
    
    if (control?.errors && control.touched) {
      if (control.errors['pattern']) {
        return 'Format d\'heure invalide (HH:MM)';
      }
      if (control.errors['required']) {
        return 'Ce champ est requis';
      }
    }
    return null;
  }
}