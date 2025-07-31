import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { StatisticsService } from '../services/statistics.service';
import { StatisticsDialogComponent } from '../components/statistics-dialog/statistics-dialog.component';
import { Observable } from 'rxjs';
import { MatIconModule, MatIcon } from '@angular/material/icon';

// Import Chart.js correctement
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  DoughnutController,
  BarController,
  PieController,
  LineController // Ajout du LineController
} from 'chart.js';

// Enregistrer les composants Chart.js
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  DoughnutController,
  BarController,
  PieController,
  LineController // Enregistrement du LineController
);

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    MatIcon
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef;
  
  reportForm: FormGroup;
  currentStatistics: any = null;
  chartConfigs: any[] = [];
  charts: { [key: string]: Chart } = {}; // Typage correct pour Chart

  reportTypes = [
    { value: 'general', viewValue: 'Statistiques Générales' },
    { value: 'patients', viewValue: 'Statistiques des Patients' },
    { value: 'medecins', viewValue: 'Statistiques des Médecins' },
    { value: 'rendezvous', viewValue: 'Statistiques des Rendez-vous' },
    { value: 'paiements', viewValue: 'Statistiques des Paiements' },
  ];

  periods = [
    { value: 'all_time', viewValue: 'Depuis le début' },
    { value: 'today', viewValue: 'Aujourd\'hui' },
    { value: 'this_week', viewValue: 'Cette semaine' },
    { value: 'this_month', viewValue: 'Ce mois-ci' },
    { value: 'this_year', viewValue: 'Cette année' },
    { value: 'last_7_days', viewValue: 'Les 7 derniers jours' },
    { value: 'last_30_days', viewValue: 'Les 30 derniers jours' },
    { value: 'custom', viewValue: 'Période personnalisée' },
  ];

  constructor(
    private statisticsService: StatisticsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.reportForm = new FormGroup({
      reportType: new FormControl('general'),
      period: new FormControl('this_month'),
      startDate: new FormControl<Date | null>(null),
      endDate: new FormControl<Date | null>(null),
      medecin_id: new FormControl(null),
      patient_id: new FormControl(null),
      statut_rdv: new FormControl(null),
      statut_paiement: new FormControl(null),
    });
  }

  ngOnInit(): void {
    this.onPeriodChange();
    this.reportForm.get('period')?.valueChanges.subscribe(() => this.onPeriodChange());
    this.loadInitialData();
  }

  ngAfterViewInit(): void {
    // Les graphiques seront créés après le chargement des données
  }

  onPeriodChange(): void {
    const period = this.reportForm.get('period')?.value;
    if (period !== 'custom') {
      this.reportForm.get('startDate')?.setValue(null);
      this.reportForm.get('endDate')?.setValue(null);
    }
  }

  onReportTypeChange(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.generateReport(false); // Charger les données sans ouvrir la dialog
  }

  generateReport(openDialog: boolean = true): void {
    const { reportType, period, startDate, endDate, medecin_id, patient_id, statut_rdv, statut_paiement } = this.reportForm.value;

    const formattedStartDate = startDate ? formatDate(startDate, 'yyyy-MM-dd', 'en-US') : undefined;
    const formattedEndDate = endDate ? formatDate(endDate, 'yyyy-MM-dd', 'en-US') : undefined;

    let statisticsObservable: Observable<any>;
    let reportTitle = this.reportTypes.find(type => type.value === reportType)?.viewValue || 'Rapport';

    const filters: any = {};
    if (medecin_id) filters.medecin_id = medecin_id;
    if (patient_id) filters.patient_id = patient_id;
    if (statut_rdv) filters.statut = statut_rdv;
    if (statut_paiement) filters.statut = statut_paiement;

    switch (reportType) {
      case 'general':
        statisticsObservable = this.statisticsService.getGeneralStatistics(period, formattedStartDate, formattedEndDate);
        break;
      case 'patients':
        statisticsObservable = this.statisticsService.getPatientStatistics(period, formattedStartDate, formattedEndDate);
        break;
      case 'medecins':
        statisticsObservable = this.statisticsService.getMedecinStatistics(period, formattedStartDate, formattedEndDate);
        break;
      case 'rendezvous':
        statisticsObservable = this.statisticsService.getRendezVousStatistics(period, formattedStartDate, formattedEndDate, filters);
        break;
      case 'paiements':
        statisticsObservable = this.statisticsService.getPaiementStatistics(period, formattedStartDate, formattedEndDate, filters);
        break;
      default:
        this.snackBar.open('Type de rapport non valide.', 'Fermer', { duration: 3000 });
        return;
    }

    statisticsObservable.subscribe({
      next: (data) => {
        this.currentStatistics = data;
        this.createChartConfigs(reportType, data);
        
        setTimeout(() => {
          this.renderCharts();
        }, 100);

        if (openDialog) {
          this.dialog.open(StatisticsDialogComponent, {
            width: '80%',
            data: {
              statistics: data,
              reportTitle: reportTitle,
              reportType: reportType,
              period: period,
              startDate: formattedStartDate,
              endDate: formattedEndDate,
            }
          });
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des statistiques:', error);
        this.snackBar.open('Erreur lors de la récupération des statistiques.', 'Fermer', { duration: 3000 });
      }
    });
  }

  createChartConfigs(reportType: string, data: any): void {
    this.chartConfigs = [];

    switch (reportType) {
      case 'general':
        this.chartConfigs = [
          {
            id: 'usersChart',
            title: 'Utilisateurs par Rôle',
            type: 'doughnut',
            data: {
              labels: Object.keys(data.users_by_role || {}),
              datasets: [{
                data: Object.values(data.users_by_role || {}),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
              }]
            }
          },
          {
            id: 'ageGroupChart',
            title: 'Patients par Tranche d\'âge',
            type: 'bar',
            data: {
              labels: (data.patients_by_age_group || []).map((item: any) => item.age_group),
              datasets: [{
                label: 'Nombre de patients',
                data: (data.patients_by_age_group || []).map((item: any) => item.total),
                backgroundColor: '#36A2EB'
              }]
            }
          },
          {
            id: 'appointmentStatusChart',
            title: 'Rendez-vous par Statut',
            type: 'pie',
            data: {
              labels: (data.rendez_vous_by_status || []).map((item: any) => this.formatStatus(item.statut, 'rendezvous')),
              datasets: [{
                data: (data.rendez_vous_by_status || []).map((item: any) => item.total),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
              }]
            }
          },
          {
            id: 'paymentStatusChart',
            title: 'Paiements par Statut',
            type: 'doughnut',
            data: {
              labels: (data.paiements_by_status || []).map((item: any) => this.formatStatus(item.statut, 'paiements')),
              datasets: [{
                data: (data.paiements_by_status || []).map((item: any) => item.total),
                backgroundColor: ['#4BC0C0', '#FF6384', '#FFCE56']
              }]
            }
          }
        ];
        break;

      case 'patients':
        this.chartConfigs = [
          {
            id: 'genderChart',
            title: 'Patients par Sexe',
            type: 'doughnut',
            data: {
              labels: (data.patients_by_gender || []).map((item: any) => item.sexe),
              datasets: [{
                data: (data.patients_by_gender || []).map((item: any) => item.total),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
              }]
            }
          },
          {
            id: 'patientAgeChart',
            title: 'Patients par Tranche d\'âge',
            type: 'bar',
            data: {
              labels: (data.patients_by_age_group || []).map((item: any) => item.age_group),
              datasets: [{
                label: 'Nombre de patients',
                data: (data.patients_by_age_group || []).map((item: any) => item.total),
                backgroundColor: '#36A2EB'
              }]
            }
          }
        ];
        break;

      case 'medecins':
        this.chartConfigs = [
          {
            id: 'specialityChart',
            title: 'Médecins par Spécialité',
            type: 'bar',
            data: {
              labels: (data.medecins_by_speciality || []).map((item: any) => item.specialite),
              datasets: [{
                label: 'Nombre de médecins',
                data: (data.medecins_by_speciality || []).map((item: any) => item.total),
                backgroundColor: '#4BC0C0'
              }]
            }
          }
        ];
        break;

      case 'rendezvous':
        this.chartConfigs = [
          {
            id: 'rdvStatusChart',
            title: 'Rendez-vous par Statut',
            type: 'pie',
            data: {
              labels: (data.rendez_vous_by_status || []).map((item: any) => this.formatStatus(item.statut, 'rendezvous')),
              datasets: [{
                data: (data.rendez_vous_by_status || []).map((item: any) => item.total),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
              }]
            }
          },
          {
            id: 'motifChart',
            title: 'Rendez-vous par Motif',
            type: 'bar',
            data: {
              labels: (data.rendez_vous_by_motif || []).slice(0, 10).map((item: any) => item.motif),
              datasets: [{
                label: 'Nombre de rendez-vous',
                data: (data.rendez_vous_by_motif || []).slice(0, 10).map((item: any) => item.total),
                backgroundColor: '#FFCE56'
              }]
            }
          }
        ];
        break;

      case 'paiements':
        this.chartConfigs = [
          {
            id: 'paymentStatusChart2',
            title: 'Paiements par Statut',
            type: 'doughnut',
            data: {
              labels: (data.paiements_by_status || []).map((item: any) => this.formatStatus(item.statut, 'paiements')),
              datasets: [{
                data: (data.paiements_by_status || []).map((item: any) => item.total),
                backgroundColor: ['#4BC0C0', '#FF6384', '#FFCE56']
              }]
            }
          },
          {
            id: 'monthlyRevenueChart',
            title: 'Revenu Mensuel',
            type: 'line',
            data: {
              labels: (data.paiements_monthly_revenue || []).map((item: any) => item.month),
              datasets: [{
                label: 'Revenu (F CFA)',
                data: (data.paiements_monthly_revenue || []).map((item: any) => item.total_monthly_revenue),
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                fill: true
              }]
            }
          }
        ];
        break;
    }
  }

  renderCharts(): void {
    // Détruire les graphiques existants
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.charts = {};

    // Créer les nouveaux graphiques
    this.chartConfigs.forEach(config => {
      const canvas = document.getElementById(config.id) as HTMLCanvasElement;
      if (!canvas) {
        console.error(`Canvas avec l'ID ${config.id} non trouvé`);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        this.charts[config.id] = new Chart(ctx, {
          type: config.type,
          data: config.data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      } else {
        console.error(`Contexte 2D pour ${config.id} non obtenu`);
      }
    });
  }

  downloadReport(format: 'pdf' | 'excel'): void {
    const { reportType, period, startDate, endDate, medecin_id, patient_id, statut_rdv, statut_paiement } = this.reportForm.value;

    if (!reportType) {
      this.snackBar.open('Veuillez sélectionner un type de rapport.', 'Fermer', { duration: 3000 });
      return;
    }

    const formattedStartDate = startDate ? formatDate(startDate, 'yyyy-MM-dd', 'en-US') : undefined;
    const formattedEndDate = endDate ? formatDate(endDate, 'yyyy-MM-dd', 'en-US') : undefined;

    const filters: any = {};
    if (medecin_id) filters.medecin_id = medecin_id;
    if (patient_id) filters.patient_id = patient_id;
    if (statut_rdv) filters.statut = statut_rdv;
    if (statut_paiement) filters.statut = statut_paiement;

    let downloadObservable: Observable<Blob>;

    if (format === 'pdf') {
      downloadObservable = this.statisticsService.downloadPdfReport(reportType, period, formattedStartDate, formattedEndDate, filters);
    } else {
      downloadObservable = this.statisticsService.downloadExcelReport(reportType, period, formattedStartDate, formattedEndDate, filters);
    }

    downloadObservable.subscribe({
      next: (responseBlob) => {
        const blob = new Blob([responseBlob], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.snackBar.open(`Rapport ${format.toUpperCase()} téléchargé avec succès.`, 'Fermer', { duration: 3000 });
      },
      error: (error) => {
        console.error(`Erreur lors du téléchargement du rapport ${format.toUpperCase()}:`, error);
        this.snackBar.open(`Erreur lors du téléchargement du rapport ${format.toUpperCase()}.`, 'Fermer', { duration: 3000 });
      }
    });
  }

  private formatStatus(status: string, type: 'rendezvous' | 'paiements'): string {
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
}