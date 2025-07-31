
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Facture, PaginatedResponse, ApiError } from '../../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog } from '@angular/material/dialog'; // Importation pour le dialogue
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import { InvoiceDetailsDialogComponent } from '../../invoice-details-dialog/invoice-details-dialog.component'; // Importation du composant de dialogue

interface PaymentStats {
  total_factures: number;
  total_montant: number;
  factures_payees: number;
  factures_en_attente: number;
  chiffre_affaires_mensuel: number;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule, // Ajout du module pour le dialogue
    FormsModule
  ],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss']
})
export class BillingComponent implements OnInit {
  invoices: Facture[] = [];
  filteredInvoices: Facture[] = [];
  stats: PaymentStats = {
    total_factures: 0,
    total_montant: 0,
    factures_payees: 0,
    factures_en_attente: 0,
    chiffre_affaires_mensuel: 0
  };
  
  loading = true;
  isExporting = false;
  searchTerm = '';
  statusFilter = 'all';
  dateFilter: Date | null = null;
  
  displayedColumns: string[] = [
    'numero',
    'patient',
    'medecin',
    'date_emission',
    'montant_total',
    'statut',
    'actions'
  ];

  statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'envoyee', label: 'Envoyée' },
    { value: 'payee', label: 'Payée' },
    { value: 'annulee', label: 'Annulée' }
  ];

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog // Injection du service MatDialog
  ) {}

  ngOnInit() {
    this.loadInvoices();
  }

  loadInvoices() {
    this.loading = true;
    this.apiService.getInvoices().subscribe({
      next: (response: PaginatedResponse<Facture>) => {
        console.log('Réponse des factures:', JSON.stringify(response, null, 2));
        this.invoices = (response.data || []).map((invoice: Facture) => {
          this.debugInvoiceStructure(invoice);
          
          const shouldBeMarkedAsPaid = invoice.paiement && 
                                     invoice.paiement.statut === 'paye' && 
                                     invoice.statut !== 'payee';
          
          if (shouldBeMarkedAsPaid) {
            console.log(`Facture ${invoice.id} sera marquée comme payée`);
            this.markInvoiceAsPaid(invoice.id);
          }
          
          const correctedInvoice: Facture = {
            ...invoice,
            montant_total: this.getFormattedAmount(invoice.montant_total),
            tva: Number(invoice.tva) || 0,
            statut: shouldBeMarkedAsPaid ? 'payee' : (invoice.statut || 'brouillon'),
            paiement: invoice.paiement ? {
              ...invoice.paiement,
              montant: Number(invoice.paiement.montant) || 0,
              rendez_vous: invoice.paiement.rendez_vous ? {
                ...invoice.paiement.rendez_vous,
                tarif: Number(invoice.paiement.rendez_vous.tarif) || 0,
                patient: invoice.paiement.rendez_vous.patient,
                medecin: invoice.paiement.rendez_vous.medecin
              } : {
                id: 0,
                patient: { user: { nom: '', prenom: '' } },
                date_heure: '',
                motif: '',
                tarif: 0,
                statut: ''
              }
            } : null
          };
          
          return correctedInvoice;
        });
        this.filteredInvoices = [...this.invoices];
        this.calculateStats();
        this.loading = false;
        console.log('Factures traitées:', JSON.stringify(this.invoices, null, 2));
      },
      error: (error: ApiError) => {
        console.error('Erreur lors du chargement des factures:', error);
        this.snackBar.open('Erreur lors du chargement des factures', 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loading = false;
      }
    });
  }

  markInvoiceAsPaid(factureId: number) {
    this.apiService.markFactureAsPaid(factureId).subscribe({
      next: (updatedFacture: Facture) => {
        console.log(`Facture ${factureId} marquée comme payée:`, updatedFacture);
        
        const index = this.invoices.findIndex(inv => inv.id === factureId);
        if (index !== -1) {
          this.invoices[index] = { ...this.invoices[index], statut: 'payee' };
          this.filteredInvoices = [...this.invoices];
          this.calculateStats();
        }
        
        this.snackBar.open('Statut de la facture mis à jour', 'Fermer', {
          duration: 2000,
          panelClass: ['success-snackbar']
        });
      },
      error: (error: ApiError) => {
        console.error(`Erreur lors de la mise à jour du statut de la facture ${factureId}:`, error);
      }
    });
  }

  syncInvoiceStatuses() {
    this.invoices.forEach(invoice => {
      if (invoice.paiement && invoice.paiement.statut === 'paye' && invoice.statut !== 'payee') {
        this.markInvoiceAsPaid(invoice.id);
      }
    });
  }

  refreshInvoices() {
    this.loadInvoices();
    this.snackBar.open('Données actualisées', 'Fermer', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });
  }

  debugInvoiceStructure(invoice: Facture) {
    console.log('=== DEBUG STRUCTURE FACTURE ===');
    console.log('ID Facture:', invoice.id);
    console.log('Numero:', invoice.numero);
    console.log('Statut:', invoice.statut);
    console.log('Paiement:', invoice.paiement);
    
    if (invoice.paiement) {
      console.log('Rendez-vous:', invoice.paiement.rendez_vous);
      
      if (invoice.paiement.rendez_vous) {
        console.log('Patient complet:', invoice.paiement.rendez_vous.patient);
        console.log('Médecin complet:', invoice.paiement.rendez_vous.medecin);
        
        if (invoice.paiement.rendez_vous.patient) {
          console.log('User patient:', invoice.paiement.rendez_vous.patient.user);
        }
        
        if (invoice.paiement.rendez_vous.medecin) {
          console.log('User médecin:', invoice.paiement.rendez_vous.medecin.user);
          console.log('Spécialité médecin:', invoice.paiement.rendez_vous.medecin.specialite);
        }
      }
    }
    console.log('===============================');
  }

  calculateStats() {
    this.stats = {
      total_factures: this.invoices.length,
      total_montant: this.invoices.reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0),
      factures_payees: this.invoices.filter(inv => inv.statut === 'payee').length,
      factures_en_attente: this.invoices.filter(inv => inv.statut === 'brouillon').length,
      chiffre_affaires_mensuel: this.calculateMonthlyRevenue()
    };
    console.log('Statistiques calculées:', this.stats);
  }

  calculateMonthlyRevenue(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return this.invoices
      .filter(inv => {
        const invoiceDate = new Date(inv.date_emission);
        return invoiceDate.getMonth() === currentMonth && 
               invoiceDate.getFullYear() === currentYear &&
               inv.statut === 'payee';
      })
      .reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
  }

  applyFilters() {
    this.filteredInvoices = this.invoices.filter(invoice => {
      const matchesSearch = this.searchTerm === '' || 
        invoice.numero.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        this.getPatientName(invoice).toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        this.getMedecinName(invoice).toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        this.getMedecinSpecialite(invoice).toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesStatus = this.statusFilter === 'all' || invoice.statut === this.statusFilter;
      
      const matchesDate = !this.dateFilter || 
        new Date(invoice.date_emission).toDateString() === this.dateFilter.toDateString();
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }

  onSearchChange() {
    this.applyFilters();
  }

  onStatusFilterChange() {
    this.applyFilters();
  }

  onDateFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.dateFilter = null;
    this.filteredInvoices = [...this.invoices];
  }

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

  getPatientName(invoice: Facture): string {
    try {
      const patient = invoice.paiement?.rendez_vous?.patient?.user;
      if (!patient) {
        console.warn('Aucune donnée patient trouvée pour la facture:', invoice.id);
        return 'N/A';
      }
      const fullName = `${patient.nom ?? ''} ${patient.prenom ?? ''}`.trim();
      console.log('Nom patient extrait:', fullName);
      return fullName || 'N/A';
    } catch (error) {
      console.error('Erreur lors de l\'extraction du nom patient:', error);
      return 'N/A';
    }
  }

  getMedecinName(invoice: Facture): string {
    try {
      const medecin = invoice.paiement?.rendez_vous?.medecin;
      if (!medecin?.user) {
        console.warn('Aucune donnée médecin trouvée pour la facture:', invoice.id);
        return 'N/A';
      }
      const fullName = `Dr. ${medecin.user.nom ?? ''} ${medecin.user.prenom ?? ''}`.trim();
      console.log('Nom médecin extrait:', fullName);
      return fullName || 'N/A';
    } catch (error) {
      console.error('Erreur lors de l\'extraction du nom médecin:', error);
      return 'N/A';
    }
  }

  getMedecinSpecialite(invoice: Facture): string {
    try {
      const specialite = invoice.paiement?.rendez_vous?.medecin?.specialite;
      if (!specialite) {
        console.warn('Aucune spécialité trouvée pour la facture:', invoice.id);
        return 'N/A';
      }
      console.log('Spécialité médecin extraite:', specialite);
      return specialite;
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

  downloadInvoice(invoice: Facture) {
    console.log('Tentative de téléchargement pour la facture:', invoice.id);
    
    if (!invoice.id) {
      this.snackBar.open('ID de facture invalide', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    
    this.apiService.downloadFacturePDF(invoice.id).subscribe({
      next: (blob: Blob) => {
        this.handleDownloadSuccess(blob, invoice.numero);
      },
      error: (error: ApiError) => {
        this.handleDownloadError(error, invoice);
      }
    });
  }

  private handleDownloadSuccess(blob: Blob, numero: string) {
    const fileName = `Facture_${numero || 'inconnue'}.pdf`;
    saveAs(blob, fileName);
    this.snackBar.open('Facture téléchargée avec succès', 'Fermer', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private handleDownloadError(error: ApiError, invoice?: Facture) {
    console.error('Erreur lors du téléchargement:', error);
    let errorMessage = 'Erreur lors du téléchargement de la facture';
    
    switch (error.type) {
      case 'UNAUTHORIZED':
        errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        break;
      case 'FORBIDDEN':
        errorMessage = 'Accès non autorisé à cette facture.';
        break;
      case 'HTTP_ERROR':
        if (error.message?.includes('500')) {
          errorMessage = 'Erreur serveur lors de la génération du PDF. Vérifiez que la facture existe dans le système.';
        } else {
          errorMessage = 'Erreur de connexion au serveur.';
        }
        break;
      case 'PAYMENT_NOT_FOUND':
        errorMessage = 'Facture non trouvée.';
        break;
    }
    
    if (invoice) {
      errorMessage += ` (Facture ${invoice.numero})`;
    }
    
    this.snackBar.open(errorMessage, 'Fermer', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  viewInvoiceDetails(invoice: Facture) {
    console.log('Ouverture des détails de la facture:', invoice);
    this.dialog.open(InvoiceDetailsDialogComponent, {
      width: '600px',
      data: invoice, // Passage des données de la facture au dialogue
      panelClass: 'custom-dialog-container'
    });
  }

  sendInvoice(invoice: Facture) {
    this.snackBar.open('Fonctionnalité d\'envoi par email à implémenter', 'Fermer', {
      duration: 3000
    });
  }

  exportData() {
    try {
      this.isExporting = true;
      const headers = [
        'Numéro Facture',
        'Patient',
        'Médecin',
        'Spécialité',
        'Date Émission',
        'Montant Total',
        'Statut',
        'TVA'
      ];

      const csvData = this.filteredInvoices.map(invoice => {
        const patientName = this.getPatientName(invoice);
        const medecinName = this.getMedecinName(invoice);
        const specialite = this.getMedecinSpecialite(invoice);
        const dateEmission = new Date(invoice.date_emission).toLocaleDateString('fr-FR');
        
        return [
          `"${invoice.numero}"`,
          `"${patientName}"`,
          `"${medecinName}"`,
          `"${specialite}"`,
          `"${dateEmission}"`,
          invoice.montant_total.toFixed(2),
          `"${this.getStatusLabel(invoice.statut)}"`,
          invoice.tva.toFixed(2)
        ].join(',');
      });

      const csvContent = [
        headers.join(','),
        ...csvData
      ].join('\n');

      const bom = '\uFEFF'; // BOM pour UTF-8
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const fileName = `export_factures_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`;
      saveAs(blob, fileName);

      this.snackBar.open('Exportation réussie', 'Fermer', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      this.snackBar.open('Erreur lors de l\'exportation des données', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isExporting = false;
    }
  }
}
