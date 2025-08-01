<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification as LaravelNotification;
use App\Models\RendezVous;
use App\Models\User;
use Carbon\Carbon;

class RendezVousTermineNotification extends LaravelNotification implements ShouldQueue
{
    use Queueable;

    protected $rendezVous;
    protected $patientUser;

    /**
     * Crée une nouvelle instance de notification.
     *
     * @param RendezVous $rendezVous Le rendez-vous terminé.
     * @param User $patientUser L'utilisateur (patient) concerné.
     */
    public function __construct(RendezVous $rendezVous, User $patientUser)
    {
        $this->rendezVous = $rendezVous->load('medecin.user');
        $this->patientUser = $patientUser;
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
     * Ce message est destiné au patient après la fin du rendez-vous.
     *
     * @param  object  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail(object $notifiable): MailMessage
    {
        $dateRdv = Carbon::parse($this->rendezVous->date_heure)->locale('fr')->isoFormat('dddd D MMMM YYYY');
        $medecinNomComplet = 'Dr. ' . $this->rendezVous->medecin->user->prenom . ' ' . $this->rendezVous->medecin->user->nom;

        // URL pour revoir les rendez-vous ou laisser un avis
        $feedbackUrl = config('app.frontend_url') . '/mes-rendez-vous'; // À adapter

        return (new MailMessage)
            ->subject('Votre consultation est terminée - Clinique Médicale Dakar')
            ->greeting('Bonjour ' . $this->patientUser->prenom . ',')
            ->line('Nous espérons que votre consultation avec ' . $medecinNomComplet . ' le ' . $dateRdv . ' s\'est bien déroulée.')
            ->line('Votre rendez-vous a été marqué comme **terminé**.')
            ->line('')
            ->line('Nous vous souhaitons un prompt rétablissement et une excellente santé.')
            ->action('Accéder à mes rendez-vous', $feedbackUrl)
            ->line('N\'hésitez pas à nous contacter pour toute question ou pour prendre un nouveau rendez-vous.')
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
            'type' => 'rendez_vous_termine',
            'rendez_vous_id' => $this->rendezVous->id,
            'patient_id' => $this->patientUser->patient->id,
            'medecin_id' => $this->rendezVous->medecin->id,
            'date_heure_rdv' => $this->rendezVous->date_heure,
            'message' => 'Votre rendez-vous avec Dr. ' . $this->rendezVous->medecin->user->nom . ' est terminé.',
        ];
    }
}
