<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification as LaravelNotification;
use App\Models\RendezVous;
use App\Models\User;
use Carbon\Carbon;

class RendezVousAnnuleNotification extends LaravelNotification implements ShouldQueue
{
    use Queueable;

    protected $rendezVous;
    protected $raisonAnnulation;
    protected $destinataireRole; // 'patient' ou 'medecin' pour personnaliser le message

    /**
     * Crée une nouvelle instance de notification.
     *
     * @param RendezVous $rendezVous Le rendez-vous annulé.
     * @param string $raisonAnnulation La raison de l'annulation.
     * @param string $destinataireRole Le rôle du destinataire ('patient' ou 'medecin').
     */
    public function __construct(RendezVous $rendezVous, string $raisonAnnulation, string $destinataireRole)
    {
        $this->rendezVous = $rendezVous->load('patient.user', 'medecin.user');
        $this->raisonAnnulation = $raisonAnnulation;
        $this->destinataireRole = $destinataireRole;
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
     * Ce message est destiné au patient ou au médecin en cas d'annulation.
     *
     * @param  object  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail(object $notifiable): MailMessage
    {
        $dateRdv = Carbon::parse($this->rendezVous->date_heure)->locale('fr')->isoFormat('dddd D MMMM YYYY à HH:mm');
        $patientNomComplet = $this->rendezVous->patient->user->prenom . ' ' . $this->rendezVous->patient->user->nom;
        $medecinNomComplet = 'Dr. ' . $this->rendezVous->medecin->user->prenom . ' ' . $this->rendezVous->medecin->user->nom;

        $subject = 'Annulation de votre rendez-vous - Clinique Médicale Dakar';
        $greeting = '';
        $message = '';

        if ($this->destinataireRole === 'patient') {
            $greeting = 'Bonjour ' . $this->rendezVous->patient->user->prenom . ',';
            $message = 'Nous vous informons que votre rendez-vous avec ' . $medecinNomComplet . ' prévu le ' . $dateRdv . ' a été **annulé**.'
                . "\n\n" . '**Motif de l\'annulation :** ' . $this->raisonAnnulation
                . "\n\n" . 'N\'hésitez pas à prendre un nouveau rendez-vous si vous le souhaitez.';
        } elseif ($this->destinataireRole === 'medecin') {
            $greeting = 'Bonjour Dr. ' . $this->rendecinUser->prenom . ','; // Correction ici
            $message = 'Le rendez-vous avec le patient ' . $patientNomComplet . ' prévu le ' . $dateRdv . ' a été **annulé**.'
                . "\n\n" . '**Motif de l\'annulation :** ' . $this->raisonAnnulation;
        }

        return (new MailMessage)
            ->subject($subject)
            ->greeting($greeting)
            ->line($message)
            ->action('Accéder à mes rendez-vous', config('app.frontend_url') . '/mes-rendez-vous') // URL générique
            ->line('Nous restons à votre disposition.')
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
            'type' => 'rendez_vous_annule',
            'rendez_vous_id' => $this->rendezVous->id,
            'patient_id' => $this->rendezVous->patient->id,
            'medecin_id' => $this->rendezVous->medecin->id,
            'date_heure_rdv' => $this->rendezVous->date_heure,
            'raison_annulation' => $this->raisonAnnulation,
            'message' => 'Le rendez-vous a été annulé. Motif: ' . $this->raisonAnnulation,
            'destinataire_role' => $this->destinataireRole,
        ];
    }
}
