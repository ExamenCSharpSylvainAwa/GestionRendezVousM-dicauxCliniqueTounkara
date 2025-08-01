<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification as LaravelNotification;
use App\Models\Paiement;
use App\Models\User;
use Carbon\Carbon;

class PaiementEffectueNotification extends LaravelNotification implements ShouldQueue
{
    use Queueable;

    protected $paiement;
    protected $medecinUser; // L'utilisateur (médecin) à notifier

    /**
     * Crée une nouvelle instance de notification.
     *
     * @param Paiement $paiement L'objet Paiement effectué.
     * @param User $medecinUser L'utilisateur (médecin) concerné.
     */
    public function __construct(Paiement $paiement, User $medecinUser)
    {
        // Charge les relations nécessaires pour l'email
        $this->paiement = $paiement->load('rendezVous.patient.user', 'rendezVous.medecin.user', 'facture'); // Charge la facture ici
        $this->medecinUser = $medecinUser;
    }

    /**
     * Obtenez les canaux de livraison de notification.
     *
     * @param  object  $notifiable
     * @return array
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Obtenez la représentation de la notification en tant que message mail.
     * Ce message est destiné au médecin pour l'informer d'un paiement effectué.
     *
     * @param  object  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail(object $notifiable): MailMessage
    {
        $dateRdv = Carbon::parse($this->paiement->rendezVous->date_heure)->locale('fr')->isoFormat('dddd D MMMM YYYY à HH:mm');
        $patientNomComplet = $this->paiement->rendezVous->patient->user->prenom . ' ' . $this->paiement->rendezVous->patient->user->nom;
        $montantPaye = number_format($this->paiement->montant, 0, ',', ' ') . ' F CFA';

        // URL pour que le médecin puisse voir les détails du rendez-vous/paiement (à adapter à votre frontend)
        $rendezVousUrl = config('app.frontend_url') . '/medecin/rendez-vous/' . $this->paiement->rendezVous->id;

        $mailMessage = (new MailMessage)
            ->subject('Paiement reçu pour un rendez-vous - Clinique Tounkara') // Mis à jour APP_NAME
            ->greeting('Bonjour Dr. ' . $this->medecinUser->prenom . ',')
            ->line('Nous vous informons que le patient **' . $patientNomComplet . '** a effectué le paiement de son rendez-vous.')
            ->line('')
            ->line('**Détails du paiement :**')
            ->line('- **Patient :** ' . $patientNomComplet)
            ->line('- **Rendez-vous :** Le ' . $dateRdv)
            ->line('- **Montant payé :** ' . $montantPaye)
            ->line('- **Motif :** ' . $this->paiement->rendezVous->motif)
            ->action('Voir le rendez-vous', $rendezVousUrl)
            ->line('Le statut du rendez-vous est maintenant à jour.');

        // Ajouter le lien de téléchargement de la facture si elle existe
        if ($this->paiement->facture) {
            // Assurez-vous que votre route pour générer le PDF est correcte
            $factureUrl = url('/api/factures/' . $this->paiement->facture->id . '/pdf');
            $mailMessage->action('Télécharger la facture', $factureUrl);
            $mailMessage->line('Vous pouvez télécharger la facture correspondante via le lien ci-dessus.');
        }

        return $mailMessage->salutation('Cordialement,')
            ->line('L\'équipe de la Clinique Tounkara'); // Mis à jour APP_NAME
    }

    /**
     * Obtenez la représentation des tableaux de la notification.
     *
     * @param  object  $notifiable
     * @return array
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'paiement_effectue_medecin',
            'paiement_id' => $this->paiement->id,
            'rendez_vous_id' => $this->paiement->rendezVous->id,
            'patient_id' => $this->paiement->rendezVous->patient->id,
            'medecin_id' => $this->medecinUser->medecin->id,
            'montant_paye' => $this->paiement->montant,
            'message' => 'Paiement de ' . $this->paiement->rendezVous->patient->user->nom . ' ' . $this->paiement->rendezVous->patient->user->prenom . ' reçu pour le rendez-vous du ' . $this->paiement->rendezVous->date_heure . '.',
            'facture_id' => $this->paiement->facture->id ?? null, // Ajoute l'ID de la facture
        ];
    }
}
