<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification as LaravelNotification;
use App\Models\RendezVous;
use App\Models\User; // Assurez-vous d'importer le modèle User
use Carbon\Carbon;

class RendezVousReporteNotification extends LaravelNotification implements ShouldQueue
{
    use Queueable;

    protected $rendezVous;
    protected $ancienneDateHeure;
    protected $raisonReport;
    protected $destinataireRole; // 'patient' ou 'medecin'
    protected $notifiableUser; // L'utilisateur (Patient ou Médecin) qui est notifié

    /**
     * Crée une nouvelle instance de notification.
     *
     * @param RendezVous $rendezVous Le rendez-vous reporté (avec la nouvelle date/heure).
     * @param string $ancienneDateHeure L'ancienne date et heure du rendez-vous.
     * @param string $raisonReport La raison du report.
     * @param string $destinataireRole Le rôle du destinataire ('patient' ou 'medecin').
     * @param User $notifiableUser L'objet User qui est le destinataire de cette notification.
     */
    public function __construct(RendezVous $rendezVous, string $ancienneDateHeure, string $raisonReport, string $destinataireRole, User $notifiableUser)
    {
        $this->rendezVous = $rendezVous->load('patient.user', 'medecin.user');
        $this->ancienneDateHeure = $ancienneDateHeure;
        $this->raisonReport = $raisonReport;
        $this->destinataireRole = $destinataireRole;
        $this->notifiableUser = $notifiableUser; // Stocke l'utilisateur notifiable
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
     * Ce message est destiné au patient ou au médecin en cas de report.
     *
     * @param  object  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail(object $notifiable): MailMessage
    {
        $ancienneDate = Carbon::parse($this->ancienneDateHeure)->locale('fr')->isoFormat('dddd D MMMM YYYY à HH:mm');
        $nouvelleDate = Carbon::parse($this->rendezVous->date_heure)->locale('fr')->isoFormat('dddd D MMMM YYYY à HH:mm');
        $patientNomComplet = $this->rendezVous->patient->user->prenom . ' ' . $this->rendezVous->patient->user->nom;
        $medecinNomComplet = 'Dr. ' . $this->rendezVous->medecin->user->prenom . ' ' . $this->rendezVous->medecin->user->nom;

        $subject = 'Votre rendez-vous a été reporté - Clinique Tounkara'; // Mis à jour APP_NAME
        $greeting = '';
        $message = '';

        if ($this->destinataireRole === 'patient') {
            $greeting = 'Bonjour ' . $this->notifiableUser->prenom . ','; // Utilise $this->notifiableUser
            $message = 'Nous vous informons que votre rendez-vous avec ' . $medecinNomComplet . ' a été **reporté**.'
                . "\n\n" . '**Ancienne date et heure :** ' . $ancienneDate
                . "\n" . '**Nouvelle date et heure :** ' . $nouvelleDate
                . "\n\n" . '**Motif du report :** ' . $this->raisonReport;
        } elseif ($this->destinataireRole === 'medecin') {
            $greeting = 'Bonjour Dr. ' . $this->notifiableUser->prenom . ','; // Utilise $this->notifiableUser
            $message = 'Le rendez-vous avec le patient ' . $patientNomComplet . ' a été **reporté**.'
                . "\n\n" . '**Ancienne date et heure :** ' . $ancienneDate
                . "\n" . '**Nouvelle date et heure :** ' . $nouvelleDate
                . "\n\n" . '**Motif du report :** ' . $this->raisonReport;
        }

        // Vérifier si le rendez-vous a un paiement associé et si la facture existe pour inclure le lien de téléchargement
        $factureUrl = null;
        if ($this->rendezVous->paiements->isNotEmpty()) {
            $paiementPaye = $this->rendezVous->paiements->where('statut', 'paye')->first();
            if ($paiementPaye && $paiementPaye->facture) {
                // Assurez-vous que votre route pour générer le PDF est correcte
                $factureUrl = url('/api/factures/' . $paiementPaye->facture->id . '/pdf');
            }
        }

        $mailMessage = (new MailMessage)
            ->subject($subject)
            ->greeting($greeting)
            ->line($message)
            ->action('Accéder à mes rendez-vous', config('app.frontend_url') . '/mes-rendez-vous') // URL générique
            ->line('Nous vous remercions de votre compréhension.');

        if ($factureUrl) {
            $mailMessage->action('Télécharger votre facture', $factureUrl);
            $mailMessage->line('Vous pouvez télécharger votre facture mise à jour via le lien ci-dessus.');
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
            'type' => 'rendez_vous_reporte',
            'rendez_vous_id' => $this->rendezVous->id,
            'patient_id' => $this->rendezVous->patient->id,
            'medecin_id' => $this->rendezVous->medecin->id,
            'ancienne_date_heure' => $this->ancienneDateHeure,
            'nouvelle_date_heure' => $this->rendezVous->date_heure,
            'raison_report' => $this->raisonReport,
            'message' => 'Le rendez-vous a été reporté. Nouvelle date: ' . $this->rendezVous->date_heure . '. Motif: ' . $this->raisonReport,
            'destinataire_role' => $this->destinataireRole,
        ];
    }
}
