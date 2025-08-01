<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification as LaravelNotification; // Renommé pour éviter le conflit

use App\Models\RendezVous;
use App\Models\User; // Le modèle User est notifiable et contient l'email
use Carbon\Carbon; // Pour la manipulation des dates

class RendezVousConfirmeNotification extends LaravelNotification implements ShouldQueue // Implémente ShouldQueue pour l'envoi en arrière-plan
{
    use Queueable;

    protected $rendezVous;
    protected $patientUser;

    /**
     * Crée une nouvelle instance de notification.
     *
     * @param RendezVous $rendezVous L'objet RendezVous concerné.
     * @param User $patientUser L'utilisateur (patient) à notifier.
     */
    public function __construct(RendezVous $rendezVous, User $patientUser)
    {
        $this->rendezVous = $rendezVous->load('medecin.user'); // Charge les relations nécessaires pour l'email
        $this->patientUser = $patientUser;
    }

    /**
     * Obtenez les canaux de livraison de notification.
     * Nous envoyons cette notification par email.
     *
     * @param  object  $notifiable L'entité notifiable (ici, l'objet User du patient).
     * @return array
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Obtenez la représentation de la notification en tant que message mail.
     * Ce message est destiné au patient pour l'informer de la confirmation du RDV et l'inviter au paiement.
     *
     * @param  object  $notifiable L'entité notifiable (ici, l'objet User du patient).
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Formate la date et l'heure du rendez-vous en français
        $dateRdv = Carbon::parse($this->rendezVous->date_heure)->locale('fr')->isoFormat('dddd D MMMM YYYY à HH:mm');
        // Nom complet du médecin
        $medecinNomComplet = 'Dr. ' . $this->rendezVous->medecin->user->prenom . ' ' . $this->rendezVous->medecin->user->nom;
        $specialiteMedecin = $this->rendezVous->medecin->specialite;
        // Montant du rendez-vous formaté
        $montantRdv = number_format($this->rendezVous->tarif, 0, ',', ' ') . ' F CFA';

        // URL pour que le patient puisse procéder au paiement
        // Assurez-vous que config('app.frontend_url') est correctement défini dans votre .env
        $paymentUrl = config('app.frontend_url') . '/payments?rendez_vous_id=' . $this->rendezVous->id;

        return (new MailMessage)
            ->subject('Votre rendez-vous est confirmé ! Procédez au paiement - Clinique Médicale Dakar')
            ->greeting('Bonjour ' . $this->patientUser->prenom . ',')
            ->line('Nous avons le plaisir de vous informer que votre rendez-vous a été **confirmé** par le médecin !')
            ->line('') // Ligne vide pour espacer
            ->line('Voici les détails de votre rendez-vous :')
            ->line('- **Médecin :** ' . $medecinNomComplet . ' (' . $specialiteMedecin . ')')
            ->line('- **Date et heure :** ' . $dateRdv)
            ->line('- **Motif :** ' . $this->rendezVous->motif)
            ->line('- **Montant à payer :** ' . $montantRdv)
            ->line('') // Ligne vide pour espacer
            ->line('Pour finaliser votre réservation, veuillez procéder au paiement **au plus tard avant la date et l\'heure de votre rendez-vous**.')
            ->action('Procéder au Paiement', $paymentUrl) // Bouton d'action pour le paiement
            ->line('Nous vous remercions de votre confiance et restons à votre disposition pour toute question.')
            ->salutation('Cordialement,')
            ->line('L\'équipe de la Clinique Médicale Dakar');
    }

    /**
     * Obtenez la représentation des tableaux de la notification.
     * Ces données peuvent être utilisées pour stocker la notification dans la table 'notifications' de Laravel (si utilisée).
     *
     * @param  object  $notifiable L'entité notifiable.
     * @return array
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'rendez_vous_confirme_paiement_requis',
            'rendez_vous_id' => $this->rendezVous->id,
            'patient_id' => $this->patientUser->patient->id,
            'medecin_id' => $this->rendezVous->medecin->id,
            'date_heure_rdv' => $this->rendezVous->date_heure,
            'montant' => $this->rendezVous->tarif,
            'message' => 'Votre rendez-vous a été confirmé par le médecin. Paiement requis.',
        ];
    }
}
