import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatIcon } from "@angular/material/icon";
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  ApiService, 
  ConfirmedAppointmentResponse, 
  PaymentsApiResponse, 
  ApiError,
  PaymentVerificationResponse,
  SyncPendingPaymentsResponse
} from '../services/api.service';
import { saveAs } from 'file-saver';

// Interface pour la réponse de création de paiement
export interface PaymentCreationResponse {
  data: {
    paiement_id: number;
    paydunya_url: string;
    paydunya_token: string;
    montant: number;
  };
  message: string;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIcon,
    MatBadgeModule,
    MatTooltipModule
  ],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent implements OnInit, OnDestroy {
  confirmedAppointments: ConfirmedAppointmentResponse[] = [];
  isLoading = true;
  error: string | null = null;
  processingPayment: { [key: number]: boolean } = {};
  pendingPayments: Set<number> = new Set();
  processingPayments = new Set<number>();
  
  // Nouvelle propriété pour gérer les messages de statut
  statusMessages: { [key: number]: string } = {};

  // Intervalle pour la vérification automatique
  private autoCheckInterval?: any;
  private statusCheckInterval: any;
  private readonly AUTO_CHECK_INTERVAL = 10000; // 10 secondes

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadConfirmedAppointments();
    
    // Vérifier les paramètres de retour de PayDunya
    this.checkPaymentReturn();
    
    // Démarrer la vérification périodique des statuts
    this.startAutoPaymentVerification();
    
    // Écouter les changements de visibilité de la page
    this.handleVisibilityChange();
  }

  ngOnDestroy(): void {
    this.stopAutoPaymentVerification();
  }

  /**
   * Vérifier si l'utilisateur revient de PayDunya
   */
  checkPaymentReturn(): void {
  this.route.queryParams.subscribe(params => {
    // Retour de paiement réussi
    if (params['payment_return'] === 'true') {
      console.log('Retour de PayDunya détecté - Paiement réussi');
      this.snackBar.open(
        'Paiement effectué ! Vérification en cours...',
        'Fermer',
        { duration: 5000, panelClass: ['success-snackbar'] }
      );
      
      // Recharger immédiatement
      this.loadConfirmedAppointments();
      
      // Nettoyer l'URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }

    // Retour de paiement annulé
    if (params['payment_cancel'] === 'true') {
      console.log('Retour de PayDunya détecté - Paiement annulé');
      this.snackBar.open(
        'Paiement annulé par l\'utilisateur',
        'Fermer',
        { duration: 5000, panelClass: ['warning-snackbar'] }
      );
      
      // Recharger pour avoir l'état à jour
      this.loadConfirmedAppointments();
      
      // Nettoyer l'URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }

    // Retour d'erreur de paiement
    if (params['payment_error'] === 'true') {
      const errorMessage = params['message'] || 'Erreur lors du paiement';
      console.log('Retour de PayDunya détecté - Erreur:', errorMessage);
      this.snackBar.open(
        decodeURIComponent(errorMessage),
        'Fermer',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
      
      // Recharger pour avoir l'état à jour
      this.loadConfirmedAppointments();
      
      // Nettoyer l'URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }

    // Gérer les callbacks directs de PayDunya (si ils passent encore par là)
    if (params['token'] && !params['payment_return'] && !params['payment_cancel']) {
      const token = params['token'];
      const paiementId = params['paiement_id'];
      
      console.log('Callback direct PayDunya détecté', { token, paiementId });
      
      if (paiementId) {
        this.snackBar.open(
          'Paiement détecté ! Vérification en cours...',
          'Fermer',
          { duration: 5000, panelClass: ['info-snackbar'] }
        );
      }
      
      // Recharger les données
      this.loadConfirmedAppointments();
      
      // Nettoyer l'URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }
  });
}

  /**
   * Démarrer la vérification automatique
   */
  startAutoPaymentVerification() {
    this.autoCheckInterval = setInterval(() => {
      this.syncPendingPayments();
    }, this.AUTO_CHECK_INTERVAL);
  }

  /**
   * Arrêter la vérification automatique
   */
  stopAutoPaymentVerification() {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = null;
    }
  }

  /**
   * Synchronisation automatique de tous les paiements en attente
   * Cette méthode utilise l'endpoint qui vérifie tous les paiements en attente du patient
   * et met à jour automatiquement ceux qui ont une facture associée
   */
  syncPendingPayments() {
    if (this.pendingPayments.size === 0) {
      return; // Pas de paiements en attente
    }

    this.apiService.syncPendingPayments().subscribe({
      next: (response: SyncPendingPaymentsResponse) => {
        if (response.data.updated_payments_count > 0) {
          console.log(`${response.data.updated_payments_count} paiement(s) synchronisé(s)`);
          
          // Mettre à jour les rendez-vous affectés
          response.data.updated_payments.forEach(updatedPayment => {
            const appointment = this.confirmedAppointments.find(
              app => app.id === updatedPayment.rendez_vous_id
            );
            
            if (appointment && appointment.paiement) {
              // Le backend a trouvé une facture et mis le statut à 'paye'
              appointment.paiement.statut = updatedPayment.nouveau_statut as 'en_attente' | 'paye' | 'annule';
              
              // Retirer de la liste des paiements en attente
              this.pendingPayments.delete(appointment.id);
              delete this.statusMessages[appointment.id];
              
              // Marquer qu'une facture existe (sera rechargée via loadConfirmedAppointments)
              console.log(`Paiement ${updatedPayment.paiement_id} confirmé avec facture ${updatedPayment.facture_id}`);
            }
          });

          // Recharger les données complètes pour avoir les factures mises à jour
          this.loadConfirmedAppointments();
          
          this.snackBar.open(
            `${response.data.updated_payments_count} paiement(s) confirmé(s) automatiquement !`,
            'Fermer',
            { duration: 5000, panelClass: ['success-snackbar'] }
          );
        }
      },
      error: (error) => {
        console.error('Erreur lors de la synchronisation automatique:', error);
        // Pas d'alerte pour l'utilisateur car c'est un processus en arrière-plan
      }
    });
  }

  /**
   * Vérification manuelle du statut d'un paiement spécifique
   */
  checkPaymentStatus(appointmentId: number) {
    this.processingPayments.add(appointmentId);
    this.statusMessages[appointmentId] = 'Vérification en cours...';

    this.apiService.verifyPaymentStatus(appointmentId).subscribe({
      next: (response: PaymentVerificationResponse) => {
        const appointment = this.confirmedAppointments.find(app => app.id === appointmentId);
        
        if (appointment && appointment.paiement) {
          // Mettre à jour les données du paiement
          appointment.paiement.statut = response.data.statut as 'en_attente' | 'paye' | 'annule';
          appointment.paiement.reference = response.data.reference;
          
          // Si une facture a été trouvée, l'ajouter
          if (response.data.facture) {
            appointment.paiement.facture = response.data.facture;
          }

          // Retirer de la liste des paiements en attente si nécessaire
          if (response.data.statut === 'paye') {
            this.pendingPayments.delete(appointmentId);
            delete this.statusMessages[appointmentId];
          }

          // Message de succès
          if (response.data.status_changed) {
            this.snackBar.open(
              'Paiement confirmé avec succès !',
              'Fermer',
              { duration: 5000, panelClass: ['success-snackbar'] }
            );
          } else if (response.data.statut === 'paye') {
            this.snackBar.open(
              'Paiement déjà confirmé',
              'Fermer',
              { duration: 3000, panelClass: ['info-snackbar'] }
            );
          } else {
            this.snackBar.open(
              'Paiement toujours en attente',
              'Fermer',
              { duration: 3000, panelClass: ['warning-snackbar'] }
            );
          }
        }

        this.processingPayments.delete(appointmentId);
      },
      error: (error) => {
        console.error('Erreur lors de la vérification:', error);
        this.snackBar.open(
          'Erreur lors de la vérification du paiement',
          'Fermer',
          { duration: 5000, panelClass: ['error-snackbar'] }
        );
        this.processingPayments.delete(appointmentId);
        delete this.statusMessages[appointmentId];
      }
    });
  }

  /**
   * Gérer les changements de visibilité de la page
   */
  handleVisibilityChange(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.pendingPayments.size > 0) {
        console.log('Page redevenue visible, vérification des paiements');
        this.syncPendingPayments();
      }
    });
  }

  /**
   * Charger les rendez-vous confirmés depuis l'API
   */
  loadConfirmedAppointments(): void {
    this.isLoading = true;
    this.error = null;
    
    this.apiService.getConfirmedAppointments().subscribe({
      next: (response: PaymentsApiResponse) => {
        console.log('getConfirmedAppointments response:', response);
        this.confirmedAppointments = response.data || [];
        
        // Mettre à jour la liste des paiements en attente
        this.updatePendingPayments();
        
        this.isLoading = false;
        console.log('Rendez-vous confirmés:', this.confirmedAppointments);
      },
      error: (err: ApiError) => {
        console.error('Erreur lors du chargement des rendez-vous confirmés:', err);
        this.handleApiError(err, 'Erreur lors du chargement des rendez-vous confirmés');
        this.isLoading = false;
      }
    });
  }

  /**
   * Mettre à jour la liste des paiements en attente
   */
  updatePendingPayments(): void {
    this.pendingPayments.clear();
    
    this.confirmedAppointments.forEach(appointment => {
      const isPending = appointment.paiement?.statut === 'en_attente';
      const hasInvoice = appointment.paiement?.facture;
      const isPaid = appointment.paiement?.statut === 'paye';
      const isInvoicePaid = appointment.paiement?.facture?.statut === 'payee';
      
      // Considérer comme en attente seulement si :
      // - Le statut est 'en_attente' ET
      // - Il n'y a pas de facture payée
      if (isPending && !isPaid && !isInvoicePaid) {
        this.pendingPayments.add(appointment.id);
        this.statusMessages[appointment.id] = 'Paiement en attente...';
      }
    });
    
    console.log('Paiements en attente mis à jour:', Array.from(this.pendingPayments));
  }

  /**
   * Initier un paiement pour un rendez-vous
   */
  initiatePayment(rendezVousId: number): void {
    if (!rendezVousId) {
      this.showError('ID du rendez-vous invalide.');
      return;
    }

    if (this.processingPayment[rendezVousId]) {
      return; // Déjà en cours de traitement
    }

    this.processingPayment[rendezVousId] = true;
    this.error = null;
    this.statusMessages[rendezVousId] = 'Création du paiement...';
    
    console.log('Création du paiement pour le rendez-vous:', rendezVousId);
    
    this.apiService.createPayment(rendezVousId).subscribe({
      next: (response: PaymentCreationResponse) => {
        console.log('Paiement créé avec succès:', response);
        this.processingPayment[rendezVousId] = false;
        
        if (response.data && response.data.paydunya_url) {
          // Ajouter le paiement aux paiements en attente
          this.pendingPayments.add(rendezVousId);
          this.statusMessages[rendezVousId] = 'Redirection vers PayDunya...';
          
          this.snackBar.open(
            'Paiement initié avec succès. Redirection vers PayDunya...',
            'Fermer',
            { duration: 3000, panelClass: ['success-snackbar'] }
          );
          
          // Rediriger vers PayDunya dans la même fenêtre
          setTimeout(() => {
            window.location.href = response.data.paydunya_url;
          }, 1000);
          
        } else {
          this.showError('URL de paiement non disponible.');
          delete this.statusMessages[rendezVousId];
        }
      },
      error: (err: ApiError) => {
        console.error('Erreur lors de la création du paiement:', err);
        this.processingPayment[rendezVousId] = false;
        delete this.statusMessages[rendezVousId];
        
        this.handlePaymentError(err);
      }
    });
  }

  /**
   * Gérer les erreurs spécifiques aux paiements
   */
  handlePaymentError(err: ApiError): void {
    let errorMessage = 'Erreur lors de la création du paiement';
    
    switch (err.type) {
      case 'PAYMENT_ALREADY_COMPLETED':
        errorMessage = 'Ce rendez-vous a déjà été payé.';
        // Recharger les données pour avoir l'état à jour
        this.loadConfirmedAppointments();
        break;
      case 'INVALID_APPOINTMENT':
        errorMessage = 'Rendez-vous non trouvé ou non confirmé.';
        break;
      case 'PAYDUNYA_ERROR':
        errorMessage = err.message || 'Erreur du service de paiement PayDunya';
        if (err.errors) {
          console.error('Debug PayDunya:', err.errors);
        }
        break;
      case 'VALIDATION_ERROR':
        errorMessage = 'Données de paiement invalides.';
        if (err.errors) {
          console.error('Erreurs de validation:', err.errors);
        }
        break;
      case 'UNAUTHORIZED':
        errorMessage = 'Authentification requise.';
        break;
      case 'FORBIDDEN':
        errorMessage = 'Accès non autorisé.';
        break;
      case 'PATIENT_NOT_FOUND':
        errorMessage = 'Profil patient non trouvé.';
        break;
      default:
        errorMessage = err.message || 'Erreur lors de la création du paiement';
    }
    
    this.showError(errorMessage);
  }

  /**
   * Annuler un paiement en attente
   */
  cancelPayment(paiementId: number): void {
    if (!paiementId) {
      this.showError('ID du paiement invalide.');
      return;
    }
    
    this.error = null;
    
    this.apiService.cancelPayment(paiementId).subscribe({
      next: (response: { message: string }) => {
        this.snackBar.open(
          'Paiement annulé avec succès',
          'Fermer',
          { duration: 3000, panelClass: ['success-snackbar'] }
        );
        
        // Recharger les données pour avoir l'état à jour
        this.loadConfirmedAppointments();
        console.log('Paiement annulé avec succès:', response.message);
      },
      error: (err: ApiError) => {
        this.handleApiError(err, 'Erreur lors de l\'annulation du paiement');
        console.error('Erreur lors de l\'annulation du paiement:', err);
      }
    });
  }

  /**
   * Télécharger le PDF d'une facture
   */
  downloadFacture(factureId: number, factureNumero: string): void {
    if (!factureId || !factureNumero) {
      this.showError('ID ou numéro de facture invalide.');
      return;
    }
    
    this.error = null;
    
    this.apiService.downloadFacturePDF(factureId).subscribe({
      next: (blob: Blob) => {
        saveAs(blob, `facture_${factureNumero}.pdf`);
        this.snackBar.open(
          'PDF téléchargé avec succès',
          'Fermer',
          { duration: 3000, panelClass: ['success-snackbar'] }
        );
        console.log('PDF téléchargé avec succès');
      },
      error: (err: ApiError) => {
        this.handleApiError(err, 'Erreur lors du téléchargement du PDF');
        console.error('Erreur lors du téléchargement du PDF:', err);
      }
    });
  }

  /**
   * Gérer les erreurs d'API de manière centralisée
   */
  handleApiError(err: ApiError, defaultMessage: string): void {
    let errorMessage = defaultMessage;
    
    if (err.message) {
      errorMessage = err.message;
    }
    
    // Gérer les erreurs spécifiques
    switch (err.type) {
      case 'UNAUTHORIZED':
        errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        break;
      case 'FORBIDDEN':
        errorMessage = 'Accès non autorisé à cette ressource.';
        break;
      case 'HTTP_ERROR':
        errorMessage = 'Erreur de connexion au serveur.';
        break;
    }
    
    this.error = errorMessage;
    this.snackBar.open(
      errorMessage,
      'Fermer',
      { duration: 5000, panelClass: ['error-snackbar'] }
    );
    
    if (err.errors) {
      console.error('Détails de l\'erreur:', err.errors);
    }
  }

  /**
   * Afficher une erreur simple
   */
  showError(message: string): void {
    this.error = message;
    this.snackBar.open(message, 'Fermer', { 
      duration: 3000, 
      panelClass: ['error-snackbar'] 
    });
  }

  // Méthodes utilitaires pour le template
  hasPayment(appointment: ConfirmedAppointmentResponse): boolean {
    return !!appointment.paiement;
  }

  isPaymentPending(appointment: ConfirmedAppointmentResponse): boolean {
    return appointment.paiement?.statut === 'en_attente';
  }

  /**
   * Vérifier si un paiement est terminé (payé ou facturé)
   * LOGIQUE BACKEND : Dès qu'une facture existe, le paiement est automatiquement 'paye'
   */
  isPaymentCompleted(appointment: ConfirmedAppointmentResponse): boolean {
    if (!appointment.paiement) return false;
    
    const isPaid = appointment.paiement.statut === 'paye';
    const hasInvoice = !!appointment.paiement.facture;
    
    // Selon la logique du backend :
    // - Si une facture existe, le statut DOIT être 'paye'
    // - Un paiement est terminé si statut = 'paye' OU si une facture existe
    return isPaid || hasInvoice;
  }

  isPaymentCancelled(appointment: ConfirmedAppointmentResponse): boolean {
    return appointment.paiement?.statut === 'annule';
  }

  isPaymentProcessing(appointmentId: number): boolean {
    return !!this.processingPayment[appointmentId] || this.processingPayments.has(appointmentId);
  }

  hasInvoice(appointment: ConfirmedAppointmentResponse): boolean {
    return !!(appointment.paiement?.facture);
  }

  getStatusMessage(appointmentId: number): string {
    return this.statusMessages[appointmentId] || '';
  }

  getPaymentStatusText(appointment: ConfirmedAppointmentResponse): string {
    if (!appointment.paiement) return 'Non payé';
    
    // Selon la logique du backend : si une facture existe, le statut DOIT être 'paye'
    if (appointment.paiement.facture) {
      return 'Payé (Facturé)';
    }
    
    switch (appointment.paiement.statut) {
      case 'en_attente':
        return 'En attente';
      case 'paye':
        return 'Payé';
      case 'annule':
        return 'Annulé';
      default:
        return 'Inconnu';
    }
  }

  getPaymentStatusClass(appointment: ConfirmedAppointmentResponse): string {
    if (!appointment.paiement) return 'status-unpaid';
    
    // Selon la logique du backend : si une facture existe, le paiement est payé
    if (appointment.paiement.facture) {
      return 'status-paid';
    }
    
    switch (appointment.paiement.statut) {
      case 'en_attente':
        return 'status-pending';
      case 'paye':
        return 'status-paid';
      case 'annule':
        return 'status-cancelled';
      default:
        return 'status-unknown';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: string | number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  }

  /**
   * Obtenir le nom complet du médecin
   */
  getMedecinFullName(appointment: ConfirmedAppointmentResponse): string {
    return `Dr. ${appointment.medecin.nom} ${appointment.medecin.prenom}`;
  }

  /**
   * Vérifier si un rendez-vous peut être payé
   * LOGIQUE : Un paiement ne peut être initié que si :
   * - Aucun paiement n'existe OU
   * - Le paiement existant est annulé OU
   * - Le paiement est en attente mais SANS facture (sinon il serait déjà payé)
   */
  canPay(appointment: ConfirmedAppointmentResponse): boolean {
    const hasPayment = !!appointment.paiement;
    const isPaid = appointment.paiement?.statut === 'paye';
    const isCancelled = appointment.paiement?.statut === 'annule';
    const isPending = appointment.paiement?.statut === 'en_attente';
    const hasInvoice = !!appointment.paiement?.facture;
    const isProcessing = this.processingPayment[appointment.id];
    
    // Ne pas permettre le paiement si :
    // - Un traitement est en cours
    // - Le paiement est déjà payé
    // - Une facture existe (donc forcément payé selon la logique backend)
    if (isProcessing || isPaid || hasInvoice) {
      return false;
    }
    
    // Permettre le paiement si :
    // - Aucun paiement n'existe
    // - Le paiement existant est annulé
    // - Le paiement est en attente mais sans facture
    return !hasPayment || isCancelled || (isPending && !hasInvoice);
  }
}