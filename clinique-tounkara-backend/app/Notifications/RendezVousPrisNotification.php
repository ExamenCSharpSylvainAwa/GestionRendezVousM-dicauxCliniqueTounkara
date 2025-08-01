<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification as LaravelNotification;
use App\Models\RendezVous;
use App\Models\User;
use Carbon\Carbon;

class RendezVousPrisNotification extends LaravelNotification implements ShouldQueue
{
    use Queueable;

    protected $rendezVous;
    protected $medecinUser; // L'utilisateur (médecin) à notifier

    /**
     * Crée une nouvelle instance de notification.
     *
     * @param RendezVous $rendezVous Le rendez-vous nouvellement créé.
     * @param User $medecinUser L'utilisateur (médecin) concerné.
     */
    public function __construct(RendezVous $rendezVous, User $medecinUser)
    {
        $this->rendezVous = $rendezVous->load('patient.user'); // Charge les relations nécessaires
        $this->medecinUser = $medecinUser;
    }

    /**
     * Obtenez les canaux de livraison de notification.
     *
     * @param  object  $notifiable L'entité notifiable (ici, l'objet User du médecin).
     * @return array
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Obtenez la représentation de la notification en tant que message mail.
     * Ce message est destiné au médecin pour l'informer d'un nouveau RDV et l'inviter à le valider.
     *
     * @param  object  $notifiable L'entité notifiable.
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail(object $notifiable): MailMessage
    {
        $dateRdv = Carbon::parse($this->rendezVous->date_heure)->locale('fr')->isoFormat('dddd D MMMM YYYY à HH:mm');
        $patientNomComplet = $this->rendezVous->patient->user->prenom . ' ' . $this->rendezVous->patient->user->nom;

        // URL pour que le médecin puisse valider le rendez-vous (à adapter à votre frontend)
        $validationUrl = config('app.frontend_url') . '/medecin/rendez-vous/' . $this->rendezVous->id . '/valider';

        return (new MailMessage)
            ->subject('Nouveau rendez-vous en attente de validation - Clinique Médicale Dakar')
            ->greeting('Bonjour Dr. ' . $this->medecinUser->prenom . ',')
            ->line('Un nouveau rendez-vous a été pris et est en attente de votre validation.')
            ->line('')
            ->line('**Détails du rendez-vous :**')
            ->line('- **Patient :** ' . $patientNomComplet)
            ->line('- **Date et heure :** ' . $dateRdv)
            ->line('- **Motif :** ' . $this->rendezVous->motif)
            ->action('Accéder au rendez-vous pour validation', $validationUrl)
            ->line('Merci de bien vouloir examiner ce rendez-vous et de le valider ou de le reporter.')
            ->salutation('Cordialement,')
            ->line('L\'équipe de la Clinique Médicale Dakar');
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
            'type' => 'nouveau_rendez_vous_medecin',
            'rendez_vous_id' => $this->rendezVous->id,
            'patient_id' => $this->rendezVous->patient->id,
            'medecin_id' => $this->medecinUser->medecin->id,
            'date_heure_rdv' => $this->rendezVous->date_heure,
            'message' => 'Un nouveau rendez-vous a été pris par ' . $this->rendezVous->patient->user->nom . '.',
        ];
    }
}
