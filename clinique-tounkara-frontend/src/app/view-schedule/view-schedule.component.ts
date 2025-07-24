import { Component, OnInit } from '@angular/core';
import { ScheduleService, DaySchedule } from '../services/schedule.service';
import { CommonModule } from '@angular/common';
import { faClock, faCoffee, faTimes, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-view-schedule',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './view-schedule.component.html',
  styleUrls: ['./view-schedule.component.scss']
})
export class ViewScheduleComponent implements OnInit {
  faClock = faClock;
  faCoffee = faCoffee;
  faTimes = faTimes;
  faSpinner = faSpinner;
  faExclamationTriangle = faExclamationTriangle;

  schedule: DaySchedule[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Récupérer l'user_id depuis le localStorage
  private userId: number = JSON.parse(localStorage.getItem('user') || '{}')?.id || 0;

  constructor(private scheduleService: ScheduleService) {}

  ngOnInit(): void {
    this.loadSchedule();
  }

  loadSchedule(): void {
    if (this.userId) {
      this.isLoading = true;
      this.scheduleService.getSchedule(this.userId).subscribe({
        next: (data: DaySchedule[]) => {
          this.schedule = data;
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

  trackByIndex(index: number, _: any): number {
    return index;
  }
}
